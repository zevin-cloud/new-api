package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

const (
	SubjectTypeDepartment = 1
	SubjectTypeUserGroup  = 2
	SubjectTypeUser       = 3
)

type ModelGrant struct {
	Id          int   `json:"id"`
	SubjectType int   `json:"subject_type" gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"` // 1: dept, 2: group, 3: user
	SubjectId   int   `json:"subject_id" gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"`
	ModelSetId  int   `json:"model_set_id" gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"`
	ExpiredAt   int64 `json:"expired_at" gorm:"bigint;default:0"` // 0 = never expires
	GrantedBy   int   `json:"granted_by" gorm:"type:int;default:0"`
	CreatedAt   int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64 `json:"updated_at" gorm:"bigint"`

	// Non-db response fields
	SubjectName  string `json:"subject_name,omitempty" gorm:"-"`
	ModelSetName string `json:"model_set_name,omitempty" gorm:"-"`
}

func GrantModelSet(subjectType int, subjectId int, modelSetId int, expiredAt int64, grantedBy int) error {
	if subjectType < SubjectTypeDepartment || subjectType > SubjectTypeUser || subjectId <= 0 || modelSetId <= 0 {
		return errors.New("授权参数无效")
	}

	// Verify model set exists and enabled
	var modelSet ModelSet
	if err := DB.First(&modelSet, modelSetId).Error; err != nil {
		return errors.New("目标模型集不存在")
	}
	if modelSet.Status != ModelSetStatusEnabled {
		return errors.New("目标模型集已禁用")
	}

	now := common.GetTimestamp()
	grant := ModelGrant{
		SubjectType: subjectType,
		SubjectId:   subjectId,
		ModelSetId:  modelSetId,
		ExpiredAt:   expiredAt,
		GrantedBy:   grantedBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "subject_type"},
			{Name: "subject_id"},
			{Name: "model_set_id"},
		},
		DoUpdates: clause.AssignmentColumns([]string{"expired_at", "granted_by", "updated_at"}),
	}).Create(&grant).Error
}

func RevokeModelGrant(grantId int) error {
	if grantId <= 0 {
		return errors.New("授权 ID 无效")
	}
	return DB.Delete(&ModelGrant{}, grantId).Error
}

func RevokeModelGrantBySubjectAndSet(subjectType int, subjectId int, modelSetId int) error {
	if subjectId <= 0 || modelSetId <= 0 {
		return errors.New("主体 ID 或模型集 ID 无效")
	}
	return DB.Where("subject_type = ? AND subject_id = ? AND model_set_id = ?", subjectType, subjectId, modelSetId).Delete(&ModelGrant{}).Error
}

func GetGrantsBySubject(subjectType int, subjectId int) ([]*ModelGrant, error) {
	if subjectId <= 0 {
		return nil, nil
	}
	var grants []*ModelGrant
	err := DB.Where("subject_type = ? AND subject_id = ?", subjectType, subjectId).Find(&grants).Error
	if err != nil {
		return nil, err
	}

	for _, g := range grants {
		var s ModelSet
		if err := DB.Select("name").First(&s, g.ModelSetId).Error; err == nil {
			g.ModelSetName = s.Name
		}
	}
	return grants, nil
}

func GetGrantsByModelSetId(modelSetId int) ([]*ModelGrant, error) {
	if modelSetId <= 0 {
		return nil, nil
	}
	var grants []*ModelGrant
	err := DB.Where("model_set_id = ?", modelSetId).Find(&grants).Error
	if err != nil {
		return nil, err
	}

	for _, g := range grants {
		switch g.SubjectType {
		case SubjectTypeDepartment:
			var dept Department
			if err := DB.Select("name").First(&dept, g.SubjectId).Error; err == nil {
				g.SubjectName = dept.Name
			}
		case SubjectTypeUserGroup:
			var group UserGroup
			if err := DB.Select("name").First(&group, g.SubjectId).Error; err == nil {
				g.SubjectName = group.Name
			}
		case SubjectTypeUser:
			var user User
			if err := DB.Select("username", "display_name").First(&user, g.SubjectId).Error; err == nil {
				if user.DisplayName != "" {
					g.SubjectName = user.DisplayName
				} else {
					g.SubjectName = user.Username
				}
			}
		}
	}
	return grants, nil
}

// GetEffectiveModelSetIdsForUser calculates the union of model sets granted to:
// 1. User's department (and parent departments)
// 2. User's user groups
// 3. User direct grants
func GetEffectiveModelSetIdsForUser(userId int, deptId int, groupIds []int) ([]int, error) {
	if userId <= 0 {
		return nil, nil
	}

	now := common.GetTimestamp()

	// 1. Direct user grants
	query := DB.Model(&ModelGrant{}).
		Where("model_set_id IN (SELECT id FROM model_sets WHERE status = ? AND deleted_at IS NULL)", ModelSetStatusEnabled).
		Where("expired_at = 0 OR expired_at > ?", now)

	var orConditions []string
	var args []any

	// User direct grant
	orConditions = append(orConditions, "(subject_type = ? AND subject_id = ?)")
	args = append(args, SubjectTypeUser, userId)

	// User groups grant
	if len(groupIds) > 0 {
		orConditions = append(orConditions, "(subject_type = ? AND subject_id IN ?)")
		args = append(args, SubjectTypeUserGroup, groupIds)
	}

	// Department grants (including ancestors if any)
	if deptId > 0 {
		deptIds := []int{deptId}
		var dept Department
		if err := DB.Select("id", "path").First(&dept, deptId).Error; err == nil && dept.Path != "" {
			// Extract parent dept IDs from path (e.g. "/1/5")
			for _, part := range strings.Split(dept.Path, "/") {
				if part != "" {
					if pid, err := strconv.Atoi(part); err == nil && pid > 0 {
						deptIds = append(deptIds, pid)
					}
				}
			}
		}
		orConditions = append(orConditions, "(subject_type = ? AND subject_id IN ?)")
		args = append(args, SubjectTypeDepartment, deptIds)
	}

	whereClause := ""
	for i, cond := range orConditions {
		if i == 0 {
			whereClause = cond
		} else {
			whereClause += " OR " + cond
		}
	}

	var modelSetIds []int
	err := query.Where(whereClause, args...).Distinct("model_set_id").Pluck("model_set_id", &modelSetIds).Error
	return modelSetIds, err
}

// GetEffectiveModelNamesForUser resolves all model names a user is currently allowed to invoke.
func GetEffectiveModelNamesForUser(userId int) ([]string, error) {
	if userId <= 0 {
		return nil, nil
	}

	// Get user's department
	var user User
	if err := DB.Select("id", "department_id", "role").First(&user, userId).Error; err != nil {
		return nil, err
	}

	// Root/Admin have access to all enabled models
	if user.Role >= common.RoleAdminUser {
		var allModels []string
		err := DB.Model(&Model{}).Where("status = 1").Pluck("model_name", &allModels).Error
		return allModels, err
	}

	// Get user's user groups
	groupIds, err := GetUserGroupIdsByUserId(userId)
	if err != nil {
		return nil, err
	}

	// Get effective model set IDs
	setIds, err := GetEffectiveModelSetIdsForUser(userId, user.DepartmentId, groupIds)
	if err != nil || len(setIds) == 0 {
		return nil, err
	}

	// Get distinct model names from those model sets
	return GetModelNamesByModelSetIds(setIds)
}
