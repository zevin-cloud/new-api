package model

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SubjectTypeDepartment = 1
	SubjectTypeUserGroup  = 2
	SubjectTypeUser       = 3
)

type ModelGrant struct {
	Id             int    `json:"id"`
	BatchId        int    `json:"batch_id" gorm:"not null;default:0;index"`
	SubjectType    int    `json:"subject_type" gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"` // 1: dept, 2: group, 3: user
	SubjectId      int    `json:"subject_id" gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"`
	ModelSetId     int    `json:"model_set_id" gorm:"type:int;not null;index;uniqueIndex:uk_grant_subject_set"`
	RoutingGroup   string `json:"routing_group" gorm:"type:varchar(64);not null;default:''"`
	QuotaType      int    `json:"quota_type" gorm:"type:int;not null;default:0"`  // 0: unlimited, 1: fixed quota
	QuotaScope     int    `json:"quota_scope" gorm:"type:int;not null;default:0"` // 0: shared, 1: per_member
	GrantQuota     int64  `json:"grant_quota" gorm:"type:bigint;not null;default:0"`
	UsedQuota      int64  `json:"used_quota" gorm:"type:bigint;not null;default:0"`
	GrantTokens    int64  `json:"grant_tokens" gorm:"type:bigint;not null;default:0"`
	UsedTokens     int64  `json:"used_tokens" gorm:"type:bigint;not null;default:0"`
	GrantCalls     int64  `json:"grant_calls" gorm:"type:bigint;not null;default:0"`
	UsedCalls      int64  `json:"used_calls" gorm:"type:bigint;not null;default:0"`
	PeriodType     int    `json:"period_type" gorm:"type:int;not null;default:0"` // 0: none/total, 1: daily, 2: monthly, 3: interval
	PeriodInterval int    `json:"period_interval" gorm:"type:int;not null;default:1"`
	PeriodUnit     string `json:"period_unit" gorm:"type:varchar(16);not null;default:'day'"`
	PeriodStart    int64  `json:"period_start" gorm:"type:bigint;not null;default:0"`
	MaxConcurrency int    `json:"max_concurrency" gorm:"type:int;not null;default:0"`
	ExpiredAt      int64  `json:"expired_at" gorm:"bigint;default:0"` // 0 = never expires
	GrantedBy      int    `json:"granted_by" gorm:"type:int;default:0"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint"`

	// Non-db response fields
	SubjectName  string   `json:"subject_name,omitempty" gorm:"-"`
	ModelSetName string   `json:"model_set_name,omitempty" gorm:"-"`
	Models       []string `json:"models,omitempty" gorm:"-"`
	ModelCount   int      `json:"model_count,omitempty" gorm:"-"`
	DirectModels bool     `json:"direct_models" gorm:"-"`
}

type EffectiveGrantPolicy struct {
	GrantId        int    `json:"grant_id"`
	BatchId        int    `json:"batch_id"`
	SubjectType    int    `json:"subject_type"`
	SubjectId      int    `json:"subject_id"`
	RoutingGroup   string `json:"routing_group"`
	QuotaType      int    `json:"quota_type"`
	QuotaScope     int    `json:"quota_scope"`
	GrantQuota     int64  `json:"grant_quota"`
	UsedQuota      int64  `json:"used_quota"`
	GrantTokens    int64  `json:"grant_tokens"`
	UsedTokens     int64  `json:"used_tokens"`
	GrantCalls     int64  `json:"grant_calls"`
	UsedCalls      int64  `json:"used_calls"`
	PeriodType     int    `json:"period_type"`
	PeriodInterval int    `json:"period_interval"`
	PeriodUnit     string `json:"period_unit"`
	PeriodStart    int64  `json:"period_start"`
	MaxConcurrency int    `json:"max_concurrency"`
	ExpiredAt      int64  `json:"expired_at"`
}

type UserGrantDetail struct {
	DirectGrants     []*ModelGrant `json:"direct_grants"`
	GroupGrants      []*ModelGrant `json:"group_grants"`
	DepartmentGrants []*ModelGrant `json:"department_grants"`
	EffectiveModels  []string      `json:"effective_models"`
	IsAdmin          bool          `json:"is_admin"`
	DepartmentName   string        `json:"department_name"`
	GroupNames       []string      `json:"group_names"`
}

func populateGrantDetails(grants []*ModelGrant) {
	if len(grants) == 0 {
		return
	}

	modelSetIds := make([]int, 0, len(grants))
	deptIds := make([]int, 0)
	groupIds := make([]int, 0)
	userIds := make([]int, 0)

	for _, g := range grants {
		if g.ModelSetId > 0 {
			modelSetIds = append(modelSetIds, g.ModelSetId)
		}
		switch g.SubjectType {
		case SubjectTypeDepartment:
			deptIds = append(deptIds, g.SubjectId)
		case SubjectTypeUserGroup:
			groupIds = append(groupIds, g.SubjectId)
		case SubjectTypeUser:
			userIds = append(userIds, g.SubjectId)
		}
	}

	// Fetch ModelSets & models
	modelSetMap := make(map[int]string)
	modelSetModelsMap := make(map[int][]string)
	if len(modelSetIds) > 0 {
		var sets []ModelSet
		_ = DB.Where("id IN ?", modelSetIds).Find(&sets)
		for _, s := range sets {
			modelSetMap[s.Id] = s.Name
		}

		var items []ModelSetItem
		_ = DB.Where("model_set_id IN ?", modelSetIds).Find(&items)
		for _, item := range items {
			modelSetModelsMap[item.ModelSetId] = append(modelSetModelsMap[item.ModelSetId], item.ModelName)
		}
	}

	// Fetch Departments
	deptMap := make(map[int]string)
	if len(deptIds) > 0 {
		var depts []Department
		_ = DB.Where("id IN ?", deptIds).Find(&depts)
		for _, d := range depts {
			deptMap[d.Id] = d.Name
		}
	}

	// Fetch UserGroups
	groupMap := make(map[int]string)
	if len(groupIds) > 0 {
		var groups []UserGroup
		_ = DB.Where("id IN ?", groupIds).Find(&groups)
		for _, grp := range groups {
			groupMap[grp.Id] = grp.Name
		}
	}

	// Fetch Users
	userMap := make(map[int]string)
	if len(userIds) > 0 {
		var users []User
		_ = DB.Select("id", "username", "display_name").Where("id IN ?", userIds).Find(&users)
		for _, u := range users {
			if u.DisplayName != "" {
				userMap[u.Id] = u.DisplayName
			} else {
				userMap[u.Id] = u.Username
			}
		}
	}

	for _, g := range grants {
		g.ModelSetName = modelSetMap[g.ModelSetId]
		g.Models = modelSetModelsMap[g.ModelSetId]
		g.ModelCount = len(g.Models)

		switch g.SubjectType {
		case SubjectTypeDepartment:
			g.SubjectName = deptMap[g.SubjectId]
		case SubjectTypeUserGroup:
			g.SubjectName = groupMap[g.SubjectId]
		case SubjectTypeUser:
			g.SubjectName = userMap[g.SubjectId]
		}
	}
}

func filteredModelGrants(subjectType int, subjectId int, modelSetId int, status int, keyword string) *gorm.DB {
	tx := DB.Model(&ModelGrant{})

	if subjectType > 0 {
		tx = tx.Where("subject_type = ?", subjectType)
	}
	if subjectId > 0 {
		tx = tx.Where("subject_id = ?", subjectId)
	}
	if modelSetId > 0 {
		tx = tx.Where("model_set_id = ?", modelSetId)
	}

	now := common.GetTimestamp()
	if status == 1 { // Active
		tx = tx.Where("expired_at = 0 OR expired_at > ?", now)
	} else if status == 2 { // Expired
		tx = tx.Where("expired_at > 0 AND expired_at <= ?", now)
	}
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		matching := DB.Where("model_set_id IN (?)", DB.Model(&ModelSet{}).Select("id").Where("name LIKE ?", pattern)).
			Or("batch_id IN (?)", DB.Model(&ModelGrantBatch{}).Select("id").Where("name LIKE ?", pattern)).
			Or("subject_type = ? AND subject_id IN (?)", SubjectTypeUser, DB.Model(&User{}).Select("id").Where("username LIKE ? OR display_name LIKE ?", pattern, pattern)).
			Or("subject_type = ? AND subject_id IN (?)", SubjectTypeDepartment, DB.Model(&Department{}).Select("id").Where("name LIKE ?", pattern)).
			Or("subject_type = ? AND subject_id IN (?)", SubjectTypeUserGroup, DB.Model(&UserGroup{}).Select("id").Where("name LIKE ?", pattern))
		tx = tx.Where(matching)
	}
	return tx
}

func GetModelGrants(page int, pageSize int, subjectType int, subjectId int, modelSetId int, status int, keyword string) ([]*ModelGrant, int64, error) {
	var grants []*ModelGrant
	var total int64
	tx := filteredModelGrants(subjectType, subjectId, modelSetId, status, keyword)

	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	err := tx.Order("id DESC").Limit(pageSize).Offset(offset).Find(&grants).Error
	if err != nil {
		return nil, 0, err
	}

	populateGrantDetails(grants)

	return grants, total, nil
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
	return DB.Transaction(func(tx *gorm.DB) error {
		var grant ModelGrant
		if err := tx.First(&grant, grantId).Error; err != nil {
			return err
		}
		if err := tx.Delete(&grant).Error; err != nil {
			return err
		}
		if grant.ModelSetId > 0 {
			var remainingCount int64
			_ = tx.Model(&ModelGrant{}).Where("model_set_id = ?", grant.ModelSetId).Count(&remainingCount)
			if remainingCount == 0 {
				var set ModelSet
				if err := tx.First(&set, grant.ModelSetId).Error; err == nil {
					if strings.HasPrefix(set.Name, "直接授权模型集-") || set.Description == "由直接模型授权生成的模型集" {
						_ = tx.Where("model_set_id = ?", set.Id).Delete(&ModelSetItem{}).Error
						_ = tx.Delete(&set).Error
					}
				}
			}
		}
		return nil
	})
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
	grants, err := GetEffectiveModelGrantsForUser(userId, deptId, groupIds)
	if err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(grants))
	seen := make(map[int]bool)
	for _, grant := range grants {
		if !seen[grant.ModelSetId] {
			ids = append(ids, grant.ModelSetId)
			seen[grant.ModelSetId] = true
		}
	}
	return ids, nil
}

// GetEffectiveModelGrantsForUser preserves expiry information for permission caches.
func GetEffectiveModelGrantsForUser(userId int, deptId int, groupIds []int) ([]ModelGrant, error) {
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
		orConditions = append(orConditions, "(subject_type = ? AND subject_id IN ? AND subject_id IN (SELECT id FROM user_groups WHERE status = ? AND deleted_at IS NULL))")
		args = append(args, SubjectTypeUserGroup, groupIds, UserGroupStatusEnabled)
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
		orConditions = append(orConditions, "(subject_type = ? AND subject_id IN ? AND subject_id IN (SELECT id FROM departments WHERE status = ? AND deleted_at IS NULL))")
		args = append(args, SubjectTypeDepartment, deptIds, DepartmentStatusEnabled)
	}

	whereClause := ""
	for i, cond := range orConditions {
		if i == 0 {
			whereClause = cond
		} else {
			whereClause += " OR " + cond
		}
	}

	var grants []ModelGrant
	err := query.Where(whereClause, args...).Find(&grants).Error
	return grants, err
}

// GetEffectiveModelNamesForUser resolves all model names a user is currently allowed to invoke.
func GetEffectiveModelNamesForUser(userId int) ([]string, error) {
	models, _, err := GetEffectiveModelAccessForUser(userId)
	return models, err
}

// GetEffectiveModelAccessForUser also returns the first expiry among effective grants.
// A cache must not survive that expiry, even if other grants last longer.
func GetEffectiveModelAccessForUser(userId int) ([]string, int64, error) {
	if userId <= 0 {
		return nil, 0, nil
	}

	// Get user's department
	var user User
	if err := DB.Select("id", "department_id", "role").First(&user, userId).Error; err != nil {
		return nil, 0, err
	}

	// Root/Admin have access to all enabled models
	if user.Role >= common.RoleAdminUser {
		var allModels []string
		err := DB.Model(&Model{}).Where("status = 1").Pluck("model_name", &allModels).Error
		return allModels, 0, err
	}

	// Get user's user groups
	groupIds, err := GetUserGroupIdsByUserId(userId)
	if err != nil {
		return nil, 0, err
	}

	// Get effective model set IDs
	grants, err := GetEffectiveModelGrantsForUser(userId, user.DepartmentId, groupIds)
	if err != nil || len(grants) == 0 {
		return nil, 0, err
	}
	setIds := make([]int, 0, len(grants))
	var expiresAt int64
	for _, grant := range grants {
		setIds = append(setIds, grant.ModelSetId)
		if grant.ExpiredAt > 0 && (expiresAt == 0 || grant.ExpiredAt < expiresAt) {
			expiresAt = grant.ExpiredAt
		}
	}

	// Get distinct model names from those model sets
	models, err := GetModelNamesByModelSetIds(setIds)
	return models, expiresAt, err
}

// GetEffectiveGrantPolicyForUser returns the effective grant policy for a user and model.
func GetEffectiveGrantPolicyForUser(userId int, modelName string) (*EffectiveGrantPolicy, error) {
	if userId <= 0 || modelName == "" {
		return nil, nil
	}
	var user User
	if err := DB.Select("id", "department_id", "role").First(&user, userId).Error; err != nil {
		return nil, err
	}
	if user.Role >= common.RoleAdminUser {
		return &EffectiveGrantPolicy{}, nil
	}
	groupIds, err := GetUserGroupIdsByUserId(userId)
	if err != nil {
		return nil, err
	}
	grants, err := GetEffectiveModelGrantsForUser(userId, user.DepartmentId, groupIds)
	if err != nil || len(grants) == 0 {
		return nil, err
	}

	normModel := ratio_setting.FormatMatchingModelName(modelName)
	setIds, err := GetModelSetIdsByModelName(modelName)
	if err != nil {
		return nil, err
	}
	if normModel != "" && normModel != modelName {
		normSetIds, err := GetModelSetIdsByModelName(normModel)
		if err != nil {
			return nil, err
		}
		setIds = append(setIds, normSetIds...)
	}
	if len(setIds) == 0 {
		return nil, nil
	}

	setMap := make(map[int]bool, len(setIds))
	for _, sid := range setIds {
		setMap[sid] = true
	}

	var bestGrant *ModelGrant
	for i := range grants {
		g := &grants[i]
		if !setMap[g.ModelSetId] {
			continue
		}
		if bestGrant == nil {
			bestGrant = g
			continue
		}
		// Priority: User (3) > UserGroup (2) > Dept (1)
		if g.SubjectType > bestGrant.SubjectType {
			bestGrant = g
		} else if g.SubjectType == bestGrant.SubjectType {
			if g.Id > bestGrant.Id {
				bestGrant = g
			}
		}
	}

	if bestGrant == nil {
		return nil, nil
	}

	grantQuota := bestGrant.GrantQuota
	usedQuota := bestGrant.UsedQuota
	grantTokens := bestGrant.GrantTokens
	usedTokens := bestGrant.UsedTokens
	grantCalls := bestGrant.GrantCalls
	usedCalls := bestGrant.UsedCalls
	periodType := bestGrant.PeriodType
	periodInterval := bestGrant.PeriodInterval
	periodUnit := bestGrant.PeriodUnit
	periodStart := bestGrant.PeriodStart

	if bestGrant.QuotaScope == 0 && bestGrant.BatchId > 0 {
		var batch ModelGrantBatch
		if err := DB.Select("id", "grant_quota", "used_quota", "grant_tokens", "used_tokens", "grant_calls", "used_calls", "period_type", "period_interval", "period_unit", "period_start").First(&batch, bestGrant.BatchId).Error; err == nil {
			CheckAndResetBatchPeriod(&batch)
			if batch.GrantQuota > 0 {
				grantQuota = batch.GrantQuota
			}
			if batch.UsedQuota > usedQuota {
				usedQuota = batch.UsedQuota
			}
			if batch.GrantTokens > 0 {
				grantTokens = batch.GrantTokens
			}
			if batch.UsedTokens > usedTokens {
				usedTokens = batch.UsedTokens
			}
			if batch.GrantCalls > 0 {
				grantCalls = batch.GrantCalls
			}
			if batch.UsedCalls > usedCalls {
				usedCalls = batch.UsedCalls
			}
			periodType = batch.PeriodType
			periodInterval = batch.PeriodInterval
			periodUnit = batch.PeriodUnit
			periodStart = batch.PeriodStart
		}
	} else {
		CheckAndResetGrantPeriod(bestGrant)
		usedQuota = bestGrant.UsedQuota
		usedTokens = bestGrant.UsedTokens
		usedCalls = bestGrant.UsedCalls
		periodStart = bestGrant.PeriodStart
	}

	return &EffectiveGrantPolicy{
		GrantId:        bestGrant.Id,
		BatchId:        bestGrant.BatchId,
		SubjectType:    bestGrant.SubjectType,
		SubjectId:      bestGrant.SubjectId,
		RoutingGroup:   bestGrant.RoutingGroup,
		QuotaType:      bestGrant.QuotaType,
		QuotaScope:     bestGrant.QuotaScope,
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
		MaxConcurrency: bestGrant.MaxConcurrency,
		ExpiredAt:      bestGrant.ExpiredAt,
	}, nil
}

// CalculatePeriodStart computes the start timestamp of the current cycle.
func CalculatePeriodStart(periodType int, periodInterval int, periodUnit string, t time.Time) int64 {
	loc := t.Location()
	switch periodType {
	case 1: // Daily
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc).Unix()
	case 2: // Monthly
		return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, loc).Unix()
	case 3: // Custom interval
		if periodInterval <= 0 {
			periodInterval = 1
		}
		switch periodUnit {
		case "hour":
			return t.Truncate(time.Duration(periodInterval) * time.Hour).Unix()
		case "week":
			weekday := int(t.Weekday())
			if weekday == 0 {
				weekday = 7
			}
			startOfWeek := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -(weekday - 1))
			return startOfWeek.Unix()
		case "month":
			return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, loc).Unix()
		default: // "day"
			return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc).Unix()
		}
	default:
		return 0
	}
}

// IsGrantPeriodExpired checks whether the period starting at periodStart has elapsed by now.
func IsGrantPeriodExpired(periodType int, periodInterval int, periodUnit string, periodStart int64, now int64) bool {
	if periodType <= 0 || periodStart <= 0 {
		return false
	}
	t := time.Unix(now, 0)
	switch periodType {
	case 1: // Daily
		curStart := CalculatePeriodStart(1, 1, "day", t)
		return periodStart < curStart
	case 2: // Monthly
		curStart := CalculatePeriodStart(2, 1, "month", t)
		return periodStart < curStart
	case 3: // Interval
		if periodInterval <= 0 {
			periodInterval = 1
		}
		switch periodUnit {
		case "hour":
			return now >= periodStart+int64(periodInterval)*3600
		case "week":
			return now >= periodStart+int64(periodInterval)*7*86400
		case "month":
			curStart := CalculatePeriodStart(2, 1, "month", t)
			return periodStart < curStart
		default: // "day"
			return now >= periodStart+int64(periodInterval)*86400
		}
	}
	return false
}

// CheckAndResetGrantPeriod resets the used quota, tokens, and calls for an individual grant if expired.
func CheckAndResetGrantPeriod(grant *ModelGrant) bool {
	if grant == nil || grant.Id <= 0 || grant.PeriodType <= 0 {
		return false
	}
	now := common.GetTimestamp()
	if !IsGrantPeriodExpired(grant.PeriodType, grant.PeriodInterval, grant.PeriodUnit, grant.PeriodStart, now) {
		return false
	}
	newStart := CalculatePeriodStart(grant.PeriodType, grant.PeriodInterval, grant.PeriodUnit, time.Unix(now, 0))
	grant.UsedQuota = 0
	grant.UsedTokens = 0
	grant.UsedCalls = 0
	grant.PeriodStart = newStart
	_ = DB.Model(&ModelGrant{}).Where("id = ? AND period_start < ?", grant.Id, newStart).
		Updates(map[string]interface{}{
			"used_quota":   0,
			"used_tokens":  0,
			"used_calls":   0,
			"period_start": newStart,
		})
	return true
}

// CheckAndResetBatchPeriod resets the used quota, tokens, and calls for a batch if expired.
func CheckAndResetBatchPeriod(batch *ModelGrantBatch) bool {
	if batch == nil || batch.Id <= 0 || batch.PeriodType <= 0 {
		return false
	}
	now := common.GetTimestamp()
	if !IsGrantPeriodExpired(batch.PeriodType, batch.PeriodInterval, batch.PeriodUnit, batch.PeriodStart, now) {
		return false
	}
	newStart := CalculatePeriodStart(batch.PeriodType, batch.PeriodInterval, batch.PeriodUnit, time.Unix(now, 0))
	batch.UsedQuota = 0
	batch.UsedTokens = 0
	batch.UsedCalls = 0
	batch.PeriodStart = newStart
	_ = DB.Model(&ModelGrantBatch{}).Where("id = ? AND period_start < ?", batch.Id, newStart).
		Updates(map[string]interface{}{
			"used_quota":   0,
			"used_tokens":  0,
			"used_calls":   0,
			"period_start": newStart,
		})
	_ = DB.Model(&ModelGrant{}).Where("batch_id = ? AND period_start < ?", batch.Id, newStart).
		Updates(map[string]interface{}{
			"used_quota":   0,
			"used_tokens":  0,
			"used_calls":   0,
			"period_start": newStart,
		})
	return true
}

// ResetGrantPeriodPolicy resets policy in-memory and in DB if expired.
func ResetGrantPeriodPolicy(policy *EffectiveGrantPolicy) error {
	if policy == nil || policy.PeriodType <= 0 {
		return nil
	}
	now := common.GetTimestamp()
	newStart := CalculatePeriodStart(policy.PeriodType, policy.PeriodInterval, policy.PeriodUnit, time.Unix(now, 0))
	policy.UsedQuota = 0
	policy.UsedTokens = 0
	policy.UsedCalls = 0
	policy.PeriodStart = newStart
	if policy.GrantId > 0 {
		_ = DB.Model(&ModelGrant{}).Where("id = ? AND period_start < ?", policy.GrantId, newStart).
			Updates(map[string]interface{}{
				"used_quota":   0,
				"used_tokens":  0,
				"used_calls":   0,
				"period_start": newStart,
			})
	}
	if policy.BatchId > 0 {
		_ = DB.Model(&ModelGrantBatch{}).Where("id = ? AND period_start < ?", policy.BatchId, newStart).
			Updates(map[string]interface{}{
				"used_quota":   0,
				"used_tokens":  0,
				"used_calls":   0,
				"period_start": newStart,
			})
	}
	return nil
}

// IncreaseGrantUsedUsage increments used_quota, used_tokens, and used_calls for a grant and its batch.
func IncreaseGrantUsedUsage(grantId int, quota int64, tokens int64, calls int64) error {
	if grantId <= 0 {
		return nil
	}
	var grant ModelGrant
	if err := DB.Select("id", "batch_id").First(&grant, grantId).Error; err != nil {
		return err
	}
	updates := map[string]interface{}{}
	if quota > 0 {
		updates["used_quota"] = gorm.Expr("used_quota + ?", quota)
	}
	if tokens > 0 {
		updates["used_tokens"] = gorm.Expr("used_tokens + ?", tokens)
	}
	if calls > 0 {
		updates["used_calls"] = gorm.Expr("used_calls + ?", calls)
	}
	if len(updates) == 0 {
		return nil
	}
	if err := DB.Model(&ModelGrant{}).Where("id = ?", grantId).Updates(updates).Error; err != nil {
		return err
	}
	if grant.BatchId > 0 {
		_ = DB.Model(&ModelGrantBatch{}).Where("id = ?", grant.BatchId).Updates(updates).Error
	}
	return nil
}

// IncreaseGrantUsedQuota increments the used_quota for a grant and its batch.
func IncreaseGrantUsedQuota(grantId int, quota int64) error {
	return IncreaseGrantUsedUsage(grantId, quota, 0, 0)
}

// DecreaseGrantUsedQuota decrements the used_quota for a grant and its batch, preventing negative values.
func DecreaseGrantUsedQuota(grantId int, quota int64) error {
	if grantId <= 0 || quota <= 0 {
		return nil
	}
	var grant ModelGrant
	if err := DB.Select("id", "batch_id").First(&grant, grantId).Error; err != nil {
		return err
	}
	if err := DB.Model(&ModelGrant{}).Where("id = ?", grantId).
		Update("used_quota", gorm.Expr("CASE WHEN used_quota >= ? THEN used_quota - ? ELSE 0 END", quota, quota)).Error; err != nil {
		return err
	}
	if grant.BatchId > 0 {
		_ = DB.Model(&ModelGrantBatch{}).Where("id = ?", grant.BatchId).
			Update("used_quota", gorm.Expr("CASE WHEN used_quota >= ? THEN used_quota - ? ELSE 0 END", quota, quota)).Error
	}
	return nil
}

// TryReserveGrantQuota atomically checks and reserves quota for a grant.
// If quotaScope == 0 (shared pool) and batchId > 0, it reserves from the batch quota.
// Otherwise, it reserves from the individual grant's quota.
func TryReserveGrantQuota(grantId int, batchId int, quotaScope int, quota int64) (bool, error) {
	if quota <= 0 {
		return true, nil
	}
	if grantId <= 0 {
		return false, errors.New("invalid grant id")
	}

	if quotaScope == 0 && batchId > 0 {
		var batch ModelGrantBatch
		if err := DB.Select("id", "period_type", "period_interval", "period_unit", "period_start").First(&batch, batchId).Error; err == nil {
			CheckAndResetBatchPeriod(&batch)
		}

		result := DB.Model(&ModelGrantBatch{}).
			Where("id = ? AND (grant_quota = 0 OR used_quota + ? <= grant_quota) AND (grant_tokens = 0 OR used_tokens < grant_tokens) AND (grant_calls = 0 OR used_calls < grant_calls)", batchId, quota).
			Update("used_quota", gorm.Expr("used_quota + ?", quota))
		if result.Error != nil || result.RowsAffected == 0 {
			return false, result.Error
		}
		_ = DB.Model(&ModelGrant{}).Where("id = ?", grantId).
			Update("used_quota", gorm.Expr("used_quota + ?", quota))
		return true, nil
	}

	var grant ModelGrant
	if err := DB.Select("id", "period_type", "period_interval", "period_unit", "period_start").First(&grant, grantId).Error; err == nil {
		CheckAndResetGrantPeriod(&grant)
	}

	result := DB.Model(&ModelGrant{}).
		Where("id = ? AND (grant_quota = 0 OR used_quota + ? <= grant_quota) AND (grant_tokens = 0 OR used_tokens < grant_tokens) AND (grant_calls = 0 OR used_calls < grant_calls)", grantId, quota).
		Update("used_quota", gorm.Expr("used_quota + ?", quota))
	if result.Error != nil || result.RowsAffected == 0 {
		return false, result.Error
	}
	if batchId > 0 {
		_ = DB.Model(&ModelGrantBatch{}).Where("id = ?", batchId).
			Update("used_quota", gorm.Expr("used_quota + ?", quota))
	}
	return true, nil
}

func GetUserGrantDetail(userId int) (*UserGrantDetail, error) {
	if userId <= 0 {
		return nil, errors.New("无效的用户 ID")
	}

	var user User
	if err := DB.Select("id", "username", "display_name", "department_id", "role").First(&user, userId).Error; err != nil {
		return nil, err
	}

	detail := &UserGrantDetail{
		IsAdmin: user.Role >= common.RoleAdminUser,
	}

	// 1. Department info & grants
	if user.DepartmentId > 0 {
		var dept Department
		if err := DB.Select("id", "name", "path").First(&dept, user.DepartmentId).Error; err == nil {
			detail.DepartmentName = dept.Name
			deptIds := []int{dept.Id}
			if dept.Path != "" {
				for _, part := range strings.Split(dept.Path, "/") {
					if part != "" {
						if pid, err := strconv.Atoi(part); err == nil && pid > 0 {
							deptIds = append(deptIds, pid)
						}
					}
				}
			}
			var deptGrants []*ModelGrant
			_ = DB.Where("subject_type = ? AND subject_id IN ?", SubjectTypeDepartment, deptIds).Find(&deptGrants)
			populateGrantDetails(deptGrants)
			detail.DepartmentGrants = deptGrants
		}
	}

	// 2. User group info & grants
	groupIds, _ := GetUserGroupIdsByUserId(userId)
	if len(groupIds) > 0 {
		var groups []UserGroup
		_ = DB.Select("id", "name").Where("id IN ?", groupIds).Find(&groups)
		for _, grp := range groups {
			detail.GroupNames = append(detail.GroupNames, grp.Name)
		}
		var groupGrants []*ModelGrant
		_ = DB.Where("subject_type = ? AND subject_id IN ?", SubjectTypeUserGroup, groupIds).Find(&groupGrants)
		populateGrantDetails(groupGrants)
		detail.GroupGrants = groupGrants
	}

	// 3. User direct grants
	var userGrants []*ModelGrant
	_ = DB.Where("subject_type = ? AND subject_id = ?", SubjectTypeUser, userId).Find(&userGrants)
	populateGrantDetails(userGrants)
	detail.DirectGrants = userGrants

	// 4. Effective models
	effectiveModels, err := GetEffectiveModelNamesForUser(userId)
	if err == nil {
		detail.EffectiveModels = effectiveModels
	}

	return detail, nil
}
