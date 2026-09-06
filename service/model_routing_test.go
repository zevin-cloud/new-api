package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUnifiedModelGrantAndChannelScheduling(t *testing.T) {
	setupModelAuthTestDB(t)
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1,"isolated":1}`))
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios)) })
	require.NoError(t, model.DB.AutoMigrate(&model.Ability{}, &model.Channel{}))

	previousCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = previousCache
		model.InitChannelCache()
	})

	p10 := int64(10)
	w10 := uint(10)
	p20 := int64(20)

	// Setup channels:
	// model-a provided by channel in "default"
	// model-b provided by channel in "vip"
	chA := model.Channel{Name: "ch-a", Key: "k-a", Group: "default", Models: "model-a", Status: common.ChannelStatusEnabled, Priority: &p10, Weight: &w10, Type: 1}
	require.NoError(t, chA.Insert())
	chB := model.Channel{Name: "ch-b", Key: "k-b", Group: "vip", Models: "model-b", Status: common.ChannelStatusEnabled, Priority: &p20, Weight: &w10, Type: 1}
	require.NoError(t, chB.Insert())
	model.InitChannelCache()

	// User has 0 personal balance and belongs to "default" group
	user := model.User{Username: "enterprise-user", AffCode: "ent-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", Quota: 0}
	require.NoError(t, model.DB.Create(&user).Error)

	// Admin grants a cross-pool model set containing model-a and model-b
	set := model.ModelSet{Name: "enterprise-suite", Status: model.ModelSetStatusEnabled}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"model-a", "model-b"}))

	batch, err := model.CreateModelGrantBatch(
		[]model.ModelGrantSubject{{Type: model.SubjectTypeUser, Id: user.Id}},
		[]int{set.Id},
		nil,
		"",
		"",
		0, // QuotaTypeUnlimited
		0,
		0,
		0,
		0,
		1,
	)
	require.NoError(t, err)
	require.NotNil(t, batch)

	// 1. User can access model-a and model-b with a single key without needing vip group permission
	for _, modelName := range []string{"model-a", "model-b"} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		allowed, msg := ValidateUserAndTokenModelAccess(c, user.Id, modelName)
		require.True(t, allowed, msg)

		// Check channel selection across pools
		selected, fallback, err := CacheGetRandomSatisfiedChannel(&RetryParam{
			Ctx:        c,
			TokenGroup: "default",
			ModelName:  modelName,
		})
		require.NoError(t, err)
		require.NotNil(t, selected)
		if modelName == "model-a" {
			assert.Equal(t, "ch-a", selected.Name)
			assert.Equal(t, "default", selected.Group)
		} else {
			assert.Equal(t, "ch-b", selected.Name)
			assert.Equal(t, "vip", selected.Group)
		}
		_ = fallback
	}

	// 2. Ungranted model cannot be accessed
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	allowed, msg := ValidateUserAndTokenModelAccess(c, user.Id, "ungranted-model")
	assert.False(t, allowed)
	assert.Contains(t, msg, "尚未获得模型 ungranted-model 的调用授权")

	// 3. BillingSession with unlimited grant works with 0 personal balance
	c, _ = gin.CreateTestContext(httptest.NewRecorder())
	allowed, _ = ValidateUserAndTokenModelAccess(c, user.Id, "model-b")
	require.True(t, allowed)

	policyVal, exists := c.Get("effective_grant_policy")
	require.True(t, exists)
	policy := policyVal.(*model.EffectiveGrantPolicy)
	assert.Equal(t, 0, policy.QuotaType)

	relayInfo := &relaycommon.RelayInfo{
		UserId:          user.Id,
		TokenId:         1,
		TokenKey:        "sk-test",
		OriginModelName: "model-b",
		IsPlayground:    false,
	}

	session, bErr := NewBillingSession(c, relayInfo, 500)
	require.Nil(t, bErr)
	require.NotNil(t, session)
	assert.Equal(t, BillingSourceGrant, session.FundingSource())
}

func TestCappedGrantBudgetExhaustion(t *testing.T) {
	setupModelAuthTestDB(t)
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios)) })
	require.NoError(t, model.DB.AutoMigrate(&model.Ability{}, &model.Channel{}))

	user := model.User{Username: "budget-user", AffCode: "bgt-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", Quota: 0}
	require.NoError(t, model.DB.Create(&user).Error)

	set := model.ModelSet{Name: "capped-set", Status: model.ModelSetStatusEnabled}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"model-x"}))

	// Grant 1000 quota
	batch, err := model.CreateModelGrantBatch(
		[]model.ModelGrantSubject{{Type: model.SubjectTypeUser, Id: user.Id}},
		[]int{set.Id},
		nil,
		"",
		"",
		1,    // QuotaTypeCapped
		1000, // GrantQuota
		0,
		0,
		0,
		1,
	)
	require.NoError(t, err)
	require.NotNil(t, batch)

	var grant model.ModelGrant
	require.NoError(t, model.DB.Where("batch_id = ?", batch.Id).First(&grant).Error)

	// Validate access succeeds
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	allowed, msg := ValidateUserAndTokenModelAccess(c, user.Id, "model-x")
	require.True(t, allowed, msg)

	// Reserve 600 quota via TryReserveGrantQuota
	ok, rErr := model.TryReserveGrantQuota(grant.Id, batch.Id, 0, 600)
	require.NoError(t, rErr)
	assert.True(t, ok)

	// Another reservation of 500 should fail (600 + 500 = 1100 > 1000)
	ok, rErr = model.TryReserveGrantQuota(grant.Id, batch.Id, 0, 500)
	require.NoError(t, rErr)
	assert.False(t, ok)

	// Simulate grant used quota hitting cap
	require.NoError(t, model.DB.Model(&model.ModelGrant{}).Where("id = ?", grant.Id).Update("used_quota", 1000).Error)
	InvalidateUserModelAuthCache(user.Id)

	c, _ = gin.CreateTestContext(httptest.NewRecorder())
	allowed, msg = ValidateUserAndTokenModelAccess(c, user.Id, "model-x")
	assert.False(t, allowed)
	assert.Contains(t, msg, "专项预算额度已耗尽")
}
