package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func setupAuthorizedOriginTaskUser(t *testing.T, c *gin.Context) {
	t.Helper()
	previousRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedis })
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.Department{}, &model.UserGroup{}, &model.UserGroupMember{}, &model.ModelSet{}, &model.ModelSetItem{}, &model.ModelGrant{}))
	user := model.User{Username: "task-user", AffCode: "task-user", Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, model.DB.Create(&user).Error)
	set := model.ModelSet{Name: "task-models"}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"resolved-model"}))
	require.NoError(t, model.GrantModelSet(model.SubjectTypeUser, user.Id, set.Id, 0, 1))
	c.Set("id", user.Id)
}

func TestPinnedChannelStillChecksUserAndTokenModelAccess(t *testing.T) {
	require.NoError(t, appI18n.Init())
	for _, deniedBy := range []string{"user", "token"} {
		t.Run(deniedBy, func(t *testing.T) {
			setupOriginTaskDB(t)
			channel := insertOriginTaskChannel(t, common.ChannelStatusEnabled)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/vendor/jobs", strings.NewReader("{}"))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set("resolved_task_model", "resolved-model")
			setupAuthorizedOriginTaskUser(t, c)
			if deniedBy == "user" {
				require.NoError(t, model.DB.Where("subject_id = ?", c.GetInt("id")).Delete(&model.ModelGrant{}).Error)
			} else {
				common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
				common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"other-model": true})
			}
			service.GetChannelConstraints(c).AddPin(dto.ChannelPin{ChannelId: channel.Id, Source: dto.PinSourceOriginTask, Rank: dto.PinRankOriginTask})
			Distribute()(c)
			assert.True(t, c.IsAborted())
			assert.Equal(t, http.StatusForbidden, recorder.Code)
		})
	}
}

func TestTaskResultQueriesReachTheOwnershipHandlerWithoutModelGrants(t *testing.T) {
	for _, path := range []string{"/mj/task/task-id/fetch", "/v1/videos/task-id"} {
		t.Run(path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			router := gin.New()
			router.GET(path, func(c *gin.Context) { c.Set("id", 7) }, Distribute(), func(c *gin.Context) {
				// Result ownership is still decided by the task handler, independently
				// of whether the owner's earlier model grant has since expired.
				c.JSON(http.StatusNotFound, gin.H{"error": "owned task not found"})
			})
			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
			assert.Equal(t, http.StatusNotFound, recorder.Code)
			assert.Contains(t, recorder.Body.String(), "owned task not found")
		})
	}
}
