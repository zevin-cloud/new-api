package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	ModelSetStatusEnabled  = 1
	ModelSetStatusDisabled = 2
)

type ModelSet struct {
	Id          int            `json:"id"`
	Name        string         `json:"name" gorm:"type:varchar(64);not null;index"`
	Description string         `json:"description" gorm:"type:text"`
	Status      int            `json:"status" gorm:"type:int;default:1"`
	CreatedBy   int            `json:"created_by" gorm:"type:int;default:0"`
	CreatedAt   int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// Non-db response fields
	ModelCount      int      `json:"model_count,omitempty" gorm:"-"`
	DepartmentCount int      `json:"department_count,omitempty" gorm:"-"`
	UserGroupCount  int      `json:"user_group_count,omitempty" gorm:"-"`
	UserCount       int      `json:"user_count,omitempty" gorm:"-"`
	Models          []string `json:"models,omitempty" gorm:"-"`
}

func (s *ModelSet) Insert() error {
	var count int64
	if err := DB.Model(&ModelSet{}).Where("name = ?", s.Name).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("模型集名称已存在")
	}

	s.CreatedAt = common.GetTimestamp()
	s.UpdatedAt = common.GetTimestamp()
	if s.Status == 0 {
		s.Status = ModelSetStatusEnabled
	}
	return DB.Create(s).Error
}

func (s *ModelSet) Update() error {
	var count int64
	if err := DB.Model(&ModelSet{}).Where("name = ? AND id != ?", s.Name, s.Id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("模型集名称已存在")
	}

	s.UpdatedAt = common.GetTimestamp()
	return DB.Model(s).Where("id = ?", s.Id).Updates(map[string]any{
		"name":        s.Name,
		"description": s.Description,
		"status":      s.Status,
		"updated_at":  s.UpdatedAt,
	}).Error
}

func DeleteModelSet(id int) error {
	if id <= 0 {
		return errors.New("模型集 ID 无效")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		// Check for active model grants
		var grantCount int64
		if err := tx.Model(&ModelGrant{}).Where("model_set_id = ?", id).Count(&grantCount).Error; err != nil {
			return err
		}
		if grantCount > 0 {
			return errors.New("该模型集仍被部门、用户组或用户授权引用，请先撤销相关授权")
		}

		// Check for pending access requests
		var pendingRequestCount int64
		if err := tx.Model(&ModelAccessRequest{}).Where("target_type = ? AND target_id = ? AND status = ?", TargetTypeModelSet, id, RequestStatusPending).Count(&pendingRequestCount).Error; err != nil {
			return err
		}
		if pendingRequestCount > 0 {
			return errors.New("该模型集存在未处理的权限申请单，请先处理")
		}

		// Delete model items
		if err := tx.Where("model_set_id = ?", id).Delete(&ModelSetItem{}).Error; err != nil {
			return err
		}

		return tx.Delete(&ModelSet{}, id).Error
	})
}

func GetModelSetById(id int) (*ModelSet, error) {
	if id <= 0 {
		return nil, errors.New("模型集 ID 无效")
	}
	var s ModelSet
	err := DB.First(&s, id).Error
	if err != nil {
		return nil, err
	}

	// Populate models
	models, _ := GetModelNamesByModelSetId(id)
	s.Models = models
	s.ModelCount = len(models)

	// Populate grant counts
	var deptCount, groupCount, userCount int64
	_ = DB.Model(&ModelGrant{}).Where("model_set_id = ? AND subject_type = ?", id, SubjectTypeDepartment).Count(&deptCount)
	_ = DB.Model(&ModelGrant{}).Where("model_set_id = ? AND subject_type = ?", id, SubjectTypeUserGroup).Count(&groupCount)
	_ = DB.Model(&ModelGrant{}).Where("model_set_id = ? AND subject_type = ?", id, SubjectTypeUser).Count(&userCount)
	s.DepartmentCount = int(deptCount)
	s.UserGroupCount = int(groupCount)
	s.UserCount = int(userCount)

	return &s, nil
}

func GetModelSets(page int, pageSize int, keyword string, status int) ([]*ModelSet, int64, error) {
	var sets []*ModelSet
	var total int64

	tx := DB.Model(&ModelSet{}).Where("name NOT LIKE ? AND description != ?", "直接授权模型集-%", "由直接模型授权生成的模型集")
	if keyword != "" {
		tx = tx.Where("name LIKE ? OR description LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if status > 0 {
		tx = tx.Where("status = ?", status)
	}

	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}
	err := tx.Order("id DESC").Offset(offset).Limit(pageSize).Find(&sets).Error
	if err != nil {
		return nil, 0, err
	}

	for _, s := range sets {
		models, _ := GetModelNamesByModelSetId(s.Id)
		s.Models = models
		s.ModelCount = len(models)

		var deptCount, groupCount, userCount int64
		_ = DB.Model(&ModelGrant{}).Where("model_set_id = ? AND subject_type = ?", s.Id, SubjectTypeDepartment).Count(&deptCount)
		_ = DB.Model(&ModelGrant{}).Where("model_set_id = ? AND subject_type = ?", s.Id, SubjectTypeUserGroup).Count(&groupCount)
		_ = DB.Model(&ModelGrant{}).Where("model_set_id = ? AND subject_type = ?", s.Id, SubjectTypeUser).Count(&userCount)
		s.DepartmentCount = int(deptCount)
		s.UserGroupCount = int(groupCount)
		s.UserCount = int(userCount)
	}

	return sets, total, nil
}
