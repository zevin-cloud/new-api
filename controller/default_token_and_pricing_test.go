package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTokenAndPricingDB(t *testing.T) {
	t.Helper()
	oldDB, oldLog, oldRedis := model.DB, model.LOG_DB, common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Department{},
		&model.UserGroup{},
		&model.UserGroupMember{},
		&model.ModelSet{},
		&model.ModelSetItem{},
		&model.ModelGrant{},
		&model.ModelGrantBatch{},
		&model.Token{},
	))
	model.DB, model.LOG_DB, common.RedisEnabled = db, db, false
	t.Cleanup(func() {
		model.DB, model.LOG_DB, common.RedisEnabled = oldDB, oldLog, oldRedis
		require.NoError(t, sqlDB.Close())
	})
}

func TestGetAndResetDefaultUserToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupTokenAndPricingDB(t)

	user := model.User{Id: 101, Username: "staff01", Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&user).Error)

	// 1. First call: auto generates a default token
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/user/default-token", nil)
	c.Set("id", 101)

	GetDefaultUserToken(c)
	assert.Equal(t, http.StatusOK, recorder.Code)

	var res struct {
		Success bool `json:"success"`
		Data    struct {
			Id   int    `json:"id"`
			Name string `json:"name"`
			Key  string `json:"key"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &res))
	assert.True(t, res.Success)
	assert.NotEmpty(t, res.Data.Key)
	assert.Contains(t, res.Data.Name, "staff01")
	firstKey := res.Data.Key

	// 2. Second call: returns the existing token
	recorder2 := httptest.NewRecorder()
	c2, _ := gin.CreateTestContext(recorder2)
	c2.Request = httptest.NewRequest(http.MethodGet, "/api/user/default-token", nil)
	c2.Set("id", 101)

	GetDefaultUserToken(c2)
	assert.Equal(t, http.StatusOK, recorder2.Code)
	var res2 struct {
		Success bool `json:"success"`
		Data    struct {
			Id   int    `json:"id"`
			Key  string `json:"key"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder2.Body.Bytes(), &res2))
	assert.Equal(t, firstKey, res2.Data.Key)

	// 3. Reset call: generates a new key
	recorder3 := httptest.NewRecorder()
	c3, _ := gin.CreateTestContext(recorder3)
	c3.Request = httptest.NewRequest(http.MethodPost, "/api/user/default-token/reset", nil)
	c3.Set("id", 101)

	ResetDefaultUserToken(c3)
	assert.Equal(t, http.StatusOK, recorder3.Code)
	var res3 struct {
		Success bool `json:"success"`
		Data    struct {
			Key string `json:"key"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder3.Body.Bytes(), &res3))
	assert.True(t, res3.Success)
	assert.NotEmpty(t, res3.Data.Key)
	assert.NotEqual(t, firstKey, res3.Data.Key)
}
