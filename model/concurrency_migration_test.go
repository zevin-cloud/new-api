package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestConcurrencyMigrationIdempotency(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// Run migration 1st time
	require.NoError(t, db.AutoMigrate(&UserGroup{}, &ModelSet{}, &Model{}))

	// Insert test data
	ug := &UserGroup{
		Name:           "Migration Team",
		MaxConcurrency: 15,
		Status:         UserGroupStatusEnabled,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, db.Create(ug).Error)

	ms := &ModelSet{
		Name:           "Migration Set",
		MaxConcurrency: 25,
		Status:         ModelSetStatusEnabled,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, db.Create(ms).Error)

	m := &Model{
		ModelName:      "migration-model",
		MaxConcurrency: 8,
		Status:         1,
		CreatedTime:    common.GetTimestamp(),
		UpdatedTime:    common.GetTimestamp(),
	}
	require.NoError(t, db.Create(m).Error)

	// Run migration 2nd time (proving idempotency)
	require.NoError(t, db.AutoMigrate(&UserGroup{}, &ModelSet{}, &Model{}))

	// Verify data integrity and values preserved
	var checkUG UserGroup
	require.NoError(t, db.First(&checkUG, ug.Id).Error)
	assert.Equal(t, 15, checkUG.MaxConcurrency)
	assert.Equal(t, "Migration Team", checkUG.Name)

	var checkMS ModelSet
	require.NoError(t, db.First(&checkMS, ms.Id).Error)
	assert.Equal(t, 25, checkMS.MaxConcurrency)
	assert.Equal(t, "Migration Set", checkMS.Name)

	var checkM Model
	require.NoError(t, db.First(&checkM, m.Id).Error)
	assert.Equal(t, 8, checkM.MaxConcurrency)
	assert.Equal(t, "migration-model", checkM.ModelName)
}
