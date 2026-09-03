package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

// The authorization schema immediately before batches were introduced (2549ec6).
// Released upstream v1.0.0-rc.26 has no authorization tables; its upgrade path is
// also covered by the fresh-table migration case below.
type legacyModelGrant struct {
	Id          int
	SubjectType int   `gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"`
	SubjectId   int   `gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"`
	ModelSetId  int   `gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"`
	ExpiredAt   int64 `gorm:"bigint;default:0"`
	GrantedBy   int   `gorm:"type:int;default:0"`
	CreatedAt   int64 `gorm:"bigint"`
	UpdatedAt   int64 `gorm:"bigint"`
}

func (legacyModelGrant) TableName() string { return "model_grants" }

func TestModelGrantMigrationPreservesLegacyAndUniqueness(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		t.Run(map[bool]string{false: "fresh", true: "upgrade"}[legacy], func(t *testing.T) {
			setupModelGrantTestDB(t)
			var version string
			versionQuery := "SELECT version()"
			if DB.Dialector.Name() == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, DB.Raw(versionQuery).Scan(&version).Error)
			t.Logf("migration database: %s %s", DB.Dialector.Name(), version)
			require.NoError(t, DB.Migrator().DropTable(&ModelGrant{}, &ModelGrantBatch{}))
			if legacy {
				require.NoError(t, DB.AutoMigrate(&legacyModelGrant{}))
				require.NoError(t, DB.Create(&legacyModelGrant{Id: 41, SubjectType: 3, SubjectId: 9, ModelSetId: 7, ExpiredAt: 1234, GrantedBy: 2, CreatedAt: 100, UpdatedAt: 101}).Error)
			}
			for range 2 {
				require.NoError(t, DB.AutoMigrate(&ModelGrant{}, &ModelGrantBatch{}))
			}
			assert.True(t, DB.Migrator().HasIndex(&ModelGrant{}, "uk_grant_subject_set"))
			assert.True(t, DB.Migrator().HasIndex(&ModelGrant{}, "idx_model_grants_batch_id"))
			if legacy {
				var saved ModelGrant
				require.NoError(t, DB.First(&saved, 41).Error)
				assert.Equal(t, 0, saved.BatchId)
				assert.EqualValues(t, 1234, saved.ExpiredAt)
				assert.EqualValues(t, 100, saved.CreatedAt)
				assert.Equal(t, 2, saved.GrantedBy)
				assert.Error(t, DB.Create(&ModelGrant{SubjectType: 3, SubjectId: 9, ModelSetId: 7}).Error)
			}
		})
	}
}

func TestModelGrantBatchSubmissionRegrantAndRevocation(t *testing.T) {
	setupModelGrantTestDB(t)
	user := User{Username: "alice", DisplayName: "Alice", AffCode: "alice", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	dept := Department{Name: "Research"}
	require.NoError(t, dept.Insert())
	group := UserGroup{Name: "Researchers"}
	require.NoError(t, group.Insert())
	require.NoError(t, AddUserToGroup(group.Id, user.Id))
	set := ModelSet{Name: "Research models"}
	require.NoError(t, set.Insert())
	require.NoError(t, AddModelsToModelSet(set.Id, []string{"shared-model", "other-model"}))
	subjects := []ModelGrantSubject{{SubjectTypeDepartment, dept.Id}, {SubjectTypeUserGroup, group.Id}, {SubjectTypeUser, user.Id}}
	batch, err := CreateModelGrantBatch(subjects, []int{set.Id}, []string{"shared-model"}, "", 0, 1)
	require.NoError(t, err)
	views, total, err := GetModelGrantBatches(1, 10, 0, 0, 0, 0, "")
	require.NoError(t, err)
	require.Len(t, views, 1)
	assert.EqualValues(t, 1, total)
	assert.Len(t, views[0].Grants, 6)
	directCount := 0
	for _, grant := range views[0].Grants {
		if grant.DirectModels {
			directCount++
		}
	}
	assert.Equal(t, 3, directCount)
	// A matching detail finds the whole submission, so bulk actions are explicit.
	views, total, err = GetModelGrantBatches(1, 1, SubjectTypeUser, user.Id, set.Id, 1, "Alice")
	require.NoError(t, err)
	require.Len(t, views, 1)
	assert.EqualValues(t, 1, total)
	assert.Len(t, views[0].Grants, 6)
	second, err := CreateModelGrantBatch(subjects[2:], []int{set.Id}, nil, "", 0, 1)
	require.NoError(t, err)
	require.NotEqual(t, batch.Id, second.Id)
	removed, err := RevokeModelGrantBatch(batch.Id)
	require.NoError(t, err)
	assert.Len(t, removed, 5)
	names, err := GetEffectiveModelNamesForUser(user.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"shared-model", "other-model"}, names)
	_, err = RevokeModelGrantBatch(second.Id)
	require.NoError(t, err)
	names, err = GetEffectiveModelNamesForUser(user.Id)
	require.NoError(t, err)
	assert.Empty(t, names)
}

func TestModelGrantBatchRollbackAndLegacyPagination(t *testing.T) {
	setupModelGrantTestDB(t)
	user := User{Username: "alice", AffCode: "alice", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	set := ModelSet{Name: "Research models"}
	require.NoError(t, set.Insert())
	_, err := CreateModelGrantBatch([]ModelGrantSubject{{SubjectTypeUser, user.Id}}, []int{set.Id, 99999}, []string{"direct-model"}, "temporary", 0, 1)
	require.Error(t, err)
	for _, table := range []any{&ModelGrant{}, &ModelGrantBatch{}} {
		var count int64
		require.NoError(t, DB.Model(table).Count(&count).Error)
		assert.Zero(t, count)
	}
	var count int64
	require.NoError(t, DB.Model(&ModelSet{}).Count(&count).Error)
	assert.EqualValues(t, 1, count)
	for _, subjectType := range []int{SubjectTypeUser, SubjectTypeDepartment} {
		require.NoError(t, DB.Create(&ModelGrant{SubjectType: subjectType, SubjectId: user.Id, ModelSetId: set.Id, CreatedAt: 10, UpdatedAt: 10}).Error)
	}
	first, total, err := GetModelGrantBatches(1, 1, 0, 0, 0, 0, "")
	require.NoError(t, err)
	require.Len(t, first, 1)
	assert.EqualValues(t, 2, total)
	assert.Zero(t, first[0].BatchId)
	second, _, err := GetModelGrantBatches(2, 1, 0, 0, 0, 0, "")
	require.NoError(t, err)
	require.Len(t, second, 1)
	assert.NotEqual(t, first[0].Id, second[0].Id)
}

func TestModelGrantBatchDetailUnionUsers(t *testing.T) {
	setupModelGrantTestDB(t)
	dept := Department{Name: "Engineering", Status: DepartmentStatusEnabled}
	require.NoError(t, dept.Insert())
	user1 := User{Username: "alice", DisplayName: "Alice", DepartmentId: dept.Id, Status: common.UserStatusEnabled, AffCode: "ALICE123"}
	require.NoError(t, DB.Create(&user1).Error)
	user2 := User{Username: "bob", DisplayName: "Bob", DepartmentId: 0, Status: common.UserStatusEnabled, AffCode: "BOB12345"}
	require.NoError(t, DB.Create(&user2).Error)
	group := UserGroup{Name: "VIP", Status: UserGroupStatusEnabled}
	require.NoError(t, group.Insert())
	_, err := group.UpdateWithMembers(&[]int{user1.Id, user2.Id})
	require.NoError(t, err)

	set := ModelSet{Name: "BaseModels", Status: ModelSetStatusEnabled}
	require.NoError(t, DB.Create(&set).Error)
	require.NoError(t, AddModelsToModelSet(set.Id, []string{"gpt-4o"}))

	// Batch grants to department and user2
	batch, err := CreateModelGrantBatch([]ModelGrantSubject{
		{Type: SubjectTypeDepartment, Id: dept.Id},
		{Type: SubjectTypeUser, Id: user2.Id},
	}, []int{set.Id}, []string{"claude-3-5-sonnet"}, "Adhoc", 0, 1)
	require.NoError(t, err)

	detail, err := GetModelGrantBatchDetail(batch.Id, false)
	require.NoError(t, err)
	assert.Equal(t, batch.Id, detail.BatchId)
	assert.Len(t, detail.Subjects, 2)
	assert.Equal(t, 2, detail.TotalUsers)
	assert.Contains(t, detail.Models, "gpt-4o")
	assert.Contains(t, detail.Models, "claude-3-5-sonnet")

	// Verify Alice was included via Engineering
	var aliceFound, bobFound bool
	for _, u := range detail.UnionUsers {
		if u.Id == user1.Id {
			aliceFound = true
			assert.Contains(t, u.Sources, "部门: Engineering")
		}
		if u.Id == user2.Id {
			bobFound = true
			assert.Contains(t, u.Sources, "直接授权")
		}
	}
	assert.True(t, aliceFound)
	assert.True(t, bobFound)
}

