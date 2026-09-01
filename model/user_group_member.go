package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserGroupMember struct {
	Id        int   `json:"id"`
	GroupId   int   `json:"group_id" gorm:"type:int;not null;index;uniqueIndex:uk_group_user"`
	UserId    int   `json:"user_id" gorm:"type:int;not null;index;uniqueIndex:uk_group_user"`
	CreatedAt int64 `json:"created_at" gorm:"bigint"`

	// Non-db response fields
	Username    string `json:"username,omitempty" gorm:"-"`
	DisplayName string `json:"display_name,omitempty" gorm:"-"`
	Email       string `json:"email,omitempty" gorm:"-"`
	EmployeeId  string `json:"employee_id,omitempty" gorm:"-"`
}

func AddUserToGroup(groupId int, userId int) error {
	if groupId <= 0 || userId <= 0 {
		return errors.New("用户组 ID 或用户 ID 无效")
	}

	member := UserGroupMember{
		GroupId:   groupId,
		UserId:    userId,
		CreatedAt: common.GetTimestamp(),
	}

	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&member).Error
}

func AddUsersToGroup(groupId int, userIds []int) error {
	if groupId <= 0 || len(userIds) == 0 {
		return nil
	}

	now := common.GetTimestamp()
	members := make([]UserGroupMember, 0, len(userIds))
	for _, uid := range userIds {
		if uid > 0 {
			members = append(members, UserGroupMember{
				GroupId:   groupId,
				UserId:    uid,
				CreatedAt: now,
			})
		}
	}
	if len(members) == 0 {
		return nil
	}

	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&members).Error
}

func RemoveUsersFromGroup(groupId int, userIds []int) error {
	if groupId <= 0 || len(userIds) == 0 {
		return nil
	}
	return DB.Where("group_id = ? AND user_id IN ?", groupId, userIds).Delete(&UserGroupMember{}).Error
}

func SetGroupMembers(groupId int, userIds []int) error {
	if groupId <= 0 {
		return errors.New("用户组 ID 无效")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("group_id = ?", groupId).Delete(&UserGroupMember{}).Error; err != nil {
			return err
		}

		if len(userIds) == 0 {
			return nil
		}

		now := common.GetTimestamp()
		members := make([]UserGroupMember, 0, len(userIds))
		for _, uid := range userIds {
			if uid > 0 {
				members = append(members, UserGroupMember{
					GroupId:   groupId,
					UserId:    uid,
					CreatedAt: now,
				})
			}
		}
		if len(members) > 0 {
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&members).Error
		}
		return nil
	})
}

func GetGroupMembers(groupId int, page int, pageSize int) ([]*UserGroupMember, int64, error) {
	if groupId <= 0 {
		return nil, 0, errors.New("用户组 ID 无效")
	}

	var members []*UserGroupMember
	var total int64

	tx := DB.Model(&UserGroupMember{}).Where("group_id = ?", groupId)
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}
	if err := tx.Order("id DESC").Offset(offset).Limit(pageSize).Find(&members).Error; err != nil {
		return nil, 0, err
	}

	if len(members) > 0 {
		userIds := make([]int, len(members))
		for i, m := range members {
			userIds[i] = m.UserId
		}
		var users []User
		_ = DB.Select("id", "username", "display_name", "email", "employee_id").Where("id IN ?", userIds).Find(&users)
		userMap := make(map[int]User)
		for _, u := range users {
			userMap[u.Id] = u
		}
		for _, m := range members {
			if u, ok := userMap[m.UserId]; ok {
				m.Username = u.Username
				m.DisplayName = u.DisplayName
				m.Email = u.Email
				m.EmployeeId = u.EmployeeId
			}
		}
	}

	return members, total, nil
}

func GetUserGroupIdsByUserId(userId int) ([]int, error) {
	if userId <= 0 {
		return nil, nil
	}
	var groupIds []int
	err := DB.Model(&UserGroupMember{}).Where("user_id = ?", userId).Pluck("group_id", &groupIds).Error
	return groupIds, err
}

func GetUserGroupsByUserId(userId int) ([]*UserGroup, error) {
	groupIds, err := GetUserGroupIdsByUserId(userId)
	if err != nil || len(groupIds) == 0 {
		return nil, err
	}
	var groups []*UserGroup
	err = DB.Where("id IN ? AND status = ?", groupIds, UserGroupStatusEnabled).Find(&groups).Error
	return groups, err
}
