package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelAffinity_RespectsRevokedAuthorization(t *testing.T) {
	setupModelAuthTestDB(t)

	// 1. Create Model Set and Models
	set := &model.ModelSet{Name: "临时授权集", Status: model.ModelSetStatusEnabled}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"claude-3-5-sonnet"}))

	// 2. Create User and Grant Set
	user := &model.User{
		Username: "affinity_user",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_aff",
	}
	require.NoError(t, model.DB.Create(user).Error)
	require.NoError(t, model.GrantModelSet(model.SubjectTypeUser, user.Id, set.Id, 0, 1))

	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	// 3. User is authorized initially
	allowed, errMsg := ValidateUserAndTokenModelAccess(c, user.Id, "claude-3-5-sonnet")
	assert.True(t, allowed)
	assert.Empty(t, errMsg)

	// 4. Revoke the grant
	require.NoError(t, model.RevokeModelGrantBySubjectAndSet(model.SubjectTypeUser, user.Id, set.Id))
	InvalidateUserModelAuthCache(user.Id)

	// 5. Subsequent request must be rejected even if affinity existed
	allowed, errMsg = ValidateUserAndTokenModelAccess(c, user.Id, "claude-3-5-sonnet")
	assert.False(t, allowed)
	assert.Contains(t, errMsg, "未获得模型")
}
