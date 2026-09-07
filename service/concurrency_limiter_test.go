package service

import (
	"context"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConcurrencyLimiter_UserGroupLimit(t *testing.T) {
	setupModelAuthTestDB(t)

	// Create user
	user := &model.User{
		Username: "tester_ug",
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_tester_ug",
	}
	require.NoError(t, model.DB.Create(user).Error)

	// Create user group with MaxConcurrency = 2
	ug := &model.UserGroup{
		Name:           "Dev Team",
		MaxConcurrency: 2,
		Status:         model.UserGroupStatusEnabled,
	}
	require.NoError(t, ug.Insert())
	require.NoError(t, model.AddUserToGroup(ug.Id, user.Id))

	ctx := context.Background()

	// 1st request should succeed
	rel1, err1 := AcquireConcurrency(ctx, user.Id, "gpt-4o")
	require.Nil(t, err1)
	require.NotNil(t, rel1)

	// 2nd request should succeed
	rel2, err2 := AcquireConcurrency(ctx, user.Id, "gpt-4o")
	require.Nil(t, err2)
	require.NotNil(t, rel2)

	// 3rd request should fail with concurrency limit error
	rel3, err3 := AcquireConcurrency(ctx, user.Id, "gpt-4o")
	require.NotNil(t, err3)
	assert.Nil(t, rel3)
	assert.Equal(t, "user_group", err3.Dimension)
	assert.Equal(t, "Dev Team", err3.TargetName)
	assert.Equal(t, 2, err3.Limit)
	assert.Equal(t, 2, err3.Current)

	// Release 1st request
	rel1()

	// Now a new request should succeed
	rel4, err4 := AcquireConcurrency(ctx, user.Id, "gpt-4o")
	require.Nil(t, err4)
	require.NotNil(t, rel4)

	// Cleanup
	rel2()
	rel4()
}

func TestConcurrencyLimiter_ModelSetLimit(t *testing.T) {
	setupModelAuthTestDB(t)

	user := &model.User{
		Username: "tester_ms",
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_tester_ms",
	}
	require.NoError(t, model.DB.Create(user).Error)

	// Create model set with MaxConcurrency = 1
	set := &model.ModelSet{
		Name:           "Reasoning Cluster",
		MaxConcurrency: 1,
		Status:         model.ModelSetStatusEnabled,
	}
	require.NoError(t, set.Insert())
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"o1-preview"}))

	ctx := context.Background()

	// 1st request should succeed
	rel1, err1 := AcquireConcurrency(ctx, user.Id, "o1-preview")
	require.Nil(t, err1)
	require.NotNil(t, rel1)

	// 2nd request should fail
	rel2, err2 := AcquireConcurrency(ctx, user.Id, "o1-preview")
	require.NotNil(t, err2)
	assert.Nil(t, rel2)
	assert.Equal(t, "model_set", err2.Dimension)
	assert.Equal(t, "Reasoning Cluster", err2.TargetName)
	assert.Equal(t, 1, err2.Limit)

	// Release 1st request
	rel1()

	// Re-attempt should now succeed
	rel3, err3 := AcquireConcurrency(ctx, user.Id, "o1-preview")
	require.Nil(t, err3)
	require.NotNil(t, rel3)
	rel3()
}

func TestConcurrencyLimiter_ModelLimit(t *testing.T) {
	setupModelAuthTestDB(t)

	user := &model.User{
		Username: "tester_model",
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_tester_model",
	}
	require.NoError(t, model.DB.Create(user).Error)

	// Create model with MaxConcurrency = 1
	m := &model.Model{
		ModelName:      "deepseek-r1",
		MaxConcurrency: 1,
		Status:         1,
	}
	require.NoError(t, m.Insert())

	ctx := context.Background()

	rel1, err1 := AcquireConcurrency(ctx, user.Id, "deepseek-r1")
	require.Nil(t, err1)
	require.NotNil(t, rel1)

	rel2, err2 := AcquireConcurrency(ctx, user.Id, "deepseek-r1")
	require.NotNil(t, err2)
	assert.Nil(t, rel2)
	assert.Equal(t, "model", err2.Dimension)
	assert.Equal(t, "deepseek-r1", err2.TargetName)

	rel1()

	rel3, err3 := AcquireConcurrency(ctx, user.Id, "deepseek-r1")
	require.Nil(t, err3)
	require.NotNil(t, rel3)
	rel3()
}

func TestConcurrencyLimiter_ConcurrentGoroutines(t *testing.T) {
	limiter := &memoryConcurrencyLimiter{counts: make(map[string]int)}
	targets := []concurrencyTarget{
		{Key: "concurrency:test", Limit: 5, Dimension: "model", TargetName: "test"},
	}

	var wg sync.WaitGroup
	successCount := 0
	var mu sync.Mutex

	// 20 goroutines attempting to acquire concurrency limit of 5 simultaneously
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rel, err := limiter.acquire(targets)
			if err == nil && rel != nil {
				mu.Lock()
				successCount++
				mu.Unlock()
				// hold briefly then release
				rel()
			}
		}()
	}
	wg.Wait()

	// Ensure in-flight counter returned to 0
	assert.Equal(t, 0, limiter.counts["concurrency:test"])
}

func TestConcurrencyLimiter_GrantLimit(t *testing.T) {
	setupModelAuthTestDB(t)

	user := &model.User{
		Username: "tester_grant_concurrency",
		Status:   common.UserStatusEnabled,
		AffCode:  "aff_tester_gc",
	}
	require.NoError(t, model.DB.Create(user).Error)

	set := &model.ModelSet{
		Name:   "GrantConcurrencySet",
		Status: model.ModelSetStatusEnabled,
	}
	require.NoError(t, model.DB.Create(set).Error)
	require.NoError(t, model.AddModelsToModelSet(set.Id, []string{"grant-concurrency-model"}))

	// Grant with MaxConcurrency = 1
	_, err := model.CreateModelGrantBatch(
		"",
		[]model.ModelGrantSubject{{Type: model.SubjectTypeUser, Id: user.Id}},
		[]int{set.Id},
		nil,
		"",
		"vip_pool",
		0,
		0,
		0,
		1,
		0,
		1,
	)
	require.NoError(t, err)

	ctx := context.Background()

	// 1st request should succeed
	rel1, err1 := AcquireConcurrency(ctx, user.Id, "grant-concurrency-model")
	require.Nil(t, err1)
	require.NotNil(t, rel1)

	// 2nd request should fail on grant limit
	rel2, err2 := AcquireConcurrency(ctx, user.Id, "grant-concurrency-model")
	require.NotNil(t, err2)
	assert.Nil(t, rel2)
	assert.Equal(t, "grant", err2.Dimension)
	assert.Equal(t, 1, err2.Limit)
	assert.Equal(t, 1, err2.Current)

	// Release 1st request
	rel1()

	// 3rd request should now succeed
	rel3, err3 := AcquireConcurrency(ctx, user.Id, "grant-concurrency-model")
	require.Nil(t, err3)
	require.NotNil(t, rel3)
	rel3()
}
