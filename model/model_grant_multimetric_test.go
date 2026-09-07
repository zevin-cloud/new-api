package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelGrantMultiMetricLimitsAndPeriodReset(t *testing.T) {
	setupModelGrantTestDB(t)

	now := time.Now()
	// Create test user and model set
	user := User{Username: "alice", DisplayName: "Alice", Status: 1}
	require.NoError(t, DB.Create(&user).Error)

	set := ModelSet{Name: "CoreSet", Status: 1}
	require.NoError(t, DB.Create(&set).Error)

	// 1. Create batch with Quota, Tokens, Calls, and Daily period
	batch, err := CreateModelGrantBatchEx(CreateModelGrantBatchInput{
		Name: "复合限制授权",
		Subjects: []ModelGrantSubject{
			{Type: SubjectTypeUser, Id: user.Id},
		},
		SetIds:         []int{set.Id},
		GrantQuota:     500000,
		GrantTokens:    100000,
		GrantCalls:     50,
		PeriodType:     1, // Daily
		PeriodInterval: 1,
		PeriodUnit:     "day",
		QuotaScope:     0,
		ActorId:        1,
	})
	require.NoError(t, err)
	require.NotNil(t, batch)
	assert.Equal(t, int64(500000), batch.GrantQuota)
	assert.Equal(t, int64(100000), batch.GrantTokens)
	assert.Equal(t, int64(50), batch.GrantCalls)
	assert.Equal(t, 1, batch.PeriodType)

	// Verify grant record created
	var grant ModelGrant
	require.NoError(t, DB.Where("batch_id = ? AND subject_id = ?", batch.Id, user.Id).First(&grant).Error)
	assert.Equal(t, int64(500000), grant.GrantQuota)
	assert.Equal(t, int64(100000), grant.GrantTokens)
	assert.Equal(t, int64(50), grant.GrantCalls)
	assert.Equal(t, 1, grant.PeriodType)

	// 2. Test IncreaseGrantUsedUsage
	err = IncreaseGrantUsedUsage(grant.Id, 10000, 2500, 1)
	require.NoError(t, err)

	require.NoError(t, DB.First(&grant, grant.Id).Error)
	assert.Equal(t, int64(10000), grant.UsedQuota)
	assert.Equal(t, int64(2500), grant.UsedTokens)
	assert.Equal(t, int64(1), grant.UsedCalls)

	require.NoError(t, DB.First(batch, batch.Id).Error)
	assert.Equal(t, int64(10000), batch.UsedQuota)
	assert.Equal(t, int64(2500), batch.UsedTokens)
	assert.Equal(t, int64(1), batch.UsedCalls)

	// 3. Test TryReserveGrantQuota when below limits
	ok, err := TryReserveGrantQuota(grant.Id, batch.Id, 0, 5000)
	require.NoError(t, err)
	assert.True(t, ok)

	// 4. Test Calls limit cutoff
	require.NoError(t, DB.Model(&ModelGrantBatch{}).Where("id = ?", batch.Id).Update("used_calls", 50).Error)
	ok, err = TryReserveGrantQuota(grant.Id, batch.Id, 0, 100)
	require.NoError(t, err)
	assert.False(t, ok, "should reject reservation when calls reached limit")

	// Restore calls and test Tokens limit cutoff
	require.NoError(t, DB.Model(&ModelGrantBatch{}).Where("id = ?", batch.Id).Update("used_calls", 10).Error)
	require.NoError(t, DB.Model(&ModelGrantBatch{}).Where("id = ?", batch.Id).Update("used_tokens", 100000).Error)
	ok, err = TryReserveGrantQuota(grant.Id, batch.Id, 0, 100)
	require.NoError(t, err)
	assert.False(t, ok, "should reject reservation when tokens reached limit")

	// 5. Test Period Reset (simulating yesterday's period_start)
	yesterday := now.AddDate(0, 0, -1).Unix()
	require.NoError(t, DB.Model(&ModelGrantBatch{}).Where("id = ?", batch.Id).Updates(map[string]interface{}{
		"period_start": yesterday,
		"used_quota":   500000,
		"used_tokens":  100000,
		"used_calls":   50,
	}).Error)
	require.NoError(t, DB.Model(&ModelGrant{}).Where("id = ?", grant.Id).Updates(map[string]interface{}{
		"period_start": yesterday,
		"used_quota":   500000,
		"used_tokens":  100000,
		"used_calls":   50,
	}).Error)

	// Next reservation should trigger lazy period reset and succeed!
	ok, err = TryReserveGrantQuota(grant.Id, batch.Id, 0, 1000)
	require.NoError(t, err)
	assert.True(t, ok, "reservation should succeed after period reset")

	require.NoError(t, DB.First(&grant, grant.Id).Error)
	assert.Equal(t, int64(1000), grant.UsedQuota)
	assert.Equal(t, int64(0), grant.UsedTokens)
	assert.Equal(t, int64(0), grant.UsedCalls)

	// 6. Test Period Expiration helper functions directly
	assert.False(t, IsGrantPeriodExpired(0, 1, "day", yesterday, now.Unix()))
	assert.True(t, IsGrantPeriodExpired(1, 1, "day", yesterday, now.Unix()))
	assert.True(t, IsGrantPeriodExpired(3, 2, "hour", now.Add(-3*time.Hour).Unix(), now.Unix()))
	assert.False(t, IsGrantPeriodExpired(3, 2, "hour", now.Add(-1*time.Hour).Unix(), now.Unix()))

	// 7. Test Batch Detail returns multi-metric values
	detail, err := GetModelGrantBatchDetail(batch.Id, false)
	require.NoError(t, err)
	assert.Equal(t, int64(500000), detail.GrantQuota)
	assert.Equal(t, int64(100000), detail.GrantTokens)
	assert.Equal(t, int64(50), detail.GrantCalls)
	assert.Equal(t, 1, detail.PeriodType)
	assert.Equal(t, "day", detail.PeriodUnit)
}
