package model

import (
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupModelGrantTestDB(t *testing.T) {
	t.Helper()
	previousDB, previousType := DB, common.MainDatabaseType()
	var dialector gorm.Dialector = sqlite.Open(":memory:")
	databaseType := common.DatabaseTypeSQLite
	switch os.Getenv("MODEL_GRANT_TEST_DIALECT") {
	case "mysql":
		dialector = mysql.Open("root@tcp(127.0.0.1:13306)/model_grant_test?charset=utf8mb4&parseTime=True&loc=Local")
		databaseType = common.DatabaseTypeMySQL
	case "postgres":
		dialector = postgres.Open("host=127.0.0.1 port=15432 user=postgres dbname=model_grant_test sslmode=disable")
		databaseType = common.DatabaseTypePostgreSQL
	case "", "sqlite":
	default:
		t.Fatal("unsupported MODEL_GRANT_TEST_DIALECT")
	}
	db, err := gorm.Open(dialector, &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	// These fixed loopback databases are disposable test instances only.
	if databaseType != common.DatabaseTypeSQLite {
		require.NoError(t, db.Migrator().DropTable(&ModelGrant{}, &ModelGrantBatch{}, &ModelSetItem{}, &ModelSet{}, &UserGroupMember{}, &UserGroup{}, &Department{}, &User{}, &Model{}))
	}
	DB = db
	common.SetMainDatabaseType(databaseType)
	initCol()
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		initCol()
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&User{}, &Department{}, &UserGroup{}, &UserGroupMember{}, &ModelSet{}, &ModelSetItem{}, &ModelGrant{}, &ModelGrantBatch{}, &Model{}))
}

func TestDisabledOrganizationDoesNotGrantModels(t *testing.T) {
	for _, subjectType := range []int{SubjectTypeUserGroup, SubjectTypeDepartment} {
		t.Run(map[int]string{SubjectTypeUserGroup: "group", SubjectTypeDepartment: "department"}[subjectType], func(t *testing.T) {
			setupModelGrantTestDB(t)
			user := User{Username: "member", Role: common.RoleCommonUser}
			require.NoError(t, DB.Create(&user).Error)
			set := ModelSet{Name: "research", Status: ModelSetStatusEnabled}
			require.NoError(t, set.Insert())
			require.NoError(t, AddModelsToModelSet(set.Id, []string{"research-model"}))
			var subjectID int
			if subjectType == SubjectTypeUserGroup {
				group := UserGroup{Name: "researchers", Status: UserGroupStatusDisabled}
				require.NoError(t, group.Insert())
				subjectID = group.Id
				require.NoError(t, AddUserToGroup(group.Id, user.Id))
			} else {
				dept := Department{Name: "research", Status: DepartmentStatusDisabled}
				require.NoError(t, dept.Insert())
				subjectID = dept.Id
				require.NoError(t, DB.Model(&user).Update("department_id", dept.Id).Error)
			}
			// Existing grants must cease to apply when their subject is disabled.
			require.NoError(t, DB.Create(&ModelGrant{SubjectType: subjectType, SubjectId: subjectID, ModelSetId: set.Id}).Error)
			models, err := GetEffectiveModelNamesForUser(user.Id)
			require.NoError(t, err)
			assert.Empty(t, models)
		})
	}
}

func TestGrantKeywordSearchMatchesSubjectAndModelSet(t *testing.T) {
	setupModelGrantTestDB(t)
	alice := User{Username: "alice", DisplayName: "Alice Research", Role: common.RoleCommonUser, AffCode: "alice"}
	bob := User{Username: "bob", Role: common.RoleCommonUser, AffCode: "bob"}
	require.NoError(t, DB.Create(&alice).Error)
	require.NoError(t, DB.Create(&bob).Error)
	set := ModelSet{Name: "Research Models"}
	require.NoError(t, set.Insert())
	require.NoError(t, GrantModelSet(SubjectTypeUser, alice.Id, set.Id, 0, 1))
	require.NoError(t, GrantModelSet(SubjectTypeUser, bob.Id, set.Id, 0, 1))
	for _, tc := range []struct {
		keyword string
		count   int
	}{{"Alice Research", 1}, {"Research Models", 2}, {"missing", 0}} {
		t.Run(tc.keyword, func(t *testing.T) {
			grants, total, err := GetModelGrants(1, 10, 0, 0, 0, 0, tc.keyword)
			require.NoError(t, err)
			assert.EqualValues(t, tc.count, total)
			assert.Len(t, grants, tc.count)
		})
	}
}

func TestEditingUserPersistsOrganizationFields(t *testing.T) {
	setupModelGrantTestDB(t)
	dept := Department{Name: "research"}
	require.NoError(t, dept.Insert())
	user := User{Username: "member", Group: "default", Role: common.RoleCommonUser}
	require.NoError(t, DB.Create(&user).Error)
	user.DepartmentId, user.EmployeeId = dept.Id, "R-17"
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error { return user.EditWithTx(tx, false) }))
	var saved User
	require.NoError(t, DB.First(&saved, user.Id).Error)
	assert.Equal(t, dept.Id, saved.DepartmentId)
	assert.Equal(t, "R-17", saved.EmployeeId)
}

func TestOrganizationEditsPreservePathsAndUpdateMembersAtomically(t *testing.T) {
	setupModelGrantTestDB(t)
	parent := Department{Name: "parent"}
	require.NoError(t, parent.Insert())
	child := Department{Name: "child", ParentId: parent.Id}
	require.NoError(t, child.Insert())
	update := Department{Id: child.Id, Name: "renamed", ParentId: parent.Id, Status: DepartmentStatusEnabled}
	require.NoError(t, update.Update())
	saved, err := GetDepartmentById(child.Id)
	require.NoError(t, err)
	assert.Equal(t, child.Path, saved.Path)
	user := User{Username: "member", AffCode: "member"}
	require.NoError(t, DB.Create(&user).Error)
	group := UserGroup{Name: "team"}
	require.NoError(t, group.Insert())
	require.NoError(t, AddUserToGroup(group.Id, user.Id))
	invalidMembers := []int{999999}
	group.Name = "should roll back"
	_, err = group.UpdateWithMembers(&invalidMembers)
	require.Error(t, err)
	savedGroup, err := GetUserGroupById(group.Id)
	require.NoError(t, err)
	assert.Equal(t, "team", savedGroup.Name)
	members, total, err := GetGroupMembers(group.Id, 1, 10)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	assert.Equal(t, user.Id, members[0].UserId)
	empty := []int{}
	group.Name = "team"
	affected, err := group.UpdateWithMembers(&empty)
	require.NoError(t, err)
	assert.Contains(t, affected, user.Id)
	_, total, err = GetGroupMembers(group.Id, 1, 10)
	require.NoError(t, err)
	assert.Zero(t, total)
}
