package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	appI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDistributorConcurrencyTestDB(t *testing.T) {
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
		&model.User{},
		&model.Model{},
		&model.Channel{},
		&model.Ability{},
	))
	model.DB = db
	common.RedisEnabled = false

	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
		_ = sqlDB.Close()
	})
}

func TestDistribute_ConcurrencyLimitExceeded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, appI18n.Init())
	setupDistributorConcurrencyTestDB(t)

	// Create user with Admin role so model authorization passes
	user := &model.User{
		Username: "admin_concurrency",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_admin_conc",
	}
	require.NoError(t, model.DB.Create(user).Error)

	// Create model with MaxConcurrency = 1
	m := &model.Model{
		ModelName:      "limited-gpt",
		MaxConcurrency: 1,
		Status:         1,
	}
	require.NoError(t, m.Insert())

	// Acquire the 1 available slot manually
	rel, limitErr := service.AcquireConcurrency(context.Background(), user.Id, "limited-gpt")
	require.Nil(t, limitErr)
	require.NotNil(t, rel)
	defer rel()

	// Now send a request through Distribute middleware targeting "limited-gpt"
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"limited-gpt"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", user.Id)

	handler := Distribute()
	handler(c)

	// Request should be aborted with 429 Too Many Requests
	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusTooManyRequests, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "concurrency_limit_exceeded")
}
