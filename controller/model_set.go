package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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

	var expiredAt int64
	if req.DurationDays > 0 {
		expiredAt = common.GetTimestamp() + int64(req.DurationDays)*86400
	} else if req.ExpiredAt > 0 {
		expiredAt = req.ExpiredAt
	}

	actorId := c.GetInt("id")

	// 1. Gather all target subjects into categorized maps
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

	// 2. Gather target model sets
	finalModelSetMap := make(map[int]bool)
	if req.ModelSetId > 0 {
		finalModelSetMap[req.ModelSetId] = true
	}
	for _, sid := range req.ModelSetIds {
		if sid > 0 {
			finalModelSetMap[sid] = true
		}
	}

	// If discrete models are provided, create an ad-hoc model set
	if len(req.ModelNames) > 0 {
		setName := strings.TrimSpace(req.CustomSetName)
		if setName == "" {
			setName = fmt.Sprintf("直接授权模型集-%s", time.Now().Format("20060102-150405"))
		}
		set := &model.ModelSet{
			Name:        setName,
			Description: "由直接模型授权生成的模型集",
			Status:      model.ModelSetStatusEnabled,
		}
		if err := set.Insert(); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "创建模型集失败: " + err.Error()})
			return
		}
		if err := model.AddModelsToModelSet(set.Id, req.ModelNames); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "添加模型到模型集失败: " + err.Error()})
			return
		}
		finalModelSetMap[set.Id] = true
	}

	if len(finalModelSetMap) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请选择至少一个模型集或具体模型"})
		return
	}

	// 3. Perform grant for all subjects & model sets
	for setId := range finalModelSetMap {
		for deptId := range targetDepts {
			if err := model.GrantModelSet(model.SubjectTypeDepartment, deptId, setId, expiredAt, actorId); err != nil {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
				return
			}
		}
		for groupId := range targetGroups {
			if err := model.GrantModelSet(model.SubjectTypeUserGroup, groupId, setId, expiredAt, actorId); err != nil {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
				return
			}
		}
		for userId := range targetUsers {
			if err := model.GrantModelSet(model.SubjectTypeUser, userId, setId, expiredAt, actorId); err != nil {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
				return
			}
		}
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

	_ = model.RecordAuthAudit(actorId, "model_grant_created", "model_grant", 0, req)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "授权成功"})
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

