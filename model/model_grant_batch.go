package model

import (
	"errors"
	"fmt"
	"sort"
	"strings"
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
	Id               int   `json:"id"`
	GrantedBy        int   `json:"granted_by"`
	CreatedAt        int64 `json:"created_at"`
	DirectModelSetId int   `json:"direct_model_set_id"`
}

type ModelGrantSubject struct {
	Type int
	Id   int
}

type ModelGrantBatchView struct {
	Id        string        `json:"id"`
	BatchId   int           `json:"batch_id"`
	CreatedAt int64         `json:"created_at"`
	Grants    []*ModelGrant `json:"grants"`
}

func CreateModelGrantBatch(subjects []ModelGrantSubject, setIds []int, modelNames []string, customSetName string, expiresAt int64, actorId int) (*ModelGrantBatch, error) {
	if len(subjects) == 0 || len(setIds)+len(modelNames) == 0 {
		return nil, errors.New("请选择授权主体与模型资源")
	}
	if expiresAt < 0 || (expiresAt != 0 && expiresAt <= common.GetTimestamp()) {
		return nil, errors.New("过期时间必须晚于当前时间")
	}
	customSetName = strings.TrimSpace(customSetName)
	if utf8.RuneCountInString(customSetName) > 64 {
		return nil, errors.New("模型集名称不能超过 64 个字符")
	}
	models := make([]string, 0, len(modelNames))
	seenModels := make(map[string]bool)
	for _, name := range modelNames {
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
	setIds = append([]int(nil), setIds...)
	sort.Ints(setIds)
	subjects = append([]ModelGrantSubject(nil), subjects...)
	sort.Slice(subjects, func(i, j int) bool {
		if subjects[i].Type != subjects[j].Type {
			return subjects[i].Type < subjects[j].Type
		}
		return subjects[i].Id < subjects[j].Id
	})
	batch := &ModelGrantBatch{GrantedBy: actorId, CreatedAt: common.GetTimestamp()}
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
			name := customSetName
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
			set := ModelSet{Name: name, Description: "由直接模型授权生成的模型集", Status: ModelSetStatusEnabled, CreatedBy: actorId, CreatedAt: batch.CreatedAt, UpdatedAt: batch.CreatedAt}
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
		for _, setId := range setIds {
			for _, subject := range subjects {
				grant := ModelGrant{BatchId: batch.Id, SubjectType: subject.Type, SubjectId: subject.Id, ModelSetId: setId, ExpiredAt: expiresAt, GrantedBy: actorId, CreatedAt: batch.CreatedAt, UpdatedAt: batch.CreatedAt}
				if err := tx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "subject_type"}, {Name: "subject_id"}, {Name: "model_set_id"}},
					DoUpdates: clause.AssignmentColumns([]string{"batch_id", "expired_at", "granted_by", "updated_at"}),
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
		if group.BatchId > 0 {
			key = fmt.Sprintf("batch_%d", group.BatchId)
			createdAt = metadata[group.BatchId].CreatedAt
		}
		views = append(views, ModelGrantBatchView{Id: key, BatchId: group.BatchId, CreatedAt: createdAt, Grants: byKey[key]})
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
	BatchId     int                       `json:"batch_id"`
	IsLegacy    bool                      `json:"is_legacy"`
	CreatedAt   int64                     `json:"created_at"`
	GrantedBy   int                       `json:"granted_by"`
	ExpiredAt   int64                     `json:"expired_at"`
	Subjects    []ModelGrantSubjectDetail `json:"subjects"`
	ModelSets   []ModelSetBrief           `json:"model_sets"`
	Models      []string                  `json:"models"`
	UnionUsers  []UnionAuthorizedUser     `json:"union_users"`
	TotalUsers  int                       `json:"total_users"`
	TotalModels int                       `json:"total_models"`
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
	return &ModelGrantBatchDetail{
		BatchId:     batchId,
		IsLegacy:    isLegacy,
		CreatedAt:   createdAt,
		GrantedBy:   grantedBy,
		ExpiredAt:   expiredAt,
		Subjects:    subjects,
		ModelSets:   modelSets,
		Models:      allModels,
		UnionUsers:  unionUsers,
		TotalUsers:  len(unionUsers),
		TotalModels: len(allModels),
	}, nil
}
