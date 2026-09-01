package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	DepartmentStatusEnabled  = 1
	DepartmentStatusDisabled = 2
)

type Department struct {
	Id            int            `json:"id"`
	Name          string         `json:"name" gorm:"type:varchar(64);not null;index"`
	ParentId      int            `json:"parent_id" gorm:"type:int;default:0;index"`
	Path          string         `json:"path" gorm:"type:varchar(255);default:'';index"` // e.g., "/1/5/12"
	ManagerUserId int            `json:"manager_user_id" gorm:"type:int;default:0"`
	Description   string         `json:"description" gorm:"type:text"`
	SortOrder     int            `json:"sort_order" gorm:"type:int;default:0"`
	Status        int            `json:"status" gorm:"type:int;default:1"`
	CreatedAt     int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`

	// Non-db response fields
	Children []*Department `json:"children,omitempty" gorm:"-"`
}

func (d *Department) Insert() error {
	var err error
	d.CreatedAt = common.GetTimestamp()
	d.UpdatedAt = common.GetTimestamp()
	if d.Status == 0 {
		d.Status = DepartmentStatusEnabled
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		if d.ParentId > 0 {
			var parent Department
			if err = tx.First(&parent, d.ParentId).Error; err != nil {
				return fmt.Errorf("父部门不存在: %w", err)
			}
			d.Path = fmt.Sprintf("%s/%d", parent.Path, d.ParentId)
		} else {
			d.ParentId = 0
			d.Path = ""
		}

		if err = tx.Create(d).Error; err != nil {
			return err
		}
		return nil
	})
}

func (d *Department) Update() error {
	d.UpdatedAt = common.GetTimestamp()
	return DB.Transaction(func(tx *gorm.DB) error {
		var old Department
		if err := tx.First(&old, d.Id).Error; err != nil {
			return err
		}

		// Calculate new path if parent changed
		if d.ParentId != old.ParentId {
			if d.ParentId == d.Id {
				return errors.New("不能将父部门设置为自己")
			}
			if d.ParentId > 0 {
				var parent Department
				if err := tx.First(&parent, d.ParentId).Error; err != nil {
					return fmt.Errorf("父部门不存在: %w", err)
				}
				// Cannot move to own subtree
				oldSubPrefix := fmt.Sprintf("%s/%d", old.Path, old.Id)
				if parent.Path == oldSubPrefix || strings.HasPrefix(parent.Path, oldSubPrefix+"/") {
					return errors.New("不能将部门移动到其子部门下")
				}
				d.Path = fmt.Sprintf("%s/%d", parent.Path, d.ParentId)
			} else {
				d.ParentId = 0
				d.Path = ""
			}

			// Update all children's paths
			oldPrefix := fmt.Sprintf("%s/%d", old.Path, old.Id)
			newPrefix := fmt.Sprintf("%s/%d", d.Path, d.Id)
			var subDepts []Department
			if err := tx.Where("path = ? OR path LIKE ?", oldPrefix, oldPrefix+"/%").Find(&subDepts).Error; err != nil {
				return err
			}
			for _, sub := range subDepts {
				newSubPath := strings.Replace(sub.Path, oldPrefix, newPrefix, 1)
				if err := tx.Model(&Department{}).Where("id = ?", sub.Id).Update("path", newSubPath).Error; err != nil {
					return err
				}
			}
		}

		return tx.Model(d).Where("id = ?", d.Id).Updates(map[string]any{
			"name":            d.Name,
			"parent_id":       d.ParentId,
			"path":            d.Path,
			"manager_user_id": d.ManagerUserId,
			"description":     d.Description,
			"sort_order":      d.SortOrder,
			"status":          d.Status,
			"updated_at":      d.UpdatedAt,
		}).Error
	})
}

func DeleteDepartment(id int) error {
	if id <= 0 {
		return errors.New("部门 ID 无效")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		// Check for sub-departments
		var childCount int64
		if err := tx.Model(&Department{}).Where("parent_id = ?", id).Count(&childCount).Error; err != nil {
			return err
		}
		if childCount > 0 {
			return errors.New("该部门下存在子部门，请先处理子部门")
		}

		// Check for assigned users
		var userCount int64
		if err := tx.Model(&User{}).Where("department_id = ?", id).Count(&userCount).Error; err != nil {
			return err
		}
		if userCount > 0 {
			return errors.New("该部门下仍有用户，请先转移或移除用户")
		}

		// Check for model grants
		var grantCount int64
		if err := tx.Model(&ModelGrant{}).Where("subject_type = ? AND subject_id = ?", SubjectTypeDepartment, id).Count(&grantCount).Error; err != nil {
			return err
		}
		if grantCount > 0 {
			return errors.New("该部门存在模型授权，请先撤销相关授权")
		}

		return tx.Delete(&Department{}, id).Error
	})
}

func GetDepartmentById(id int) (*Department, error) {
	if id <= 0 {
		return nil, errors.New("部门 ID 无效")
	}
	var d Department
	err := DB.First(&d, id).Error
	return &d, err
}

func GetAllDepartments() ([]*Department, error) {
	var departments []*Department
	err := DB.Order("sort_order ASC, id ASC").Find(&departments).Error
	return departments, err
}

func GetDepartmentTree() ([]*Department, error) {
	all, err := GetAllDepartments()
	if err != nil {
		return nil, err
	}

	deptMap := make(map[int]*Department)
	for _, d := range all {
		d.Children = make([]*Department, 0)
		deptMap[d.Id] = d
	}

	var root []*Department
	for _, d := range all {
		if d.ParentId == 0 {
			root = append(root, d)
		} else if parent, exists := deptMap[d.ParentId]; exists {
			parent.Children = append(parent.Children, d)
		} else {
			// Orphan node treated as root
			root = append(root, d)
		}
	}
	return root, nil
}

// GetDepartmentAndSubIds returns the department ID and all its descendant department IDs.
func GetDepartmentAndSubIds(deptId int) ([]int, error) {
	if deptId <= 0 {
		return nil, nil
	}
	var target Department
	if err := DB.First(&target, deptId).Error; err != nil {
		return nil, err
	}

	prefix := fmt.Sprintf("%s/%d", target.Path, target.Id)
	var subIds []int
	err := DB.Model(&Department{}).
		Where("id = ? OR path = ? OR path LIKE ?", target.Id, prefix, prefix+"/%").
		Pluck("id", &subIds).Error
	return subIds, err
}
