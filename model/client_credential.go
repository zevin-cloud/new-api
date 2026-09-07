package model

import (
	"context"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
)

// UpdateClientCredential keeps refresh-token rotation and persistence in one
// transaction. SQLite acquires its write lock before reading the credential.
func UpdateClientCredential(ctx context.Context, id int, refresh func(string) (string, error)) error {
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		query := tx.Model(&Channel{}).Where("id = ? AND type = ? AND status = ?", id, constant.ChannelTypeClientOAuth, common.ChannelStatusEnabled)
		// A no-op write obtains SQLite's write lock and also serializes writers on
		// MySQL/PostgreSQL before the external token is rotated.
		if err := query.UpdateColumn("status", common.ChannelStatusEnabled).Error; err != nil {
			return err
		}
		var channel Channel
		if err := lockForUpdate(tx).Where("id = ? AND type = ? AND status = ?", id, constant.ChannelTypeClientOAuth, common.ChannelStatusEnabled).First(&channel).Error; err != nil {
			return err
		}
		key, err := refresh(channel.Key)
		if err != nil {
			return err
		}
		if key == "" {
			return fmt.Errorf("empty refreshed credential")
		}
		return tx.Model(&Channel{}).Where("id = ?", id).Update("key", key).Error
	})
}
