package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	UserGroupStatusEnabled  = 1
	UserGroupStatusDisabled = 2
)

type UserGroup struct {
	Id          int            `json:"id"`
	Name        string         `json:"name" gorm:"type:varchar(64);not null;index"`
	Description string         `json:"description" gorm:"type:text"`
	Status      int            `json:"status" gorm:"type:int;default:1"`
	CreatedBy   int            `json:"created_by" gorm:"type:int;default:0"`
	CreatedAt   int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// Non-db response fields
	MemberCount int `json:"member_count,omitempty" gorm:"-"`
	GrantCount  int `json:"grant_count,omitempty" gorm:"-"`
}

func (g *UserGroup) Insert() error {
	var count int64
	if err := DB.Model(&UserGroup{}).Where("name = ?", g.Name).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("用户组名称已存在")
	}

	g.CreatedAt = common.GetTimestamp()
	g.UpdatedAt = common.GetTimestamp()
	if g.Status == 0 {
		g.Status = UserGroupStatusEnabled
	}
	return DB.Create(g).Error
}

func (g *UserGroup) Update() error {
	var count int64
	if err := DB.Model(&UserGroup{}).Where("name = ? AND id != ?", g.Name, g.Id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("用户组名称已存在")
	}

	g.UpdatedAt = common.GetTimestamp()
	return DB.Model(g).Where("id = ?", g.Id).Updates(map[string]any{
		"name":        g.Name,
		"description": g.Description,
		"status":      g.Status,
		"updated_at":  g.UpdatedAt,
	}).Error
}

func DeleteUserGroup(id int) error {
	if id <= 0 {
		return errors.New("用户组 ID 无效")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		// Check for active model grants
		var grantCount int64
		if err := tx.Model(&ModelGrant{}).Where("subject_type = ? AND subject_id = ?", SubjectTypeUserGroup, id).Count(&grantCount).Error; err != nil {
			return err
		}
		if grantCount > 0 {
			return errors.New("该用户组仍有关联的模型授权，请先撤销相关授权")
		}

		// Delete group members
		if err := tx.Where("group_id = ?", id).Delete(&UserGroupMember{}).Error; err != nil {
			return err
		}

		return tx.Delete(&UserGroup{}, id).Error
	})
}

func GetUserGroupById(id int) (*UserGroup, error) {
	if id <= 0 {
		return nil, errors.New("用户组 ID 无效")
	}
	var g UserGroup
	err := DB.First(&g, id).Error
	return &g, err
}

func GetUserGroups(page int, pageSize int, keyword string, status int) ([]*UserGroup, int64, error) {
	var groups []*UserGroup
	var total int64

	tx := DB.Model(&UserGroup{})
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
	err := tx.Order("id DESC").Offset(offset).Limit(pageSize).Find(&groups).Error
	if err != nil {
		return nil, 0, err
	}

	// Populate member count and grant count
	for _, g := range groups {
		var memberCount int64
		_ = DB.Model(&UserGroupMember{}).Where("group_id = ?", g.Id).Count(&memberCount)
		g.MemberCount = int(memberCount)

		var grantCount int64
		_ = DB.Model(&ModelGrant{}).Where("subject_type = ? AND subject_id = ?", SubjectTypeUserGroup, g.Id).Count(&grantCount)
		g.GrantCount = int(grantCount)
	}

	return groups, total, nil
}
