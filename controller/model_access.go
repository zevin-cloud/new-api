package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetMyModelPermissions returns the current user's effective model access status for Model Plaza
func GetMyModelPermissions(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户未登录"})
		return
	}

	grantedMap, allAccess, err := service.GetUserGrantedModelMap(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// Fetch pending requests for this user
	var pendingRequests []model.ModelAccessRequest
	_ = model.DB.Where("user_id = ? AND status = ?", userId, model.RequestStatusPending).Find(&pendingRequests)
	pendingMap := make(map[string]bool)
	for _, req := range pendingRequests {
		pendingMap[req.TargetName] = true
	}

	// Get list of model names
	grantedModels := make([]string, 0, len(grantedMap))
	for m := range grantedMap {
		grantedModels = append(grantedModels, m)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"all_access":     allAccess,
			"granted_models": grantedModels,
			"pending_models": pendingMap,
		},
	})
}

func SubmitModelAccessRequest(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户未登录"})
		return
	}

	var req model.ModelAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数解析失败: " + err.Error()})
		return
	}

	req.UserId = userId
	if err := req.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	_ = model.RecordAuthAudit(userId, "access_request_submitted", "request", req.Id, req)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "申请已提交，请等待管理员审批",
		"data":    req,
	})
}

func GetMyAccessRequests(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户未登录"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))

	requests, total, err := model.GetUserAccessRequests(userId, page, pageSize, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items": requests,
			"total": total,
			"page":  page,
		},
	})
}

func GetAllAccessRequests(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))
	targetType, _ := strconv.Atoi(c.DefaultQuery("target_type", "0"))
	keyword := c.Query("keyword")

	requests, total, err := model.GetAccessRequests(page, pageSize, status, targetType, keyword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items": requests,
			"total": total,
			"page":  page,
		},
	})
}

type ReviewActionRequest struct {
	Comment      string `json:"comment"`
	DurationDays int    `json:"duration_days"`
}

func ApproveAccessRequest(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的申请单 ID"})
		return
	}

	var req ReviewActionRequest
	_ = c.ShouldBindJSON(&req)

	reviewerId := c.GetInt("id")
	if err := model.ApproveAccessRequest(id, reviewerId, req.Comment, req.DurationDays); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	var accessReq model.ModelAccessRequest
	if err := model.DB.First(&accessReq, id).Error; err == nil {
		service.InvalidateUserModelAuthCache(accessReq.UserId)
	}

	_ = model.RecordAuthAudit(reviewerId, "access_request_approved", "request", id, req)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "审批通过"})
}

func RejectAccessRequest(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的申请单 ID"})
		return
	}

	var req ReviewActionRequest
	_ = c.ShouldBindJSON(&req)

	reviewerId := c.GetInt("id")
	if err := model.RejectAccessRequest(id, reviewerId, req.Comment); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	_ = model.RecordAuthAudit(reviewerId, "access_request_rejected", "request", id, req)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已拒绝申请"})
}

func CancelAccessRequest(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的申请单 ID"})
		return
	}

	userId := c.GetInt("id")
	if err := model.CancelAccessRequest(id, userId); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "申请已撤销"})
}

// GetUserDetailAdmin returns complete user enterprise details for SideSheet
func GetUserDetailAdmin(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的用户 ID"})
		return
	}

	user, err := model.GetUserById(id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	// Fetch Department
	var deptName string
	if user.DepartmentId > 0 {
		dept, _ := model.GetDepartmentById(user.DepartmentId)
		if dept != nil {
			deptName = dept.Name
		}
	}

	// Fetch User Groups
	groups, _ := model.GetUserGroupsByUserId(user.Id)

	// Fetch Effective Model Permissions
	effectiveModels, _ := model.GetEffectiveModelNamesForUser(user.Id)

	// Fetch Token Summary
	var tokenCount int64
	_ = model.DB.Model(&model.Token{}).Where("user_id = ?", user.Id).Count(&tokenCount)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"user":             user,
			"department_name":  deptName,
			"user_groups":      groups,
			"effective_models": effectiveModels,
			"token_count":      tokenCount,
		},
	})
}
