package model

import (
	"github.com/QuantumNous/new-api/common"
)

type ModelAuthAudit struct {
	Id          int64  `json:"id"`
	ActorUserId int    `json:"actor_user_id" gorm:"type:int;not null;index"`
	Action      string `json:"action" gorm:"type:varchar(64);not null;index"` // e.g. "grant_created", "grant_revoked", "member_added", "member_removed", "request_approved", "request_rejected"
	TargetType  string `json:"target_type" gorm:"type:varchar(32);not null;index"` // "department", "user_group", "user", "model_set", "request"
	TargetId    int    `json:"target_id" gorm:"type:int;not null;index"`
	Details     string `json:"details" gorm:"type:text"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`

	// Non-db response fields
	ActorUsername    string `json:"actor_username,omitempty" gorm:"-"`
	ActorDisplayName string `json:"actor_display_name,omitempty" gorm:"-"`
}

func RecordAuthAudit(actorUserId int, action string, targetType string, targetId int, details any) error {
	var detailsStr string
	if details != nil {
		if s, ok := details.(string); ok {
			detailsStr = s
		} else {
			data, err := common.Marshal(details)
			if err == nil {
				detailsStr = string(data)
			}
		}
	}

	audit := ModelAuthAudit{
		ActorUserId: actorUserId,
		Action:      action,
		TargetType:  targetType,
		TargetId:    targetId,
		Details:     detailsStr,
		CreatedAt:   common.GetTimestamp(),
	}

	return DB.Create(&audit).Error
}

func GetAuthAudits(page int, pageSize int, targetType string, targetId int, actorUserId int) ([]*ModelAuthAudit, int64, error) {
	var audits []*ModelAuthAudit
	var total int64

	tx := DB.Model(&ModelAuthAudit{})
	if targetType != "" {
		tx = tx.Where("target_type = ?", targetType)
	}
	if targetId > 0 {
		tx = tx.Where("target_id = ?", targetId)
	}
	if actorUserId > 0 {
		tx = tx.Where("actor_user_id = ?", actorUserId)
	}

	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}
	err := tx.Order("id DESC").Offset(offset).Limit(pageSize).Find(&audits).Error
	if err != nil {
		return nil, 0, err
	}

	if len(audits) > 0 {
		actorIds := make([]int, len(audits))
		for i, a := range audits {
			actorIds[i] = a.ActorUserId
		}
		var users []User
		_ = DB.Select("id", "username", "display_name").Where("id IN ?", actorIds).Find(&users)
		userMap := make(map[int]User)
		for _, u := range users {
			userMap[u.Id] = u
		}
		for _, a := range audits {
			if u, ok := userMap[a.ActorUserId]; ok {
				a.ActorUsername = u.Username
				a.ActorDisplayName = u.DisplayName
			}
		}
	}

	return audits, total, nil
}
