package controller

import (
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetModelSets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	keyword := c.Query("keyword")
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))

	sets, total, err := model.GetModelSets(page, pageSize, keyword, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items": sets,
			"total": total,
			"page":  page,
		},
	})
}

func GetModelSet(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的模型集 ID",
		})
		return
	}

	set, err := model.GetModelSetById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	grants, _ := model.GetGrantsByModelSetId(id)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"set":    set,
			"grants": grants,
		},
	})
}

type ModelSetCreateRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Status      int      `json:"status"`
	Models      []string `json:"models"`
}

func CreateModelSet(c *gin.Context) {
	var req ModelSetCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数解析失败: " + err.Error(),
		})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "模型集名称不能为空",
		})
		return
	}

	set := model.ModelSet{
		Name:        req.Name,
		Description: req.Description,
		Status:      req.Status,
		CreatedBy:   c.GetInt("id"),
	}

	if err := set.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if len(req.Models) > 0 {
		_ = model.AddModelsToModelSet(set.Id, req.Models)
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "model_set_created", "model_set", set.Id, req)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建模型集成功",
		"data":    set,
	})
}

func UpdateModelSet(c *gin.Context) {
	var req ModelSetCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数解析失败: " + err.Error(),
		})
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的模型集 ID",
		})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "模型集名称不能为空",
		})
		return
	}

	set := model.ModelSet{
		Id:          id,
		Name:        req.Name,
		Description: req.Description,
		Status:      req.Status,
	}

	if err := set.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Update models
	if req.Models != nil {
		_ = model.SetModelSetModels(id, req.Models)
	}

	service.InvalidateModelSetAuthCache(id)
	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "model_set_updated", "model_set", id, req)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新模型集成功",
		"data":    set,
	})
}

func DeleteModelSet(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的模型集 ID",
		})
		return
	}

	if err := model.DeleteModelSet(id); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	service.InvalidateModelSetAuthCache(id)
	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "model_set_deleted", "model_set", id, "")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除模型集成功",
	})
}

type GrantModelSetRequest struct {
	DepartmentIds []int    `json:"department_ids"`
	GroupIds      []int    `json:"group_ids"`
	UserIds       []int    `json:"user_ids"`
	ModelSetIds   []int    `json:"model_set_ids"`
	ModelNames    []string `json:"model_names"`
	CustomSetName string   `json:"custom_set_name"`
	DurationDays  int      `json:"duration_days"` // 0 = permanent
	ExpiredAt     int64    `json:"expired_at"`

	// Legacy backward compatibility fields
	SubjectType int   `json:"subject_type"` // 1: dept, 2: group, 3: user
	SubjectId   int   `json:"subject_id"`
	SubjectIds  []int `json:"subject_ids"`
	ModelSetId  int   `json:"model_set_id"`
}

func GetModelGrants(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	subjectType, _ := strconv.Atoi(c.DefaultQuery("subject_type", "0"))
	subjectId, _ := strconv.Atoi(c.DefaultQuery("subject_id", "0"))
	modelSetId, _ := strconv.Atoi(c.DefaultQuery("model_set_id", "0"))
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))
	keyword := c.Query("keyword")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	if c.Query("group_by") != "flat" {
		batches, total, err := model.GetModelGrantBatches(page, pageSize, subjectType, subjectId, modelSetId, status, keyword)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": batches, "total": total, "page": page, "page_size": pageSize}})
		return
	}
	grants, total, err := model.GetModelGrants(page, pageSize, subjectType, subjectId, modelSetId, status, keyword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     grants,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func InspectUserGrant(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("userId"))
	if err != nil || userId <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的用户 ID"})
		return
	}

	detail, err := model.GetUserGrantDetail(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    detail,
	})
}

func GrantModelSet(c *gin.Context) {
	var req GrantModelSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数解析失败: " + err.Error()})
		return
	}

	if req.ExpiredAt < 0 || req.DurationDays < 0 || int64(req.DurationDays) > (math.MaxInt64-common.GetTimestamp())/86400 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "授权有效期无效"})
		return
	}
	var expiredAt int64
	if req.DurationDays > 0 {
		expiredAt = common.GetTimestamp() + int64(req.DurationDays)*86400
	} else if req.ExpiredAt > 0 {
		expiredAt = req.ExpiredAt
	}

	actorId := c.GetInt("id")

	// 1. Gather all target subjects into categorized maps
	for _, ids := range [][]int{req.DepartmentIds, req.GroupIds, req.UserIds, req.SubjectIds, req.ModelSetIds} {
		for _, id := range ids {
			if id <= 0 {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "授权主体或模型集 ID 无效"})
				return
			}
		}
	}
	targetDepts := make(map[int]bool)
	targetGroups := make(map[int]bool)
	targetUsers := make(map[int]bool)

	for _, id := range req.DepartmentIds {
		if id > 0 {
			targetDepts[id] = true
		}
	}
	for _, id := range req.GroupIds {
		if id > 0 {
			targetGroups[id] = true
		}
	}
	for _, id := range req.UserIds {
		if id > 0 {
			targetUsers[id] = true
		}
	}

	// Legacy backward compatibility
	if req.SubjectType == model.SubjectTypeDepartment {
		if req.SubjectId > 0 {
			targetDepts[req.SubjectId] = true
		}
		for _, id := range req.SubjectIds {
			if id > 0 {
				targetDepts[id] = true
			}
		}
	} else if req.SubjectType == model.SubjectTypeUserGroup {
		if req.SubjectId > 0 {
			targetGroups[req.SubjectId] = true
		}
		for _, id := range req.SubjectIds {
			if id > 0 {
				targetGroups[id] = true
			}
		}
	} else if req.SubjectType == model.SubjectTypeUser {
		if req.SubjectId > 0 {
			targetUsers[req.SubjectId] = true
		}
		for _, id := range req.SubjectIds {
			if id > 0 {
				targetUsers[id] = true
			}
		}
	}

	if len(targetDepts) == 0 && len(targetGroups) == 0 && len(targetUsers) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请选择至少一个授权主体（部门、用户组或用户）"})
		return
	}

	setMap := make(map[int]bool)
	if req.ModelSetId > 0 {
		setMap[req.ModelSetId] = true
	}
	for _, id := range req.ModelSetIds {
		if id > 0 {
			setMap[id] = true
		}
	}
	setIds := make([]int, 0, len(setMap))
	for id := range setMap {
		setIds = append(setIds, id)
	}
	subjects := make([]model.ModelGrantSubject, 0, len(targetDepts)+len(targetGroups)+len(targetUsers))
	for id := range targetDepts {
		subjects = append(subjects, model.ModelGrantSubject{Type: model.SubjectTypeDepartment, Id: id})
	}
	for id := range targetGroups {
		subjects = append(subjects, model.ModelGrantSubject{Type: model.SubjectTypeUserGroup, Id: id})
	}
	for id := range targetUsers {
		subjects = append(subjects, model.ModelGrantSubject{Type: model.SubjectTypeUser, Id: id})
	}
	batch, err := model.CreateModelGrantBatch(subjects, setIds, req.ModelNames, req.CustomSetName, expiredAt, actorId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 4. Invalidate caches
	for deptId := range targetDepts {
		service.InvalidateDeptModelAuthCache(deptId)
	}
	for groupId := range targetGroups {
		service.InvalidateGroupModelAuthCache(groupId)
	}
	for userId := range targetUsers {
		service.InvalidateUserModelAuthCache(userId)
	}

	_ = model.RecordAuthAudit(actorId, "model_grant_created", "model_grant", batch.Id, req)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "授权成功", "data": batch})
}

func RevokeModelGrant(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的授权 ID"})
		return
	}

	var grant model.ModelGrant
	if err := model.DB.First(&grant, id).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "授权记录不存在"})
		return
	}

	if err := model.RevokeModelGrant(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	switch grant.SubjectType {
	case model.SubjectTypeUser:
		service.InvalidateUserModelAuthCache(grant.SubjectId)
	case model.SubjectTypeUserGroup:
		service.InvalidateGroupModelAuthCache(grant.SubjectId)
	case model.SubjectTypeDepartment:
		service.InvalidateDeptModelAuthCache(grant.SubjectId)
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "model_grant_revoked", "model_grant", id, grant)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "撤销授权成功"})
}

func RevokeModelGrantBatch(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "授权批次无效"})
		return
	}
	grants, err := model.RevokeModelGrantBatch(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	for _, grant := range grants {
		switch grant.SubjectType {
		case model.SubjectTypeUser:
			service.InvalidateUserModelAuthCache(grant.SubjectId)
		case model.SubjectTypeUserGroup:
			service.InvalidateGroupModelAuthCache(grant.SubjectId)
		case model.SubjectTypeDepartment:
			service.InvalidateDeptModelAuthCache(grant.SubjectId)
		}
	}
	_ = model.RecordAuthAudit(c.GetInt("id"), "model_grant_batch_revoked", "model_grant_batch", id, grants)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "撤销授权成功"})
}

func GetModelGrantBatchDetail(c *gin.Context) {
	idStr := c.Param("id")
	isLegacy := c.Query("type") == "legacy" || strings.HasPrefix(idStr, "grant_")
	cleanIdStr := strings.TrimPrefix(strings.TrimPrefix(idStr, "batch_"), "grant_")
	id, err := strconv.Atoi(cleanIdStr)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "授权 ID 无效"})
		return
	}
	detail, err := model.GetModelGrantBatchDetail(id, isLegacy)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": detail})
}

