package service

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

const (
	userModelAuthCachePrefix = "user_model_auth:"
	userModelAuthCacheTTL    = 5 * time.Minute
)

// GetUserGrantedModelMap returns the map of granted models for a user and whether the user has all-access.
// Root and Admin users have full access (allAccess = true).
func GetUserGrantedModelMap(userId int) (grantedMap map[string]bool, allAccess bool, err error) {
	if userId <= 0 {
		return map[string]bool{}, false, nil
	}

	user, err := model.GetUserCache(userId)
	if err != nil {
		return nil, false, err
	}

	// Root & Admin have access to all enabled models
	if user.Role >= common.RoleAdminUser {
		return nil, true, nil
	}

	cacheKey := fmt.Sprintf("%s%d", userModelAuthCachePrefix, userId)
	if common.RedisEnabled {
		val, rErr := common.RedisGet(cacheKey)
		if rErr == nil && val != "" {
			var cachedModels []string
			if err = common.UnmarshalJsonStr(val, &cachedModels); err == nil {
				res := make(map[string]bool, len(cachedModels))
				for _, m := range cachedModels {
					res[m] = true
				}
				return res, false, nil
			}
		}
	}

	models, err := model.GetEffectiveModelNamesForUser(userId)
	if err != nil {
		return nil, false, err
	}

	grantedMap = make(map[string]bool, len(models))
	for _, m := range models {
		grantedMap[m] = true
	}

	if common.RedisEnabled {
		data, mErr := common.Marshal(models)
		if mErr == nil {
			_ = common.RedisSet(cacheKey, string(data), userModelAuthCacheTTL)
		}
	}

	return grantedMap, false, nil
}

// InvalidateUserModelAuthCache clears the cached granted models for a user.
func InvalidateUserModelAuthCache(userId int) {
	if userId <= 0 || !common.RedisEnabled {
		return
	}
	cacheKey := fmt.Sprintf("%s%d", userModelAuthCachePrefix, userId)
	_ = common.RedisDel(cacheKey)
}

// InvalidateGroupModelAuthCache clears the cached granted models for all members in a user group.
func InvalidateGroupModelAuthCache(groupId int) {
	if groupId <= 0 {
		return
	}
	var userIds []int
	_ = model.DB.Model(&model.UserGroupMember{}).Where("group_id = ?", groupId).Pluck("user_id", &userIds)
	for _, uid := range userIds {
		InvalidateUserModelAuthCache(uid)
	}
}

// InvalidateDeptModelAuthCache clears the cached granted models for all users in a department and its sub-departments.
func InvalidateDeptModelAuthCache(deptId int) {
	if deptId <= 0 {
		return
	}
	subIds, err := model.GetDepartmentAndSubIds(deptId)
	if err != nil || len(subIds) == 0 {
		subIds = []int{deptId}
	}
	var userIds []int
	_ = model.DB.Model(&model.User{}).Where("department_id IN ?", subIds).Pluck("id", &userIds)
	for _, uid := range userIds {
		InvalidateUserModelAuthCache(uid)
	}
}

// InvalidateModelSetAuthCache clears the cached granted models for all subjects granted this model set.
func InvalidateModelSetAuthCache(modelSetId int) {
	if modelSetId <= 0 {
		return
	}
	var grants []model.ModelGrant
	_ = model.DB.Where("model_set_id = ?", modelSetId).Find(&grants)
	for _, g := range grants {
		switch g.SubjectType {
		case model.SubjectTypeUser:
			InvalidateUserModelAuthCache(g.SubjectId)
		case model.SubjectTypeUserGroup:
			InvalidateGroupModelAuthCache(g.SubjectId)
		case model.SubjectTypeDepartment:
			InvalidateDeptModelAuthCache(g.SubjectId)
		}
	}
}

// ValidateUserAndTokenModelAccess checks if the user and token are permitted to call the requested model.
// Returns (allowed, errorMessage).
func ValidateUserAndTokenModelAccess(c *gin.Context, userId int, requestedModel string) (bool, string) {
	if userId <= 0 || requestedModel == "" {
		return false, "请求模型或用户信息无效"
	}

	matchingModel := ratio_setting.FormatMatchingModelName(requestedModel)

	// 1. Check User Level Model Grants
	userGrantedMap, allAccess, err := GetUserGrantedModelMap(userId)
	if err != nil {
		return false, "获取用户模型授权失败"
	}

	if !allAccess {
		hasUserAccess := userGrantedMap[requestedModel] || userGrantedMap[matchingModel]
		if !hasUserAccess {
			return false, fmt.Sprintf("您尚未获得模型 %s 的调用授权，请前往模型广场申请权限", requestedModel)
		}
	}

	// 2. Check Token Level Model Limits (if enabled)
	tokenLimitEnabled := common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled)
	if tokenLimitEnabled {
		rawTokenLimit, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
		if !ok {
			return false, "当前令牌未配置任何允许调用的模型"
		}
		tokenModelLimit, ok := rawTokenLimit.(map[string]bool)
		if !ok || len(tokenModelLimit) == 0 {
			return false, "当前令牌未配置任何允许调用的模型"
		}
		if !tokenModelLimit[requestedModel] && !tokenModelLimit[matchingModel] {
			return false, fmt.Sprintf("当前 API Key 未包含模型 %s 的权限（受令牌范围限制）", requestedModel)
		}
	}

	return true, ""
}
