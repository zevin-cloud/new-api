package model

import (
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupEnterpriseTest(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(
		&Department{},
		&UserGroup{},
		&UserGroupMember{},
		&ModelSet{},
		&ModelSetItem{},
		&ModelGrant{},
		&ModelAccessRequest{},
		&ModelAuthAudit{},
		&User{},
		&Model{},
	))
	// Clean tables
	DB.Exec("DELETE FROM departments")
	DB.Exec("DELETE FROM user_groups")
	DB.Exec("DELETE FROM user_group_members")
	DB.Exec("DELETE FROM model_sets")
	DB.Exec("DELETE FROM model_set_items")
	DB.Exec("DELETE FROM model_grants")
	DB.Exec("DELETE FROM model_access_requests")
	DB.Exec("DELETE FROM model_auth_audits")
	DB.Exec("DELETE FROM users")
	DB.Exec("DELETE FROM models")
}

func TestDepartmentCRUDAndHierarchy(t *testing.T) {
	setupEnterpriseTest(t)

	// 1. Create Root Department
	rootDept := &Department{
		Name:        "研发中心",
		Description: "研发一级部门",
		SortOrder:   1,
	}
	require.NoError(t, rootDept.Insert())
	assert.Greater(t, rootDept.Id, 0)
	assert.Equal(t, "", rootDept.Path)

	// 2. Create Child Department
	childDept := &Department{
		Name:        "后端组",
		ParentId:    rootDept.Id,
		Description: "后端研发组",
		SortOrder:   2,
	}
	require.NoError(t, childDept.Insert())
	assert.Greater(t, childDept.Id, 0)
	assert.Equal(t, "/"+strconv.Itoa(rootDept.Id), childDept.Path)

	// 3. Create Grandchild Department
	grandchildDept := &Department{
		Name:        "基础架构组",
		ParentId:    childDept.Id,
		Description: "基础架构子组",
	}
	require.NoError(t, grandchildDept.Insert())
	expectedGrandchildPath := "/" + strconv.Itoa(rootDept.Id) + "/" + strconv.Itoa(childDept.Id)
	assert.Equal(t, expectedGrandchildPath, grandchildDept.Path)

	// 4. Test Tree Construction
	tree, err := GetDepartmentTree()
	require.NoError(t, err)
	require.Len(t, tree, 1)
	assert.Equal(t, "研发中心", tree[0].Name)
	require.Len(t, tree[0].Children, 1)
	assert.Equal(t, "后端组", tree[0].Children[0].Name)
	require.Len(t, tree[0].Children[0].Children, 1)
	assert.Equal(t, "基础架构组", tree[0].Children[0].Children[0].Name)

	// 5. Test Sub-department IDs retrieval
	allSubIds, err := GetDepartmentAndSubIds(rootDept.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []int{rootDept.Id, childDept.Id, grandchildDept.Id}, allSubIds)

	// 6. Test Move validation: cannot move to own sub-department
	rootDept.ParentId = grandchildDept.Id
	assert.Error(t, rootDept.Update())

	// 7. Test Delete Protection: cannot delete parent with sub-departments
	assert.Error(t, DeleteDepartment(rootDept.Id))

	// Delete leaf first
	require.NoError(t, DeleteDepartment(grandchildDept.Id))
	require.NoError(t, DeleteDepartment(childDept.Id))
	require.NoError(t, DeleteDepartment(rootDept.Id))
}

func TestUserGroupAndMembers(t *testing.T) {
	setupEnterpriseTest(t)

	// 1. Create User Group
	group := &UserGroup{
		Name:        "AI 创新项目组",
		Description: "跨部门重点项目组",
	}
	require.NoError(t, group.Insert())
	assert.Greater(t, group.Id, 0)

	// 2. Duplicate Name Protection
	dupGroup := &UserGroup{
		Name: "AI 创新项目组",
	}
	assert.Error(t, dupGroup.Insert())

	// 3. Add Members
	u1 := &User{Username: "alice", Password: "password123", DisplayName: "Alice", AffCode: "aff_alice"}
	u2 := &User{Username: "bob", Password: "password123", DisplayName: "Bob", AffCode: "aff_bob"}
	require.NoError(t, DB.Create(u1).Error)
	require.NoError(t, DB.Create(u2).Error)

	require.NoError(t, AddUsersToGroup(group.Id, []int{u1.Id, u2.Id}))

	// 4. Query Members
	members, total, err := GetGroupMembers(group.Id, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, members, 2)

	// 5. Query user's groups
	groupIds, err := GetUserGroupIdsByUserId(u1.Id)
	require.NoError(t, err)
	assert.Equal(t, []int{group.Id}, groupIds)

	// 6. Remove member
	require.NoError(t, RemoveUsersFromGroup(group.Id, []int{u2.Id}))
	members, total, err = GetGroupMembers(group.Id, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)

	// 7. Delete group
	require.NoError(t, DeleteUserGroup(group.Id))
}

func TestModelSetAndItems(t *testing.T) {
	setupEnterpriseTest(t)

	// 1. Create Model Set
	set := &ModelSet{
		Name:        "基础模型集",
		Description: "包含日常基础模型",
	}
	require.NoError(t, set.Insert())
	assert.Greater(t, set.Id, 0)

	// 2. Add Models to Set
	models := []string{"deepseek-v3", "qwen3-32b", "text-embedding-v3"}
	require.NoError(t, AddModelsToModelSet(set.Id, models))

	// 3. Query Models
	fetchedModels, err := GetModelNamesByModelSetId(set.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, models, fetchedModels)

	// 4. Set Models override
	newModels := []string{"deepseek-v3", "gpt-4.1"}
	require.NoError(t, SetModelSetModels(set.Id, newModels))
	fetchedModels, err = GetModelNamesByModelSetId(set.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, newModels, fetchedModels)
}

func TestModelGrantAndEffectivePermissions(t *testing.T) {
	setupEnterpriseTest(t)

	// 1. Setup Department hierarchy: Tech -> Backend
	techDept := &Department{Name: "技术中心"}
	require.NoError(t, techDept.Insert())
	backendDept := &Department{Name: "后端部", ParentId: techDept.Id}
	require.NoError(t, backendDept.Insert())

	// 2. Setup User Groups: AI Group
	aiGroup := &UserGroup{Name: "AI 专家组"}
	require.NoError(t, aiGroup.Insert())

	// 3. Setup Model Sets: Set1 (Basic), Set2 (Advanced), Set3 (Direct)
	set1 := &ModelSet{Name: "基础模型集"}
	require.NoError(t, set1.Insert())
	require.NoError(t, AddModelsToModelSet(set1.Id, []string{"deepseek-v3", "qwen3-32b"}))

	set2 := &ModelSet{Name: "高级模型集"}
	require.NoError(t, set2.Insert())
	require.NoError(t, AddModelsToModelSet(set2.Id, []string{"claude-sonnet", "gpt-4.1"}))

	set3 := &ModelSet{Name: "特别授权集"}
	require.NoError(t, set3.Insert())
	require.NoError(t, AddModelsToModelSet(set3.Id, []string{"o3-mini"}))

	// 4. Setup User belonging to Backend Dept and AI Group
	user := &User{
		Username:     "developer1",
		Password:     "password123",
		Role:         common.RoleCommonUser,
		DepartmentId: backendDept.Id,
		AffCode:      "aff_dev1",
	}
	require.NoError(t, DB.Create(user).Error)
	require.NoError(t, AddUserToGroup(aiGroup.Id, user.Id))

	// 5. Grant Set1 to Parent Dept (Tech Center) -> user should inherit through Backend Dept
	require.NoError(t, GrantModelSet(SubjectTypeDepartment, techDept.Id, set1.Id, 0, 1))

	// 6. Grant Set2 to User Group (AI Group) -> user should inherit through group
	require.NoError(t, GrantModelSet(SubjectTypeUserGroup, aiGroup.Id, set2.Id, 0, 1))

	// 7. Grant Set3 directly to User
	require.NoError(t, GrantModelSet(SubjectTypeUser, user.Id, set3.Id, 0, 1))

	// 8. Calculate Effective Models (Union of all 3)
	effectiveModels, err := GetEffectiveModelNamesForUser(user.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{
		"deepseek-v3", "qwen3-32b", // from Tech Dept
		"claude-sonnet", "gpt-4.1", // from AI Group
		"o3-mini", // from Direct User Grant
	}, effectiveModels)

	// 9. Test Expired Grant
	expiredSet := &ModelSet{Name: "过期模型集"}
	require.NoError(t, expiredSet.Insert())
	require.NoError(t, AddModelsToModelSet(expiredSet.Id, []string{"expired-model"}))
	// Granted with past expiration time
	pastTime := time.Now().Unix() - 100
	require.NoError(t, GrantModelSet(SubjectTypeUser, user.Id, expiredSet.Id, pastTime, 1))

	// Expired model should NOT be in effective models
	effectiveModels, err = GetEffectiveModelNamesForUser(user.Id)
	require.NoError(t, err)
	assert.NotContains(t, effectiveModels, "expired-model")

	// 10. Test Revoke Grant
	require.NoError(t, RevokeModelGrantBySubjectAndSet(SubjectTypeUser, user.Id, set3.Id))
	effectiveModels, err = GetEffectiveModelNamesForUser(user.Id)
	require.NoError(t, err)
	assert.NotContains(t, effectiveModels, "o3-mini")

	// 11. Test Delete Protection on ModelSet while granted
	assert.Error(t, DeleteModelSet(set1.Id))
}

func TestModelAccessRequestWorkflow(t *testing.T) {
	setupEnterpriseTest(t)

	u := &User{Username: "applicant", Password: "password123", AffCode: "aff_app1"}
	require.NoError(t, DB.Create(u).Error)

	set := &ModelSet{Name: "高级推理模型集"}
	require.NoError(t, set.Insert())
	require.NoError(t, AddModelsToModelSet(set.Id, []string{"o3-mini", "claude-sonnet"}))

	// 1. Submit Request
	req := &ModelAccessRequest{
		UserId:       u.Id,
		TargetType:   TargetTypeModelSet,
		TargetId:     set.Id,
		TargetName:   set.Name,
		Reason:       "项目研发需要使用高级推理模型",
		DurationDays: 30,
	}
	require.NoError(t, req.Insert())
	assert.Greater(t, req.Id, 0)
	assert.Equal(t, RequestStatusPending, req.Status)

	// 2. Duplicate Pending Check
	dupReq := &ModelAccessRequest{
		UserId:     u.Id,
		TargetType: TargetTypeModelSet,
		TargetId:   set.Id,
		TargetName: set.Name,
		Reason:     "重复申请",
	}
	assert.Error(t, dupReq.Insert())

	// 3. Approve Request -> Automatically creates ModelGrant
	reviewerId := 1
	require.NoError(t, ApproveAccessRequest(req.Id, reviewerId, "审批通过", 30))

	// Verify request status
	var updatedReq ModelAccessRequest
	require.NoError(t, DB.First(&updatedReq, req.Id).Error)
	assert.Equal(t, RequestStatusApproved, updatedReq.Status)
	assert.Equal(t, reviewerId, updatedReq.ReviewerId)
	assert.Equal(t, "审批通过", updatedReq.ReviewComment)

	// Verify ModelGrant was created
	grants, err := GetGrantsBySubject(SubjectTypeUser, u.Id)
	require.NoError(t, err)
	require.Len(t, grants, 1)
	assert.Equal(t, set.Id, grants[0].ModelSetId)
	assert.Greater(t, grants[0].ExpiredAt, common.GetTimestamp())

	// Verify User has model access
	models, err := GetEffectiveModelNamesForUser(u.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"o3-mini", "claude-sonnet"}, models)
}

func TestModelAuthAudit(t *testing.T) {
	setupEnterpriseTest(t)

	// Record audit
	require.NoError(t, RecordAuthAudit(1, "grant_created", "model_set", 10, map[string]any{
		"target_user_id": 5,
		"model_set_id":   10,
	}))

	// Query audits
	audits, total, err := GetAuthAudits(1, 10, "model_set", 10, 1)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, audits, 1)
	assert.Equal(t, "grant_created", audits[0].Action)
}
