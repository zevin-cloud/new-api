package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	RequestStatusPending   = 1
	RequestStatusApproved  = 2
	RequestStatusRejected  = 3
	RequestStatusCancelled = 4

	TargetTypeModelSet = 1
	TargetTypeModel    = 2
)

type ModelAccessRequest struct {
	Id            int    `json:"id"`
	UserId        int    `json:"user_id" gorm:"type:int;not null;index"`
	TargetType    int    `json:"target_type" gorm:"type:int;not null;default:1"` // 1: model_set, 2: model
	TargetId      int    `json:"target_id" gorm:"type:int;default:0;index"`      // model_set_id
	TargetName    string `json:"target_name" gorm:"type:varchar(128);not null"`  // model_set name or model name
	Reason        string `json:"reason" gorm:"type:text;not null"`
	Status        int    `json:"status" gorm:"type:int;default:1;index"` // 1: pending, 2: approved, 3: rejected, 4: cancelled
	ReviewerId    int    `json:"reviewer_id" gorm:"type:int;default:0"`
	ReviewedAt    int64  `json:"reviewed_at" gorm:"bigint;default:0"`
	ReviewComment string `json:"review_comment" gorm:"type:text"`
	DurationDays  int    `json:"duration_days" gorm:"type:int;default:0"` // 0 = permanent
	CreatedAt     int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`

	// Non-db response fields
	Username     string `json:"username,omitempty" gorm:"-"`
	DisplayName  string `json:"display_name,omitempty" gorm:"-"`
	Email        string `json:"email,omitempty" gorm:"-"`
	ReviewerName string `json:"reviewer_name,omitempty" gorm:"-"`
}

func (r *ModelAccessRequest) Insert() error {
	if r.UserId <= 0 {
		return errors.New("用户 ID 无效")
	}
	if r.Reason == "" {
		return errors.New("申请理由不能为空")
	}
	if r.TargetType == TargetTypeModelSet && r.TargetId <= 0 {
		return errors.New("目标模型集无效")
	}

	// Check if already has a pending request for same target
	var pendingCount int64
	err := DB.Model(&ModelAccessRequest{}).
		Where("user_id = ? AND target_type = ? AND target_id = ? AND target_name = ? AND status = ?",
			r.UserId, r.TargetType, r.TargetId, r.TargetName, RequestStatusPending).
		Count(&pendingCount).Error
	if err != nil {
		return err
	}
	if pendingCount > 0 {
		return errors.New("您已有该模型（集）的处理中申请，请勿重复提交")
	}

	r.Status = RequestStatusPending
	r.CreatedAt = common.GetTimestamp()
	r.UpdatedAt = common.GetTimestamp()
	return DB.Create(r).Error
}

func ApproveAccessRequest(requestId int, reviewerId int, comment string, durationDays int) error {
	if requestId <= 0 {
		return errors.New("申请单 ID 无效")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var req ModelAccessRequest
		if err := tx.First(&req, requestId).Error; err != nil {
			return err
		}
		if req.Status != RequestStatusPending {
			return errors.New("该申请单已被处理，无法重复审批")
		}

		now := common.GetTimestamp()
		var expiredAt int64
		if durationDays > 0 {
			expiredAt = now + int64(durationDays)*86400
		} else if req.DurationDays > 0 {
			expiredAt = now + int64(req.DurationDays)*86400
		}

		// If TargetType is ModelSet, create or update ModelGrant directly
		if req.TargetType == TargetTypeModelSet && req.TargetId > 0 {
			grant := ModelGrant{
				SubjectType: SubjectTypeUser,
				SubjectId:   req.UserId,
				ModelSetId:  req.TargetId,
				ExpiredAt:   expiredAt,
				GrantedBy:   reviewerId,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := tx.Create(&grant).Error; err != nil {
				return err
			}
		}

		req.Status = RequestStatusApproved
		req.ReviewerId = reviewerId
		req.ReviewedAt = now
		req.ReviewComment = comment
		req.DurationDays = durationDays
		req.UpdatedAt = now

		return tx.Model(&ModelAccessRequest{}).Where("id = ?", req.Id).Updates(map[string]any{
			"status":         req.Status,
			"reviewer_id":    req.ReviewerId,
			"reviewed_at":    req.ReviewedAt,
			"review_comment": req.ReviewComment,
			"duration_days":  req.DurationDays,
			"updated_at":     req.UpdatedAt,
		}).Error
	})
}

func RejectAccessRequest(requestId int, reviewerId int, comment string) error {
	if requestId <= 0 {
		return errors.New("申请单 ID 无效")
	}

	var req ModelAccessRequest
	if err := DB.First(&req, requestId).Error; err != nil {
		return err
	}
	if req.Status != RequestStatusPending {
		return errors.New("该申请单已被处理，无法重复审批")
	}

	now := common.GetTimestamp()
	return DB.Model(&ModelAccessRequest{}).Where("id = ?", requestId).Updates(map[string]any{
		"status":         RequestStatusRejected,
		"reviewer_id":    reviewerId,
		"reviewed_at":    now,
		"review_comment": comment,
		"updated_at":     now,
	}).Error
}

func CancelAccessRequest(requestId int, userId int) error {
	if requestId <= 0 || userId <= 0 {
		return errors.New("参数无效")
	}

	var req ModelAccessRequest
	if err := DB.First(&req, requestId).Error; err != nil {
		return err
	}
	if req.UserId != userId {
		return errors.New("无权撤销他人的申请单")
	}
	if req.Status != RequestStatusPending {
		return errors.New("只能撤销待审批状态的申请单")
	}

	now := time.Now().Unix()
	return DB.Model(&ModelAccessRequest{}).Where("id = ?", requestId).Updates(map[string]any{
		"status":     RequestStatusCancelled,
		"updated_at": now,
	}).Error
}

func GetUserAccessRequests(userId int, page int, pageSize int, status int) ([]*ModelAccessRequest, int64, error) {
	if userId <= 0 {
		return nil, 0, errors.New("用户 ID 无效")
	}

	var requests []*ModelAccessRequest
	var total int64

	tx := DB.Model(&ModelAccessRequest{}).Where("user_id = ?", userId)
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
	err := tx.Order("id DESC").Offset(offset).Limit(pageSize).Find(&requests).Error
	return requests, total, err
}

func GetAccessRequests(page int, pageSize int, status int, targetType int, keyword string) ([]*ModelAccessRequest, int64, error) {
	var requests []*ModelAccessRequest
	var total int64

	tx := DB.Model(&ModelAccessRequest{})
	if status > 0 {
		tx = tx.Where("status = ?", status)
	}
	if targetType > 0 {
		tx = tx.Where("target_type = ?", targetType)
	}
	if keyword != "" {
		tx = tx.Where("target_name LIKE ? OR reason LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}

	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}
	err := tx.Order("id DESC").Offset(offset).Limit(pageSize).Find(&requests).Error
	if err != nil {
		return nil, 0, err
	}

	// Populate user details
	if len(requests) > 0 {
		userIds := make([]int, 0, len(requests))
		for _, r := range requests {
			userIds = append(userIds, r.UserId)
			if r.ReviewerId > 0 {
				userIds = append(userIds, r.ReviewerId)
			}
		}
		var users []User
		_ = DB.Select("id", "username", "display_name", "email").Where("id IN ?", userIds).Find(&users)
		userMap := make(map[int]User)
		for _, u := range users {
			userMap[u.Id] = u
		}
		for _, r := range requests {
			if u, ok := userMap[r.UserId]; ok {
				r.Username = u.Username
				r.DisplayName = u.DisplayName
				r.Email = u.Email
			}
			if rev, ok := userMap[r.ReviewerId]; ok {
				if rev.DisplayName != "" {
					r.ReviewerName = rev.DisplayName
				} else {
					r.ReviewerName = rev.Username
				}
			}
		}
	}

	return requests, total, nil
}
