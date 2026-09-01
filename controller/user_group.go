package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func GetAdminUserGroups(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	keyword := c.Query("keyword")
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))

	groups, total, err := model.GetUserGroups(page, pageSize, keyword, status)
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
			"items": groups,
			"total": total,
			"page":  page,
		},
	})
}

func GetAdminUserGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的用户组 ID",
		})
		return
	}

	group, err := model.GetUserGroupById(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	// Fetch grants for this group
	grants, _ := model.GetGrantsBySubject(model.SubjectTypeUserGroup, id)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"group":  group,
			"grants": grants,
		},
	})
}

type UserGroupCreateRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      int    `json:"status"`
	UserIds     []int  `json:"user_ids"`
}

type UserGroupUpdateRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      int    `json:"status"`
	UserIds     *[]int `json:"user_ids"`
}

func CreateAdminUserGroup(c *gin.Context) {
	var req UserGroupCreateRequest
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
			"message": "用户组名称不能为空",
		})
		return
	}

	group := model.UserGroup{
		Name:        req.Name,
		Description: req.Description,
		Status:      req.Status,
		CreatedBy:   c.GetInt("id"),
	}
	if err := group.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if len(req.UserIds) > 0 {
		_ = model.AddUsersToGroup(group.Id, req.UserIds)
		for _, uid := range req.UserIds {
			service.InvalidateUserModelAuthCache(uid)
		}
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "user_group_created", "user_group", group.Id, group.Name)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建用户组成功",
		"data":    group,
	})
}

func UpdateAdminUserGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的用户组 ID",
		})
		return
	}

	var req UserGroupUpdateRequest
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
			"message": "用户组名称不能为空",
		})
		return
	}

	group := model.UserGroup{
		Id:          id,
		Name:        req.Name,
		Description: req.Description,
		Status:      req.Status,
	}

	if err := group.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	if req.UserIds != nil {
		_ = model.SetGroupMembers(id, *req.UserIds)
		for _, uid := range *req.UserIds {
			service.InvalidateUserModelAuthCache(uid)
		}
	}

	service.InvalidateGroupModelAuthCache(group.Id)
	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "user_group_updated", "user_group", group.Id, group.Name)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新用户组成功",
		"data":    group,
	})
}

func DeleteAdminUserGroup(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的用户组 ID",
		})
		return
	}

	if err := model.DeleteUserGroup(id); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	service.InvalidateGroupModelAuthCache(id)
	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "user_group_deleted", "user_group", id, "")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除用户组成功",
	})
}

func GetAdminGroupMembers(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的用户组 ID",
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	members, total, err := model.GetGroupMembers(id, page, pageSize)
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
			"items": members,
			"total": total,
			"page":  page,
		},
	})
}

type GroupMemberActionRequest struct {
	UserIds []int `json:"user_ids"`
}

func AddAdminGroupMembers(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的用户组 ID",
		})
		return
	}

	var req GroupMemberActionRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.UserIds) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请选择要添加的用户",
		})
		return
	}

	if err := model.AddUsersToGroup(id, req.UserIds); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	for _, uid := range req.UserIds {
		service.InvalidateUserModelAuthCache(uid)
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "group_members_added", "user_group", id, req.UserIds)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "添加成员成功",
	})
}

func RemoveAdminGroupMembers(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的用户组 ID",
		})
		return
	}

	var req GroupMemberActionRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.UserIds) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "请选择要移除的用户",
		})
		return
	}

	if err := model.RemoveUsersFromGroup(id, req.UserIds); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	for _, uid := range req.UserIds {
		service.InvalidateUserModelAuthCache(uid)
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "group_members_removed", "user_group", id, req.UserIds)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "移除成员成功",
	})
}

type BatchUserGroupActionRequest struct {
	UserIds []int  `json:"user_ids"`
	GroupId int    `json:"group_id"`
	Action  string `json:"action"` // "add" or "remove"
}

func BatchUpdateUserGroupMembers(c *gin.Context) {
	var req BatchUserGroupActionRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.UserIds) == 0 || req.GroupId <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数不完整",
		})
		return
	}

	if req.Action == "add" {
		if err := model.AddUsersToGroup(req.GroupId, req.UserIds); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
	} else if req.Action == "remove" {
		if err := model.RemoveUsersFromGroup(req.GroupId, req.UserIds); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
			return
		}
	} else {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的操作类型"})
		return
	}

	for _, uid := range req.UserIds {
		service.InvalidateUserModelAuthCache(uid)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "批量操作成功"})
}
