package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelAuthTestDB(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousRedis := common.RedisEnabled

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(
		&model.Department{},
		&model.UserGroup{},
		&model.UserGroupMember{},
		&model.ModelSet{},
		&model.ModelSetItem{},
		&model.ModelGrant{},
		&model.ModelAccessRequest{},
		&model.User{},
		&model.Model{},
	))
	model.DB = db
	common.RedisEnabled = false

	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
	})
}

func TestModelAuthService_AdminAccess(t *testing.T) {
	setupModelAuthTestDB(t)

	admin := &model.User{
		Username: "admin_user",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_admin",
	}
	require.NoError(t, model.DB.Create(admin).Error)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	// Admin should have access to any model
	allowed, errMsg := ValidateUserAndTokenModelAccess(c, admin.Id, "any-super-model")
	assert.True(t, allowed)
	assert.Empty(t, errMsg)
}

func TestModelAuthService_UserAndTokenIntersection(t *testing.T) {
	setupModelAuthTestDB(t)

	// 1. Create Model Set and Models
	set := &model.ModelSet{Name: "开发组模型集", Status: model.ModelSetStatusEnabled}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"gpt-4o", "claude-3-5-sonnet", "deepseek-v3"}))

	// 2. Create User and Grant Set
	user := &model.User{
		Username: "dev_user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_dev",
	}
	require.NoError(t, model.DB.Create(user).Error)
	require.NoError(t, model.GrantModelSet(model.SubjectTypeUser, user.Id, set.Id, 0, 1))

	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	// 3. Test Granted Model -> Allowed
	allowed, errMsg := ValidateUserAndTokenModelAccess(c, user.Id, "gpt-4o")
	assert.True(t, allowed)
	assert.Empty(t, errMsg)

	// 4. Test Ungranted Model -> Forbidden
	allowed, errMsg = ValidateUserAndTokenModelAccess(c, user.Id, "gemini-1.5-pro")
	assert.False(t, allowed)
	assert.Contains(t, errMsg, "未获得模型")

	// 5. Test Token Model Limits (Intersection / Narrowing)
	// Enable token model limit with only ["gpt-4o"]
	c.Set(string(constant.ContextKeyTokenModelLimitEnabled), true)
	c.Set(string(constant.ContextKeyTokenModelLimit), map[string]bool{
		"gpt-4o": true,
	})

	// gpt-4o is granted to user AND allowed in token -> Allowed
	allowed, errMsg = ValidateUserAndTokenModelAccess(c, user.Id, "gpt-4o")
	assert.True(t, allowed)
	assert.Empty(t, errMsg)

	// deepseek-v3 is granted to user BUT NOT in token -> Forbidden by token limit
	allowed, errMsg = ValidateUserAndTokenModelAccess(c, user.Id, "deepseek-v3")
	assert.False(t, allowed)
	assert.Contains(t, errMsg, "未包含模型")
}
