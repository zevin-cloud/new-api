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
	_, err := g.UpdateWithMembers(nil)
	return err
}

// UpdateWithMembers commits group settings and membership together and returns
// every user whose cached permissions may have changed, including former members.
func (g *UserGroup) UpdateWithMembers(userIds *[]int) ([]int, error) {
	var affected []int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current UserGroup
		if err := lockForUpdate(tx).First(&current, g.Id).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&UserGroup{}).Where("name = ? AND id != ?", g.Name, g.Id).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errors.New("用户组名称已存在")
		}
		if err := tx.Model(&UserGroupMember{}).Where("group_id = ?", g.Id).Pluck("user_id", &affected).Error; err != nil {
			return err
		}
		if g.Status == 0 {
			g.Status = current.Status
		}
		if g.Status != UserGroupStatusEnabled && g.Status != UserGroupStatusDisabled {
			return errors.New("用户组状态无效")
		}
		g.UpdatedAt = common.GetTimestamp()
		if err := tx.Model(g).Updates(map[string]any{
			"name": g.Name, "description": g.Description, "status": g.Status, "updated_at": g.UpdatedAt,
		}).Error; err != nil {
			return err
		}
		if userIds == nil {
			return nil
		}
		seen := make(map[int]bool)
		members := make([]UserGroupMember, 0, len(*userIds))
		for _, id := range *userIds {
			if id <= 0 {
				return errors.New("用户 ID 无效")
			}
			if seen[id] {
				continue
			}
			seen[id] = true
			members = append(members, UserGroupMember{GroupId: g.Id, UserId: id, CreatedAt: g.UpdatedAt})
			affected = append(affected, id)
		}
		if len(members) > 0 {
			if err := tx.Model(&User{}).Where("id IN ?", *userIds).Count(&count).Error; err != nil {
				return err
			}
			if count != int64(len(members)) {
				return errors.New("部分用户不存在")
			}
		}
		if err := tx.Where("group_id = ?", g.Id).Delete(&UserGroupMember{}).Error; err != nil {
			return err
		}
		if len(members) > 0 {
			return tx.Create(&members).Error
		}
		return nil
	})
	return affected, err
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
