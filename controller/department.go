package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetDepartmentTree(c *gin.Context) {
	tree, err := model.GetDepartmentTree()
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
		"data":    tree,
	})
}

func GetAllDepartments(c *gin.Context) {
	depts, err := model.GetAllDepartments()
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
		"data":    depts,
	})
}

func GetDepartment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的部门 ID",
		})
		return
	}
	dept, err := model.GetDepartmentById(id)
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
		"data":    dept,
	})
}

func CreateDepartment(c *gin.Context) {
	var dept model.Department
	if err := c.ShouldBindJSON(&dept); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数解析失败: " + err.Error(),
		})
		return
	}
	if dept.Name == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "部门名称不能为空",
		})
		return
	}

	if err := dept.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "department_created", "department", dept.Id, dept.Name)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建部门成功",
		"data":    dept,
	})
}

func UpdateDepartment(c *gin.Context) {
	var dept model.Department
	if err := c.ShouldBindJSON(&dept); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "参数解析失败: " + err.Error(),
		})
		return
	}
	if dept.Id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的部门 ID",
		})
		return
	}
	if dept.Name == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "部门名称不能为空",
		})
		return
	}

	if err := dept.Update(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "department_updated", "department", dept.Id, dept.Name)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新部门成功",
		"data":    dept,
	})
}

func DeleteDepartment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的部门 ID",
		})
		return
	}

	if err := model.DeleteDepartment(id); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "department_deleted", "department", id, "")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除部门成功",
	})
}
