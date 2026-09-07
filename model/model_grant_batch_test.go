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
	batch, err := CreateModelGrantBatch("研发模型专属授权", subjects, []int{set.Id}, []string{"shared-model"}, "", "vip", 1, 100000, 0, 5, 0, 1)
	require.NoError(t, err)
	views, total, err := GetModelGrantBatches(1, 10, 0, 0, 0, 0, "")
	require.NoError(t, err)
	require.Len(t, views, 1)
	assert.EqualValues(t, 1, total)
	assert.Equal(t, "研发模型专属授权", views[0].Name)
	assert.Equal(t, "vip", views[0].RoutingGroup)
	assert.Equal(t, 5, views[0].MaxConcurrency)
	assert.Equal(t, 1, views[0].QuotaType)
	assert.EqualValues(t, 100000, views[0].GrantQuota)
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
	// Search by grant batch name keyword
	viewsByName, totalByName, err := GetModelGrantBatches(1, 10, 0, 0, 0, 0, "专属授权")
	require.NoError(t, err)
	assert.EqualValues(t, 1, totalByName)
	assert.Equal(t, "研发模型专属授权", viewsByName[0].Name)

	detail, err := GetModelGrantBatchDetail(batch.Id, false)
	require.NoError(t, err)
	assert.Equal(t, "研发模型专属授权", detail.Name)

	second, err := CreateModelGrantBatch("", subjects[2:], []int{set.Id}, nil, "", "", 0, 0, 0, 0, 0, 1)
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
	_, err := CreateModelGrantBatch("", []ModelGrantSubject{{SubjectTypeUser, user.Id}}, []int{set.Id, 99999}, []string{"direct-model"}, "temporary", "", 0, 0, 0, 0, 0, 1)
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
	batch, err := CreateModelGrantBatch("部门与个人授权", []ModelGrantSubject{
		{Type: SubjectTypeDepartment, Id: dept.Id},
		{Type: SubjectTypeUser, Id: user2.Id},
	}, []int{set.Id}, []string{"claude-3-5-sonnet"}, "Adhoc", "dedicated", 0, 0, 0, 10, 0, 1)
	require.NoError(t, err)

	detail, err := GetModelGrantBatchDetail(batch.Id, false)
	require.NoError(t, err)
	assert.Equal(t, batch.Id, detail.BatchId)
	assert.Equal(t, "部门与个人授权", detail.Name)
	assert.Equal(t, "dedicated", detail.RoutingGroup)
	assert.Equal(t, 10, detail.MaxConcurrency)
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

func TestGetEffectiveGrantPolicyForUser(t *testing.T) {
	setupModelGrantTestDB(t)
	dept := Department{Name: "DevDept", Status: DepartmentStatusEnabled}
	require.NoError(t, dept.Insert())
	user := User{Username: "charlie", DepartmentId: dept.Id, Status: common.UserStatusEnabled, AffCode: "CHARLIE1"}
	require.NoError(t, DB.Create(&user).Error)

	setDept := ModelSet{Name: "DeptSet", Status: ModelSetStatusEnabled}
	require.NoError(t, DB.Create(&setDept).Error)
	require.NoError(t, AddModelsToModelSet(setDept.Id, []string{"gpt-4o"}))

	setUser := ModelSet{Name: "UserSet", Status: ModelSetStatusEnabled}
	require.NoError(t, DB.Create(&setUser).Error)
	require.NoError(t, AddModelsToModelSet(setUser.Id, []string{"gpt-4o", "claude-3-5-sonnet"}))

	// 1. Dept grant has routing_group="dept_pool", max_concurrency=2
	_, err := CreateModelGrantBatch("", []ModelGrantSubject{{Type: SubjectTypeDepartment, Id: dept.Id}}, []int{setDept.Id}, nil, "", "dept_pool", 0, 0, 0, 2, 0, 1)
	require.NoError(t, err)

	policy, err := GetEffectiveGrantPolicyForUser(user.Id, "gpt-4o")
	require.NoError(t, err)
	require.NotNil(t, policy)
	assert.Equal(t, "dept_pool", policy.RoutingGroup)
	assert.Equal(t, 2, policy.MaxConcurrency)

	// 2. User direct grant has routing_group="vip_direct", max_concurrency=10
	_, err = CreateModelGrantBatch("", []ModelGrantSubject{{Type: SubjectTypeUser, Id: user.Id}}, []int{setUser.Id}, nil, "", "vip_direct", 1, 50000, 0, 10, 0, 1)
	require.NoError(t, err)

	// Direct user grant must take priority over dept grant
	policy, err = GetEffectiveGrantPolicyForUser(user.Id, "gpt-4o")
	require.NoError(t, err)
	require.NotNil(t, policy)
	assert.Equal(t, "vip_direct", policy.RoutingGroup)
	assert.Equal(t, 10, policy.MaxConcurrency)
	assert.Equal(t, 1, policy.QuotaType)
	assert.EqualValues(t, 50000, policy.GrantQuota)

	// claude-3-5-sonnet only in user grant
	policyClaude, err := GetEffectiveGrantPolicyForUser(user.Id, "claude-3-5-sonnet")
	require.NoError(t, err)
	require.NotNil(t, policyClaude)
	assert.Equal(t, "vip_direct", policyClaude.RoutingGroup)

	// ungranted model returns nil
	policyNone, err := GetEffectiveGrantPolicyForUser(user.Id, "gemini-1.5-pro")
	require.NoError(t, err)
	assert.Nil(t, policyNone)
}

func TestModelGrantBatchQuotaScope(t *testing.T) {
	setupModelGrantTestDB(t)
	dept := Department{Name: "SharedDept", Status: DepartmentStatusEnabled}
	require.NoError(t, dept.Insert())
	user1 := User{Username: "user1", DepartmentId: dept.Id, Status: common.UserStatusEnabled, AffCode: "U1"}
	user2 := User{Username: "user2", DepartmentId: dept.Id, Status: common.UserStatusEnabled, AffCode: "U2"}
	require.NoError(t, DB.Create(&user1).Error)
	require.NoError(t, DB.Create(&user2).Error)

	set := ModelSet{Name: "ScopeSet", Status: ModelSetStatusEnabled}
	require.NoError(t, DB.Create(&set).Error)
	require.NoError(t, AddModelsToModelSet(set.Id, []string{"scoped-model"}))

	// 1. QuotaScope = 0 (Shared Pool): dept gets 1 grant, members share it
	batchShared, err := CreateModelGrantBatch(
		"",
		[]ModelGrantSubject{{Type: SubjectTypeDepartment, Id: dept.Id}},
		[]int{set.Id},
		nil,
		"",
		"shared_pool",
		1,
		100000,
		0, // shared
		0,
		0,
		1,
	)
	require.NoError(t, err)
	assert.Equal(t, 0, batchShared.QuotaScope)

	detailShared, err := GetModelGrantBatchDetail(batchShared.Id, false)
	require.NoError(t, err)
	assert.Equal(t, 0, detailShared.QuotaScope)
	assert.Len(t, detailShared.Subjects, 1)

	// Consume quota on grant
	var sharedGrant ModelGrant
	require.NoError(t, DB.Where("batch_id = ?", batchShared.Id).First(&sharedGrant).Error)
	require.NoError(t, IncreaseGrantUsedQuota(sharedGrant.Id, 30000))

	policy1, err := GetEffectiveGrantPolicyForUser(user1.Id, "scoped-model")
	require.NoError(t, err)
	require.NotNil(t, policy1)
	assert.EqualValues(t, 30000, policy1.UsedQuota)

	policy2, err := GetEffectiveGrantPolicyForUser(user2.Id, "scoped-model")
	require.NoError(t, err)
	require.NotNil(t, policy2)
	assert.EqualValues(t, 30000, policy2.UsedQuota) // Both users see 30000 used

	// Revoke shared batch
	_, err = RevokeModelGrantBatch(batchShared.Id)
	require.NoError(t, err)

	// 2. QuotaScope = 1 (Per-Member Cap): dept is expanded to user1 and user2
	batchPerMember, err := CreateModelGrantBatch(
		"",
		[]ModelGrantSubject{{Type: SubjectTypeDepartment, Id: dept.Id}},
		[]int{set.Id},
		nil,
		"",
		"per_member_pool",
		1,
		50000,
		1, // per-member
		0,
		0,
		1,
	)
	require.NoError(t, err)
	assert.Equal(t, 1, batchPerMember.QuotaScope)

	// Check grants in batch: both user1 and user2 got individual user grants
	var userGrants []ModelGrant
	require.NoError(t, DB.Where("batch_id = ?", batchPerMember.Id).Order("subject_id ASC").Find(&userGrants).Error)
	require.Len(t, userGrants, 2)
	assert.Equal(t, SubjectTypeUser, userGrants[0].SubjectType)
	assert.Equal(t, user1.Id, userGrants[0].SubjectId)
	assert.Equal(t, SubjectTypeUser, userGrants[1].SubjectType)
	assert.Equal(t, user2.Id, userGrants[1].SubjectId)
	assert.Equal(t, 1, userGrants[0].QuotaScope)
	assert.Equal(t, 1, userGrants[1].QuotaScope)

	// User1 consumes quota
	require.NoError(t, IncreaseGrantUsedQuota(userGrants[0].Id, 20000))

	pUser1, err := GetEffectiveGrantPolicyForUser(user1.Id, "scoped-model")
	require.NoError(t, err)
	assert.EqualValues(t, 20000, pUser1.UsedQuota)

	pUser2, err := GetEffectiveGrantPolicyForUser(user2.Id, "scoped-model")
	require.NoError(t, err)
	assert.EqualValues(t, 0, pUser2.UsedQuota) // User2's quota is unaffected!
}

