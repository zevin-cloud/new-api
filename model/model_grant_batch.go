package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ModelGrantBatch identifies one administrator submission. The existing unique
// subject/set binding remains authoritative; regranting transfers that binding
// to the new batch, so revoking an older batch cannot revoke a newer grant.
type ModelGrantBatch struct {
	Id               int    `json:"id"`
	Name             string `json:"name" gorm:"type:varchar(128);not null;default:''"`
	GrantedBy        int    `json:"granted_by"`
	CreatedAt        int64  `json:"created_at"`
	DirectModelSetId int    `json:"direct_model_set_id"`
	RoutingGroup     string `json:"routing_group" gorm:"type:varchar(64);not null;default:''"`
	QuotaType        int    `json:"quota_type" gorm:"type:int;not null;default:0"`
	QuotaScope       int    `json:"quota_scope" gorm:"type:int;not null;default:0"`
	GrantQuota       int64  `json:"grant_quota" gorm:"type:bigint;not null;default:0"`
	UsedQuota        int64  `json:"used_quota" gorm:"type:bigint;not null;default:0"`
	GrantTokens      int64  `json:"grant_tokens" gorm:"type:bigint;not null;default:0"`
	UsedTokens       int64  `json:"used_tokens" gorm:"type:bigint;not null;default:0"`
	GrantCalls       int64  `json:"grant_calls" gorm:"type:bigint;not null;default:0"`
	UsedCalls        int64  `json:"used_calls" gorm:"type:bigint;not null;default:0"`
	PeriodType       int    `json:"period_type" gorm:"type:int;not null;default:0"`
	PeriodInterval   int    `json:"period_interval" gorm:"type:int;not null;default:1"`
	PeriodUnit       string `json:"period_unit" gorm:"type:varchar(16);not null;default:'day'"`
	PeriodStart      int64  `json:"period_start" gorm:"type:bigint;not null;default:0"`
	MaxConcurrency   int    `json:"max_concurrency" gorm:"type:int;not null;default:0"`
}

type ModelGrantSubject struct {
	Type int
	Id   int
}

type ModelGrantBatchView struct {
	Id             string        `json:"id"`
	BatchId        int           `json:"batch_id"`
	Name           string        `json:"name"`
	CreatedAt      int64         `json:"created_at"`
	RoutingGroup   string        `json:"routing_group"`
	QuotaType      int           `json:"quota_type"`
	QuotaScope     int           `json:"quota_scope"`
	GrantQuota     int64         `json:"grant_quota"`
	UsedQuota      int64         `json:"used_quota"`
	GrantTokens    int64         `json:"grant_tokens"`
	UsedTokens     int64         `json:"used_tokens"`
	GrantCalls     int64         `json:"grant_calls"`
	UsedCalls      int64         `json:"used_calls"`
	PeriodType     int           `json:"period_type"`
	PeriodInterval int           `json:"period_interval"`
	PeriodUnit     string        `json:"period_unit"`
	PeriodStart    int64         `json:"period_start"`
	MaxConcurrency int           `json:"max_concurrency"`
	Grants         []*ModelGrant `json:"grants"`
}

type CreateModelGrantBatchInput struct {
	Name           string
	Subjects       []ModelGrantSubject
	SetIds         []int
	ModelNames     []string
	CustomSetName  string
	RoutingGroup   string
	QuotaType      int
	QuotaScope     int
	GrantQuota     int64
	GrantTokens    int64
	GrantCalls     int64
	PeriodType     int
	PeriodInterval int
	PeriodUnit     string
	MaxConcurrency int
	ExpiresAt      int64
	ActorId        int
}

func CreateModelGrantBatch(name string, subjects []ModelGrantSubject, setIds []int, modelNames []string, customSetName string, routingGroup string, quotaType int, grantQuota int64, quotaScope int, maxConcurrency int, expiresAt int64, actorId int) (*ModelGrantBatch, error) {
	return CreateModelGrantBatchEx(CreateModelGrantBatchInput{
		Name:           name,
		Subjects:       subjects,
		SetIds:         setIds,
		ModelNames:     modelNames,
		CustomSetName:  customSetName,
		RoutingGroup:   routingGroup,
		QuotaType:      quotaType,
		GrantQuota:     grantQuota,
		QuotaScope:     quotaScope,
		MaxConcurrency: maxConcurrency,
		ExpiresAt:      expiresAt,
		ActorId:        actorId,
	})
}

func CreateModelGrantBatchEx(input CreateModelGrantBatchInput) (*ModelGrantBatch, error) {
	if len(input.Subjects) == 0 || len(input.SetIds)+len(input.ModelNames) == 0 {
		return nil, errors.New("请选择授权主体与模型资源")
	}
	if input.ExpiresAt < 0 || (input.ExpiresAt != 0 && input.ExpiresAt <= common.GetTimestamp()) {
		return nil, errors.New("过期时间必须晚于当前时间")
	}
	input.Name = strings.TrimSpace(input.Name)
	if utf8.RuneCountInString(input.Name) > 128 {
		return nil, errors.New("授权名称不能超过 128 个字符")
	}
	input.CustomSetName = strings.TrimSpace(input.CustomSetName)
	if utf8.RuneCountInString(input.CustomSetName) > 64 {
		return nil, errors.New("模型集名称不能超过 64 个字符")
	}
	models := make([]string, 0, len(input.ModelNames))
	seenModels := make(map[string]bool)
	for _, name := range input.ModelNames {
		name = strings.TrimSpace(name)
		if name == "" || utf8.RuneCountInString(name) > 128 {
			return nil, errors.New("模型名称不能为空且不能超过 128 个字符")
		}
		if !seenModels[name] {
			models = append(models, name)
			seenModels[name] = true
		}
	}
	// Lock shared resources in a stable order for concurrent submissions.
	setIds := append([]int(nil), input.SetIds...)
	sort.Ints(setIds)
	subjects := append([]ModelGrantSubject(nil), input.Subjects...)
	sort.Slice(subjects, func(i, j int) bool {
		if subjects[i].Type != subjects[j].Type {
			return subjects[i].Type < subjects[j].Type
		}
		return subjects[i].Id < subjects[j].Id
	})

	if input.PeriodInterval <= 0 {
		input.PeriodInterval = 1
	}
	if input.PeriodUnit == "" {
		input.PeriodUnit = "day"
	}
	periodStart := int64(0)
	if input.PeriodType > 0 {
		periodStart = CalculatePeriodStart(input.PeriodType, input.PeriodInterval, input.PeriodUnit, time.Unix(common.GetTimestamp(), 0))
	}
	if input.GrantQuota > 0 || input.GrantTokens > 0 || input.GrantCalls > 0 {
		input.QuotaType = 1
	}

	batch := &ModelGrantBatch{
		Name:           input.Name,
		GrantedBy:      input.ActorId,
		CreatedAt:      common.GetTimestamp(),
		RoutingGroup:   input.RoutingGroup,
		QuotaType:      input.QuotaType,
		QuotaScope:     input.QuotaScope,
		GrantQuota:     input.GrantQuota,
		GrantTokens:    input.GrantTokens,
		GrantCalls:     input.GrantCalls,
		PeriodType:     input.PeriodType,
		PeriodInterval: input.PeriodInterval,
		PeriodUnit:     input.PeriodUnit,
		PeriodStart:    periodStart,
		MaxConcurrency: input.MaxConcurrency,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		for _, subject := range subjects {
			if subject.Id <= 0 {
				return errors.New("授权主体无效")
			}
			var count int64
			var query *gorm.DB
			switch subject.Type {
			case SubjectTypeUser:
				query = tx.Model(&User{}).Where("status = ?", common.UserStatusEnabled)
			case SubjectTypeUserGroup:
				query = tx.Model(&UserGroup{}).Where("status = ?", UserGroupStatusEnabled)
			case SubjectTypeDepartment:
				query = tx.Model(&Department{}).Where("status = ?", DepartmentStatusEnabled)
			default:
				return errors.New("授权主体类型无效")
			}
			if err := query.Where("id = ?", subject.Id).Count(&count).Error; err != nil {
				return err
			}
			if count != 1 {
				return errors.New("授权主体不存在或已禁用")
			}
		}
		for _, id := range setIds {
			var set ModelSet
			if id <= 0 {
				return errors.New("目标模型集无效")
			}
			if err := lockForUpdate(tx).First(&set, id).Error; err != nil {
				return errors.New("目标模型集不存在")
			}
			if set.Status != ModelSetStatusEnabled {
				return errors.New("目标模型集已禁用")
			}
		}
		if len(models) > 0 {
			name := input.CustomSetName
			if name == "" {
				name = "直接授权模型集-" + uuid.NewString()
			}
			var count int64
			if err := tx.Model(&ModelSet{}).Where("name = ?", name).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return errors.New("模型集名称已存在")
			}
			set := ModelSet{Name: name, Description: "由直接模型授权生成的模型集", Status: ModelSetStatusEnabled, CreatedBy: input.ActorId, CreatedAt: batch.CreatedAt, UpdatedAt: batch.CreatedAt}
			if err := tx.Create(&set).Error; err != nil {
				return err
			}
			items := make([]ModelSetItem, 0, len(models))
			for _, name := range models {
				items = append(items, ModelSetItem{ModelSetId: set.Id, ModelName: name, CreatedAt: batch.CreatedAt})
			}
			if err := tx.Create(&items).Error; err != nil {
				return err
			}
			batch.DirectModelSetId = set.Id
			setIds = append(setIds, set.Id)
		}
		if err := tx.Create(batch).Error; err != nil {
			return err
		}

		effectiveSubjects := subjects
		if input.QuotaScope == 1 {
			// Per-member cap mode: expand department and user group subjects to member users
			userSet := make(map[int]bool)
			for _, subject := range subjects {
				switch subject.Type {
				case SubjectTypeUser:
					userSet[subject.Id] = true
				case SubjectTypeUserGroup:
					var uids []int
					_ = tx.Model(&UserGroupMember{}).Where("group_id = ?", subject.Id).Pluck("user_id", &uids)
					for _, uid := range uids {
						userSet[uid] = true
					}
				case SubjectTypeDepartment:
					subIds := []int{subject.Id}
					var dept Department
					if err := tx.First(&dept, subject.Id).Error; err == nil {
						prefix := fmt.Sprintf("%s/%d", dept.Path, dept.Id)
						var childrenIds []int
						_ = tx.Model(&Department{}).
							Where("id = ? OR path = ? OR path LIKE ?", dept.Id, prefix, prefix+"/%").
							Pluck("id", &childrenIds)
						if len(childrenIds) > 0 {
							subIds = childrenIds
						}
					}
					var uids []int
					_ = tx.Model(&User{}).Where("department_id IN ? AND status = ?", subIds, common.UserStatusEnabled).Pluck("id", &uids)
					for _, uid := range uids {
						userSet[uid] = true
					}
				}
			}
			if len(userSet) > 0 {
				effectiveSubjects = make([]ModelGrantSubject, 0, len(userSet))
				for uid := range userSet {
					effectiveSubjects = append(effectiveSubjects, ModelGrantSubject{Type: SubjectTypeUser, Id: uid})
				}
				sort.Slice(effectiveSubjects, func(i, j int) bool {
					return effectiveSubjects[i].Id < effectiveSubjects[j].Id
				})
			}
		}

		for _, setId := range setIds {
			for _, subject := range effectiveSubjects {
				grant := ModelGrant{
					BatchId:        batch.Id,
					SubjectType:    subject.Type,
					SubjectId:      subject.Id,
					ModelSetId:     setId,
					RoutingGroup:   input.RoutingGroup,
					QuotaType:      input.QuotaType,
					QuotaScope:     input.QuotaScope,
					GrantQuota:     input.GrantQuota,
					GrantTokens:    input.GrantTokens,
					GrantCalls:     input.GrantCalls,
					PeriodType:     input.PeriodType,
					PeriodInterval: input.PeriodInterval,
					PeriodUnit:     input.PeriodUnit,
					PeriodStart:    periodStart,
					MaxConcurrency: input.MaxConcurrency,
					ExpiredAt:      input.ExpiresAt,
					GrantedBy:      input.ActorId,
					CreatedAt:      batch.CreatedAt,
					UpdatedAt:      batch.CreatedAt,
				}
				if err := tx.Clauses(clause.OnConflict{
					Columns: []clause.Column{{Name: "subject_type"}, {Name: "subject_id"}, {Name: "model_set_id"}},
					DoUpdates: clause.AssignmentColumns([]string{
						"batch_id", "routing_group", "quota_type", "quota_scope", "grant_quota", "grant_tokens", "grant_calls", "period_type", "period_interval", "period_unit", "period_start", "max_concurrency", "expired_at", "granted_by", "updated_at",
					}),
				}).Create(&grant).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	return batch, err
}

func GetModelGrantBatches(page, pageSize, subjectType, subjectId, modelSetId, status int, keyword string) ([]ModelGrantBatchView, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	// Legacy rows have no submission ID. Keep each one separate rather than
	// guessing a batch from equal timestamps or matching permissions.
	const groupBy = "batch_id, CASE WHEN batch_id = 0 THEN id ELSE 0 END"
	query := filteredModelGrants(subjectType, subjectId, modelSetId, status, keyword).
		Select("batch_id, CASE WHEN batch_id = 0 THEN id ELSE 0 END AS legacy_id, MAX(updated_at) AS last_update").Group(groupBy)
	var total int64
	if err := DB.Table("(?) AS grant_batches", query).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var groups []struct {
		BatchId    int
		LegacyId   int
		LastUpdate int64
	}
	if err := query.Order("last_update DESC, batch_id DESC, legacy_id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&groups).Error; err != nil {
		return nil, 0, err
	}
	if len(groups) == 0 {
		return []ModelGrantBatchView{}, total, nil
	}
	batchIds, legacyIds := make([]int, 0), make([]int, 0)
	for _, group := range groups {
		if group.BatchId > 0 {
			batchIds = append(batchIds, group.BatchId)
		} else {
			legacyIds = append(legacyIds, group.LegacyId)
		}
	}
	var grants []*ModelGrant
	if err := DB.Where("batch_id IN ? OR id IN ?", batchIds, legacyIds).Order("id ASC").Find(&grants).Error; err != nil {
		return nil, 0, err
	}
	populateGrantDetails(grants)
	var batches []ModelGrantBatch
	if len(batchIds) > 0 {
		if err := DB.Where("id IN ?", batchIds).Find(&batches).Error; err != nil {
			return nil, 0, err
		}
	}
	metadata := make(map[int]ModelGrantBatch, len(batches))
	for _, batch := range batches {
		metadata[batch.Id] = batch
	}
	byKey := make(map[string][]*ModelGrant)
	for _, grant := range grants {
		key := fmt.Sprintf("grant_%d", grant.Id)
		if grant.BatchId > 0 {
			key = fmt.Sprintf("batch_%d", grant.BatchId)
			grant.DirectModels = metadata[grant.BatchId].DirectModelSetId == grant.ModelSetId
		}
		byKey[key] = append(byKey[key], grant)
	}
	views := make([]ModelGrantBatchView, 0, len(groups))
	for _, group := range groups {
		key := fmt.Sprintf("grant_%d", group.LegacyId)
		createdAt := group.LastUpdate
		routingGroup := ""
		quotaType := 0
		quotaScope := 0
		grantQuota := int64(0)
		usedQuota := int64(0)
		grantTokens := int64(0)
		usedTokens := int64(0)
		grantCalls := int64(0)
		usedCalls := int64(0)
		periodType := 0
		periodInterval := 1
		periodUnit := "day"
		periodStart := int64(0)
		maxConcurrency := 0
		name := ""
		if group.BatchId > 0 {
			key = fmt.Sprintf("batch_%d", group.BatchId)
			b := metadata[group.BatchId]
			name = b.Name
			createdAt = b.CreatedAt
			routingGroup = b.RoutingGroup
			quotaType = b.QuotaType
			quotaScope = b.QuotaScope
			grantQuota = b.GrantQuota
			usedQuota = b.UsedQuota
			grantTokens = b.GrantTokens
			usedTokens = b.UsedTokens
			grantCalls = b.GrantCalls
			usedCalls = b.UsedCalls
			periodType = b.PeriodType
			periodInterval = b.PeriodInterval
			periodUnit = b.PeriodUnit
			periodStart = b.PeriodStart
			maxConcurrency = b.MaxConcurrency
		}
		if routingGroup == "" && len(byKey[key]) > 0 {
			routingGroup = byKey[key][0].RoutingGroup
			quotaType = byKey[key][0].QuotaType
			quotaScope = byKey[key][0].QuotaScope
			grantQuota = byKey[key][0].GrantQuota
			usedQuota = byKey[key][0].UsedQuota
			grantTokens = byKey[key][0].GrantTokens
			usedTokens = byKey[key][0].UsedTokens
			grantCalls = byKey[key][0].GrantCalls
			usedCalls = byKey[key][0].UsedCalls
			periodType = byKey[key][0].PeriodType
			periodInterval = byKey[key][0].PeriodInterval
			periodUnit = byKey[key][0].PeriodUnit
			periodStart = byKey[key][0].PeriodStart
			maxConcurrency = byKey[key][0].MaxConcurrency
		}
		if usedQuota == 0 && len(byKey[key]) > 0 {
			for _, g := range byKey[key] {
				usedQuota += g.UsedQuota
				usedTokens += g.UsedTokens
				usedCalls += g.UsedCalls
			}
		}
		views = append(views, ModelGrantBatchView{
			Id:             key,
			BatchId:        group.BatchId,
			Name:           name,
			CreatedAt:      createdAt,
			RoutingGroup:   routingGroup,
			QuotaType:      quotaType,
			QuotaScope:     quotaScope,
			GrantQuota:     grantQuota,
			UsedQuota:      usedQuota,
			GrantTokens:    grantTokens,
			UsedTokens:     usedTokens,
			GrantCalls:     grantCalls,
			UsedCalls:      usedCalls,
			PeriodType:     periodType,
			PeriodInterval: periodInterval,
			PeriodUnit:     periodUnit,
			PeriodStart:    periodStart,
			MaxConcurrency: maxConcurrency,
			Grants:         byKey[key],
		})
	}
	return views, total, nil
}

func RevokeModelGrantBatch(id int) ([]ModelGrant, error) {
	if id <= 0 {
		return nil, errors.New("授权批次无效")
	}
	var grants []ModelGrant
	err := DB.Transaction(func(tx *gorm.DB) error {
		var batch ModelGrantBatch
		if err := lockForUpdate(tx).First(&batch, id).Error; err != nil {
			return err
		}
		if err := lockForUpdate(tx).Where("batch_id = ?", id).Find(&grants).Error; err != nil {
			return err
		}
		if err := tx.Where("batch_id = ?", id).Delete(&ModelGrant{}).Error; err != nil {
			return err
		}
		if batch.DirectModelSetId > 0 {
			_ = tx.Where("model_set_id = ?", batch.DirectModelSetId).Delete(&ModelSetItem{}).Error
			_ = tx.Delete(&ModelSet{}, batch.DirectModelSetId).Error
		}
		return tx.Delete(&batch).Error
	})
	return grants, err
}

type ModelGrantBatchDetail struct {
	BatchId        int                       `json:"batch_id"`
	Name           string                    `json:"name"`
	IsLegacy       bool                      `json:"is_legacy"`
	CreatedAt      int64                     `json:"created_at"`
	GrantedBy      int                       `json:"granted_by"`
	ExpiredAt      int64                     `json:"expired_at"`
	RoutingGroup   string                    `json:"routing_group"`
	QuotaType      int                       `json:"quota_type"`
	QuotaScope     int                       `json:"quota_scope"`
	GrantQuota     int64                     `json:"grant_quota"`
	UsedQuota      int64                     `json:"used_quota"`
	GrantTokens    int64                     `json:"grant_tokens"`
	UsedTokens     int64                     `json:"used_tokens"`
	GrantCalls     int64                     `json:"grant_calls"`
	UsedCalls      int64                     `json:"used_calls"`
	PeriodType     int                       `json:"period_type"`
	PeriodInterval int                       `json:"period_interval"`
	PeriodUnit     string                    `json:"period_unit"`
	PeriodStart    int64                     `json:"period_start"`
	MaxConcurrency int                       `json:"max_concurrency"`
	Subjects       []ModelGrantSubjectDetail `json:"subjects"`
	ModelSets      []ModelSetBrief           `json:"model_sets"`
	Models         []string                  `json:"models"`
	UnionUsers     []UnionAuthorizedUser     `json:"union_users"`
	TotalUsers     int                       `json:"total_users"`
	TotalModels    int                       `json:"total_models"`
}

type ModelGrantSubjectDetail struct {
	Type int    `json:"type"`
	Id   int    `json:"id"`
	Name string `json:"name"`
}

type ModelSetBrief struct {
	Id           int      `json:"id"`
	Name         string   `json:"name"`
	DirectModels bool     `json:"direct_models"`
	Models       []string `json:"models"`
}

type UnionAuthorizedUser struct {
	Id             int      `json:"id"`
	Username       string   `json:"username"`
	DisplayName    string   `json:"display_name"`
	Email          string   `json:"email"`
	DepartmentName string   `json:"department_name"`
	Sources        []string `json:"sources"`
}

func GetModelGrantBatchDetail(id int, isLegacy bool) (*ModelGrantBatchDetail, error) {
	if id <= 0 {
		return nil, errors.New("授权 ID 无效")
	}
	var grants []*ModelGrant
	if isLegacy {
		if err := DB.Where("id = ?", id).Find(&grants).Error; err != nil {
			return nil, err
		}
	} else {
		if err := DB.Where("batch_id = ?", id).Find(&grants).Error; err != nil {
			return nil, err
		}
	}
	if len(grants) == 0 {
		return nil, errors.New("未找到相关授权记录")
	}
	populateGrantDetails(grants)

	seenSubjects := make(map[string]bool)
	seenSets := make(map[int]bool)
	seenModels := make(map[string]bool)
	var subjects []ModelGrantSubjectDetail
	var modelSets []ModelSetBrief
	var allModels []string
	userSources := make(map[int][]string)

	createdAt := grants[0].CreatedAt
	grantedBy := grants[0].GrantedBy
	expiredAt := grants[0].ExpiredAt

	for _, g := range grants {
		if g.CreatedAt < createdAt {
			createdAt = g.CreatedAt
		}
		if g.ExpiredAt > expiredAt {
			expiredAt = g.ExpiredAt
		}
		subjKey := fmt.Sprintf("%d:%d", g.SubjectType, g.SubjectId)
		if !seenSubjects[subjKey] {
			seenSubjects[subjKey] = true
			subjects = append(subjects, ModelGrantSubjectDetail{
				Type: g.SubjectType,
				Id:   g.SubjectId,
				Name: g.SubjectName,
			})
			switch g.SubjectType {
			case SubjectTypeUser:
				userSources[g.SubjectId] = append(userSources[g.SubjectId], "直接授权")
			case SubjectTypeDepartment:
				deptIds, _ := GetDepartmentAndSubIds(g.SubjectId)
				if len(deptIds) > 0 {
					var uids []int
					_ = DB.Model(&User{}).Where("department_id IN ? AND status = ?", deptIds, common.UserStatusEnabled).Pluck("id", &uids).Error
					src := fmt.Sprintf("部门: %s", g.SubjectName)
					for _, uid := range uids {
						userSources[uid] = append(userSources[uid], src)
					}
				}
			case SubjectTypeUserGroup:
				var uids []int
				_ = DB.Model(&UserGroupMember{}).Where("group_id = ?", g.SubjectId).Pluck("user_id", &uids).Error
				src := fmt.Sprintf("用户组: %s", g.SubjectName)
				for _, uid := range uids {
					userSources[uid] = append(userSources[uid], src)
				}
			}
		}

		if !seenSets[g.ModelSetId] {
			seenSets[g.ModelSetId] = true
			modelSets = append(modelSets, ModelSetBrief{
				Id:           g.ModelSetId,
				Name:         g.ModelSetName,
				DirectModels: g.DirectModels,
				Models:       g.Models,
			})
			for _, m := range g.Models {
				if !seenModels[m] {
					seenModels[m] = true
					allModels = append(allModels, m)
				}
			}
		}
	}

	targetUserIds := make([]int, 0, len(userSources))
	for uid := range userSources {
		targetUserIds = append(targetUserIds, uid)
	}
	sort.Ints(targetUserIds)

	unionUsers := make([]UnionAuthorizedUser, 0, len(targetUserIds))
	if len(targetUserIds) > 0 {
		var users []User
		_ = DB.Select("id, username, display_name, email, department_id").Where("id IN ?", targetUserIds).Find(&users).Error

		deptNameMap := make(map[int]string)
		var deptIds []int
		for _, u := range users {
			if u.DepartmentId > 0 {
				deptIds = append(deptIds, u.DepartmentId)
			}
		}
		if len(deptIds) > 0 {
			var depts []Department
			_ = DB.Select("id, name").Where("id IN ?", deptIds).Find(&depts).Error
			for _, d := range depts {
				deptNameMap[d.Id] = d.Name
			}
		}

		for _, u := range users {
			seenSrc := make(map[string]bool)
			uniqueSrc := make([]string, 0)
			for _, s := range userSources[u.Id] {
				if !seenSrc[s] {
					seenSrc[s] = true
					uniqueSrc = append(uniqueSrc, s)
				}
			}
			unionUsers = append(unionUsers, UnionAuthorizedUser{
				Id:             u.Id,
				Username:       u.Username,
				DisplayName:    u.DisplayName,
				Email:          u.Email,
				DepartmentName: deptNameMap[u.DepartmentId],
				Sources:        uniqueSrc,
			})
		}
	}

	batchId := id
	if isLegacy {
		batchId = 0
	}
	routingGroup := ""
	quotaType := 0
	quotaScope := 0
	grantQuota := int64(0)
	usedQuota := int64(0)
	grantTokens := int64(0)
	usedTokens := int64(0)
	grantCalls := int64(0)
	usedCalls := int64(0)
	periodType := 0
	periodInterval := 1
	periodUnit := "day"
	periodStart := int64(0)
	maxConcurrency := 0
	name := ""
	if !isLegacy {
		var batch ModelGrantBatch
		if err := DB.Select("id", "name", "routing_group", "quota_type", "quota_scope", "grant_quota", "used_quota", "grant_tokens", "used_tokens", "grant_calls", "used_calls", "period_type", "period_interval", "period_unit", "period_start", "max_concurrency").First(&batch, id).Error; err == nil {
			name = batch.Name
			routingGroup = batch.RoutingGroup
			quotaType = batch.QuotaType
			quotaScope = batch.QuotaScope
			grantQuota = batch.GrantQuota
			usedQuota = batch.UsedQuota
			grantTokens = batch.GrantTokens
			usedTokens = batch.UsedTokens
			grantCalls = batch.GrantCalls
			usedCalls = batch.UsedCalls
			periodType = batch.PeriodType
			periodInterval = batch.PeriodInterval
			periodUnit = batch.PeriodUnit
			periodStart = batch.PeriodStart
			maxConcurrency = batch.MaxConcurrency
		}
	}
	if len(grants) > 0 {
		if routingGroup == "" {
			routingGroup = grants[0].RoutingGroup
		}
		if quotaType == 0 {
			quotaType = grants[0].QuotaType
		}
		if quotaScope == 0 {
			quotaScope = grants[0].QuotaScope
		}
		if grantQuota == 0 {
			grantQuota = grants[0].GrantQuota
		}
		if grantTokens == 0 {
			grantTokens = grants[0].GrantTokens
		}
		if grantCalls == 0 {
			grantCalls = grants[0].GrantCalls
		}
		if periodType == 0 {
			periodType = grants[0].PeriodType
			periodInterval = grants[0].PeriodInterval
			periodUnit = grants[0].PeriodUnit
			periodStart = grants[0].PeriodStart
		}
		if usedQuota == 0 {
			for _, g := range grants {
				usedQuota += g.UsedQuota
				usedTokens += g.UsedTokens
				usedCalls += g.UsedCalls
			}
		}
		if maxConcurrency == 0 {
			maxConcurrency = grants[0].MaxConcurrency
		}
	}
	return &ModelGrantBatchDetail{
		BatchId:        batchId,
		Name:           name,
		IsLegacy:       isLegacy,
		CreatedAt:      createdAt,
		GrantedBy:      grantedBy,
		ExpiredAt:      expiredAt,
		RoutingGroup:   routingGroup,
		QuotaType:      quotaType,
		QuotaScope:     quotaScope,
		GrantQuota:     grantQuota,
		UsedQuota:      usedQuota,
		GrantTokens:    grantTokens,
		UsedTokens:     usedTokens,
		GrantCalls:     grantCalls,
		UsedCalls:      usedCalls,
		PeriodType:     periodType,
		PeriodInterval: periodInterval,
		PeriodUnit:     periodUnit,
		PeriodStart:    periodStart,
		MaxConcurrency: maxConcurrency,
		Subjects:       subjects,
		ModelSets:      modelSets,
		Models:         allModels,
		UnionUsers:     unionUsers,
		TotalUsers:     len(unionUsers),
		TotalModels:    len(allModels),
	}, nil
}
