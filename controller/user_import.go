package controller

import (
	"encoding/csv"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type UserImportRow struct {
	RowIndex     int    `json:"row_index"`
	Username     string `json:"username"`
	DisplayName  string `json:"display_name"`
	Email        string `json:"email"`
	EmployeeId   string `json:"employee_id"`
	Department   string `json:"department"`
	UserGroups   string `json:"user_groups"`
	Action       string `json:"action"` // "create", "update", "skip", "error"
	ErrorMessage string `json:"error_message,omitempty"`
}

type UserImportSummary struct {
	Total       int              `json:"total"`
	CreateCount int              `json:"create_count"`
	UpdateCount int              `json:"update_count"`
	ErrorCount  int              `json:"error_count"`
	Rows        []*UserImportRow `json:"rows"`
}

func parseImportCSV(reader io.Reader) ([]*UserImportRow, error) {
	csvReader := csv.NewReader(reader)
	csvReader.TrimLeadingSpace = true

	headers, err := csvReader.Read()
	if err != nil {
		return nil, err
	}

	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.TrimSpace(strings.ToLower(h))] = i
	}

	var rows []*UserImportRow
	rowIndex := 1

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		rowIndex++

		row := &UserImportRow{
			RowIndex: rowIndex,
		}

		getVal := func(keys ...string) string {
			for _, k := range keys {
				if idx, ok := headerMap[k]; ok && idx < len(record) {
					return strings.TrimSpace(record[idx])
				}
			}
			return ""
		}

		row.Username = getVal("username", "用户名", "user")
		row.DisplayName = getVal("display_name", "姓名", "显示名称", "name")
		row.Email = getVal("email", "邮箱", "mail")
		row.EmployeeId = getVal("employee_id", "工号", "id")
		row.Department = getVal("department", "部门", "部门路径", "dept")
		row.UserGroups = getVal("user_groups", "用户组", "groups")

		if row.Username == "" && row.Email == "" {
			continue
		}
		rows = append(rows, row)
	}

	return rows, nil
}

func validateAndClassifyRows(rows []*UserImportRow) *UserImportSummary {
	summary := &UserImportSummary{
		Total: len(rows),
		Rows:  rows,
	}

	allDepts, _ := model.GetAllDepartments()
	deptMap := make(map[string]int)
	for _, d := range allDepts {
		deptMap[d.Name] = d.Id
	}

	allGroups, _, _ := model.GetUserGroups(1, 1000, "", 0)
	groupMap := make(map[string]int)
	for _, g := range allGroups {
		groupMap[g.Name] = g.Id
	}

	for _, r := range rows {
		if r.Username == "" {
			r.Action = "error"
			r.ErrorMessage = "用户名不能为空"
			summary.ErrorCount++
			continue
		}

		// Check if user already exists
		var existingUser model.User
		err := model.DB.Where("username = ?", r.Username).First(&existingUser).Error
		if err == nil {
			r.Action = "update"
			summary.UpdateCount++
		} else {
			r.Action = "create"
			summary.CreateCount++
		}
	}

	return summary
}

func PreviewUserImport(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请上传 CSV 文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无法读取文件: " + err.Error()})
		return
	}
	defer src.Close()

	rows, err := parseImportCSV(src)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "CSV 解析失败: " + err.Error()})
		return
	}

	summary := validateAndClassifyRows(rows)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    summary,
	})
}

type ExecuteImportRequest struct {
	Rows []*UserImportRow `json:"rows"`
}

func ExecuteUserImport(c *gin.Context) {
	var req ExecuteImportRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Rows) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请提供待导入的用户数据"})
		return
	}

	allDepts, _ := model.GetAllDepartments()
	deptMap := make(map[string]int)
	for _, d := range allDepts {
		deptMap[d.Name] = d.Id
	}

	allGroups, _, _ := model.GetUserGroups(1, 1000, "", 0)
	groupMap := make(map[string]int)
	for _, g := range allGroups {
		groupMap[g.Name] = g.Id
	}

	successCount := 0
	errorCount := 0

	for _, r := range req.Rows {
		if r.Action == "error" || r.Username == "" {
			errorCount++
			continue
		}

		deptId := 0
		if r.Department != "" {
			if id, ok := deptMap[r.Department]; ok {
				deptId = id
			}
		}

		var groupIds []int
		if r.UserGroups != "" {
			groupNames := strings.Split(r.UserGroups, ",")
			for _, gn := range groupNames {
				gn = strings.TrimSpace(gn)
				if gid, ok := groupMap[gn]; ok {
					groupIds = append(groupIds, gid)
				}
			}
		}

		var existing model.User
		if err := model.DB.Where("username = ?", r.Username).First(&existing).Error; err == nil {
			// Update
			updates := map[string]any{
				"display_name": r.DisplayName,
				"email":        r.Email,
				"employee_id":  r.EmployeeId,
			}
			if deptId > 0 {
				updates["department_id"] = deptId
			}
			_ = model.DB.Model(&existing).Updates(updates)

			if len(groupIds) > 0 {
				for _, gid := range groupIds {
					_ = model.AddUserToGroup(gid, existing.Id)
				}
			}
			successCount++
		} else {
			// Create
			hashedPassword, _ := common.Password2Hash("123456")
			newUser := model.User{
				Username:     r.Username,
				Password:     hashedPassword,
				DisplayName:  r.DisplayName,
				Email:        r.Email,
				EmployeeId:   r.EmployeeId,
				DepartmentId: deptId,
				Role:         common.RoleCommonUser,
				Status:       common.UserStatusEnabled,
				Group:        "default",
			}
			if err := model.DB.Create(&newUser).Error; err == nil {
				if len(groupIds) > 0 {
					for _, gid := range groupIds {
						_ = model.AddUserToGroup(gid, newUser.Id)
					}
				}
				successCount++
			} else {
				errorCount++
			}
		}
	}

	actorId := c.GetInt("id")
	_ = model.RecordAuthAudit(actorId, "users_imported", "user", 0, map[string]any{
		"success_count": successCount,
		"error_count":   errorCount,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "导入完成",
		"data": gin.H{
			"success_count": successCount,
			"error_count":   errorCount,
		},
	})
}
