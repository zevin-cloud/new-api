package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelAuthCacheNeverOutlivesTheFirstGrantExpiry(t *testing.T) {
	setupModelAuthTestDB(t)
	server := miniredis.RunT(t)
	previousRDB := common.RDB
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	common.RDB, common.RedisEnabled = client, true
	t.Cleanup(func() { common.RDB = previousRDB; require.NoError(t, client.Close()) })
	user := model.User{Username: "expiring-member", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&user).Error)
	set := model.ModelSet{Name: "temporary"}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"temporary-model"}))
	require.NoError(t, model.GrantModelSet(model.SubjectTypeUser, user.Id, set.Id, common.GetTimestamp()+60, 1))
	models, all, err := GetUserGrantedModelMap(user.Id)
	require.NoError(t, err)
	assert.False(t, all)
	assert.True(t, models["temporary-model"])
	ttl := server.TTL(fmt.Sprintf("%s%d", userModelAuthCachePrefix, user.Id))
	assert.Greater(t, ttl, time.Duration(0))
	assert.LessOrEqual(t, ttl, time.Minute)
}
