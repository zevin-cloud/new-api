package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ModelSetItem struct {
	Id         int    `json:"id"`
	ModelSetId int    `json:"model_set_id" gorm:"type:int;not null;index;uniqueIndex:uk_set_model"`
	ModelName  string `json:"model_name" gorm:"type:varchar(128);not null;index;uniqueIndex:uk_set_model"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
}

func AddModelsToModelSet(modelSetId int, modelNames []string) error {
	if modelSetId <= 0 || len(modelNames) == 0 {
		return nil
	}

	now := common.GetTimestamp()
	items := make([]ModelSetItem, 0, len(modelNames))
	for _, m := range modelNames {
		if m != "" {
			items = append(items, ModelSetItem{
				ModelSetId: modelSetId,
				ModelName:  m,
				CreatedAt:  now,
			})
		}
	}
	if len(items) == 0 {
		return nil
	}

	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&items).Error
}

func RemoveModelsFromModelSet(modelSetId int, modelNames []string) error {
	if modelSetId <= 0 || len(modelNames) == 0 {
		return nil
	}
	return DB.Where("model_set_id = ? AND model_name IN ?", modelSetId, modelNames).Delete(&ModelSetItem{}).Error
}

func SetModelSetModels(modelSetId int, modelNames []string) error {
	if modelSetId <= 0 {
		return errors.New("模型集 ID 无效")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("model_set_id = ?", modelSetId).Delete(&ModelSetItem{}).Error; err != nil {
			return err
		}

		if len(modelNames) == 0 {
			return nil
		}

		now := common.GetTimestamp()
		items := make([]ModelSetItem, 0, len(modelNames))
		for _, m := range modelNames {
			if m != "" {
				items = append(items, ModelSetItem{
					ModelSetId: modelSetId,
					ModelName:  m,
					CreatedAt:  now,
				})
			}
		}
		if len(items) > 0 {
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&items).Error
		}
		return nil
	})
}

func GetModelNamesByModelSetId(modelSetId int) ([]string, error) {
	if modelSetId <= 0 {
		return nil, nil
	}
	var names []string
	err := DB.Model(&ModelSetItem{}).Where("model_set_id = ?", modelSetId).Pluck("model_name", &names).Error
	return names, err
}

func GetModelNamesByModelSetIds(modelSetIds []int) ([]string, error) {
	if len(modelSetIds) == 0 {
		return nil, nil
	}
	var names []string
	err := DB.Model(&ModelSetItem{}).Where("model_set_id IN ?", modelSetIds).Distinct("model_name").Pluck("model_name", &names).Error
	return names, err
}

func GetModelSetIdsByModelName(modelName string) ([]int, error) {
	if modelName == "" {
		return nil, nil
	}
	var setIds []int
	err := DB.Model(&ModelSetItem{}).Where("model_name = ?", modelName).Pluck("model_set_id", &setIds).Error
	return setIds, err
}
