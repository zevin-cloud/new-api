package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupGrantControllerDB(t *testing.T) {
	t.Helper()
	oldDB, oldLog, oldRedis := model.DB, model.LOG_DB, common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Department{}, &model.UserGroup{}, &model.UserGroupMember{}, &model.ModelSet{}, &model.ModelSetItem{}, &model.ModelGrant{}, &model.ModelGrantBatch{}, &model.ModelAuthAudit{}, &model.Model{}))
	model.DB, model.LOG_DB, common.RedisEnabled = db, db, false
	t.Cleanup(func() {
		model.DB, model.LOG_DB, common.RedisEnabled = oldDB, oldLog, oldRedis
		require.NoError(t, sqlDB.Close())
	})
}

func TestBatchGrantFailureLeavesNoAuthorizationOrGeneratedSet(t *testing.T) {
	setupGrantControllerDB(t)
	user := model.User{Id: 1, Username: "member", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&user).Error)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/model-grant", strings.NewReader(`{"user_ids":[1,999],"model_names":["research-model"]}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", 10)
	GrantModelSet(c)
	assert.Contains(t, recorder.Body.String(), `"success":false`)
	var grants, sets int64
	require.NoError(t, model.DB.Model(&model.ModelGrant{}).Count(&grants).Error)
	require.NoError(t, model.DB.Model(&model.ModelSet{}).Count(&sets).Error)
	assert.Zero(t, grants)
	assert.Zero(t, sets)
}

func TestEditingGroupRemovesCachedPermissionsFromFormerMembers(t *testing.T) {
	setupGrantControllerDB(t)
	server := miniredis.RunT(t)
	previousRDB := common.RDB
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	common.RDB, common.RedisEnabled = client, true
	t.Cleanup(func() { common.RDB = previousRDB; require.NoError(t, client.Close()) })
	user := model.User{Id: 1, Username: "member", Status: common.UserStatusEnabled, Role: common.RoleCommonUser}
	require.NoError(t, model.DB.Create(&user).Error)
	group := model.UserGroup{Id: 1, Name: "research"}
	require.NoError(t, group.Insert())
	require.NoError(t, model.AddUserToGroup(group.Id, user.Id))
	set := model.ModelSet{Name: "research models"}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"research-model"}))
	require.NoError(t, model.GrantModelSet(model.SubjectTypeUserGroup, group.Id, set.Id, 0, 10))
	models, _, err := service.GetUserGrantedModelMap(user.Id)
	require.NoError(t, err)
	require.True(t, models["research-model"])
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	c.Request = httptest.NewRequest(http.MethodPut, "/api/user-group/1", strings.NewReader(`{"name":"research","status":1,"user_ids":[]}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", 10)
	UpdateAdminUserGroup(c)
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	models, _, err = service.GetUserGrantedModelMap(user.Id)
	require.NoError(t, err)
	assert.False(t, models["research-model"])
}

func TestUserUpdatePreservesOmittedOrganizationFieldsAndAllowsExplicitClearing(t *testing.T) {
	for _, clearFields := range []bool{false, true} {
		t.Run(map[bool]string{false: "omitted", true: "cleared"}[clearFields], func(t *testing.T) {
			setupGrantControllerDB(t)
			user := model.User{Id: 1, Username: "member", AffCode: "member", Group: "default", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DepartmentId: 7, EmployeeId: "E-7"}
			require.NoError(t, model.DB.Create(&user).Error)
			request := map[string]any{"id": 1, "username": "member", "group": "default", "display_name": "Updated"}
			if clearFields {
				request["department_id"] = 0
				request["employee_id"] = ""
			}
			data, err := common.Marshal(request)
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Set("id", 10)
			c.Set("role", common.RoleAdminUser)
			c.Request = httptest.NewRequest(http.MethodPut, "/api/user/", strings.NewReader(string(data)))
			c.Request.Header.Set("Content-Type", "application/json")
			UpdateUser(c)
			assert.Contains(t, recorder.Body.String(), `"success":true`)
			saved, err := model.GetUserById(1, false)
			require.NoError(t, err)
			if clearFields {
				assert.Zero(t, saved.DepartmentId)
				assert.Empty(t, saved.EmployeeId)
			} else {
				assert.Equal(t, 7, saved.DepartmentId)
				assert.Equal(t, "E-7", saved.EmployeeId)
			}
		})
	}
}
