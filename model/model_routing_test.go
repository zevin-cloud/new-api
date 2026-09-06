package model

import (
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"testing"
)

// Exact model schema from release v1.0.0-rc.30.
type releasedRoutingModel struct {
	Id           int            `json:"id"`
	ModelName    string         `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name_delete_at,priority:1"`
	Description  string         `json:"description,omitempty" gorm:"type:text"`
	Icon         string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Tags         string         `json:"tags,omitempty" gorm:"type:varchar(255)"`
	VendorID     int            `json:"vendor_id,omitempty" gorm:"index"`
	Endpoints    string         `json:"endpoints,omitempty" gorm:"type:text"`
	Status       int            `json:"status" gorm:"default:1"`
	SyncOfficial int            `json:"sync_official" gorm:"default:1"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime  int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_model_name_delete_at,priority:2"`

	BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
	EnableGroups  []string       `json:"enable_groups,omitempty" gorm:"-"`
	QuotaTypes    []int          `json:"quota_types,omitempty" gorm:"-"`
	NameRule      int            `json:"name_rule" gorm:"default:0"`

	MatchedModels []string `json:"matched_models,omitempty" gorm:"-"`
	MatchedCount  int      `json:"matched_count,omitempty" gorm:"-"`
}

func (releasedRoutingModel) TableName() string { return "models" }

func TestModelRoutingMigration(t *testing.T) {
	for _, upgrade := range []bool{false, true} {
		t.Run(map[bool]string{false: "fresh", true: "released"}[upgrade], func(t *testing.T) {
			setupModelGrantTestDB(t)
			versionQuery := "SELECT VERSION()"
			if DB.Dialector.Name() == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, DB.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)
			require.NoError(t, DB.Migrator().DropTable(&Model{}))
			if upgrade {
				require.NoError(t, DB.AutoMigrate(&releasedRoutingModel{}))
				require.NoError(t, DB.Create(&releasedRoutingModel{Id: 41, ModelName: "existing", Description: "preserved", Status: 1}).Error)
			}
			for i := 0; i < 2; i++ {
				require.NoError(t, DB.AutoMigrate(&Model{}))
			}
			if upgrade {
				var saved Model
				require.NoError(t, DB.First(&saved, 41).Error)
				assert.Equal(t, "existing", saved.ModelName)
				assert.Equal(t, "preserved", saved.Description)
				assert.Empty(t, saved.RoutingGroups)
				groups, err := GetModelRoutingGroups("existing")
				require.NoError(t, err)
				assert.Equal(t, []string{"default"}, groups)
			}
			item := Model{ModelName: "configured", RoutingGroups: `["default"]`, Status: 1}
			require.NoError(t, item.Insert())
			require.NoError(t, DB.AutoMigrate(&Model{}))
			var saved Model
			require.NoError(t, DB.First(&saved, item.Id).Error)
			assert.Equal(t, item.RoutingGroups, saved.RoutingGroups)
			// Older clients omit routing data when editing metadata.
			saved.RoutingGroups = ""
			saved.Description = "updated"
			require.NoError(t, saved.Update())
			require.NoError(t, DB.First(&saved, item.Id).Error)
			assert.Equal(t, `["default"]`, saved.RoutingGroups)
			assert.True(t, DB.Migrator().HasIndex(&Model{}, "uk_model_name_delete_at"))
		})
	}
}

func TestModelRoutingValidation(t *testing.T) {
	setupModelGrantTestDB(t)
	original := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(original)) })
	for _, value := range []string{`null`, `{}`, `["auto"]`, `["missing"]`, `["vip","vip"]`} {
		m := Model{RoutingGroups: value}
		assert.Error(t, m.ValidateRoutingGroups())
	}
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	t.Cleanup(func() { require.NoError(t, DB.Migrator().DropTable(&Ability{})) })
	require.NoError(t, DB.Create(&Model{ModelName: "a", RoutingGroups: `["default"]`}).Error)
	require.NoError(t, DB.Create(&Model{ModelName: "b", RoutingGroups: `["vip"]`}).Error)
	require.NoError(t, DB.Create(&[]Ability{{Group: "default", Model: "a", ChannelId: 1, Enabled: true}, {Group: "vip", Model: "b", ChannelId: 2, Enabled: true}}).Error)
	require.NoError(t, ValidateGrantRouting(nil, []string{"a", "b"}, ModelRoutingPolicy))
	require.NoError(t, ValidateGrantRouting(nil, []string{"a", "b"}, "vip"))
	require.NoError(t, DB.Create(&Model{ModelName: "gpt-4o-gizmo-*", RoutingGroups: `["vip"]`}).Error)
	aliasGroups, aliasErr := GetModelRoutingGroups("gpt-4o-gizmo-example")
	require.NoError(t, aliasErr)
	assert.Equal(t, []string{"vip"}, aliasGroups)
	groups, err := GetModelRoutingGroups("unknown")
	require.NoError(t, err)
	assert.Equal(t, []string{"default"}, groups)
}
