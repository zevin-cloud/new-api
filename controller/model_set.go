package controller

import (
	"net/http"
	"strconv"

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
	SubjectType  int   `json:"subject_type"` // 1: dept, 2: group, 3: user
	SubjectId    int   `json:"subject_id"`
	ModelSetId   int   `json:"model_set_id"`
	DurationDays int   `json:"duration_days"` // 0 = permanent
	ExpiredAt    int64 `json:"expired_at"`
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
	if err := model.GrantModelSet(req.SubjectType, req.SubjectId, req.ModelSetId, expiredAt, actorId); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	switch req.SubjectType {
	case model.SubjectTypeUser:
		service.InvalidateUserModelAuthCache(req.SubjectId)
	case model.SubjectTypeUserGroup:
		service.InvalidateGroupModelAuthCache(req.SubjectId)
	case model.SubjectTypeDepartment:
		service.InvalidateDeptModelAuthCache(req.SubjectId)
	}

	_ = model.RecordAuthAudit(actorId, "model_grant_created", "model_grant", req.ModelSetId, req)

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
