package operation_setting

import (
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"strings"
	"testing"
)

func TestUsageSettingLegacyPresetAndExplicitOverrides(t *testing.T) {
	original := SelfUseModeEnabled
	t.Cleanup(func() { SelfUseModeEnabled = original })
	for _, legacy := range []bool{false, true} {
		SelfUseModeEnabled = legacy
		s := UsageSetting{}
		assert.Equal(t, legacy, s.AllowUnpricedModels())
		assert.Equal(t, legacy, s.ShowUnpricedModels())
		assert.Equal(t, !legacy, s.ShowRegistration())
		assert.Equal(t, legacy, s.ShowSiteLabel())
		require.NoError(t, config.UpdateConfigFromMap(&s, map[string]string{
			"allow_unpriced_models_enabled": "true", "show_unpriced_models_enabled": "false",
			"show_registration_enabled": "true", "site_label_enabled": "false", "site_label_text": "内部服务",
		}))
		values, err := config.ConfigToMap(&s)
		require.NoError(t, err)
		reloaded := UsageSetting{}
		require.NoError(t, config.UpdateConfigFromMap(&reloaded, values))
		assert.True(t, reloaded.AllowUnpricedModels())
		assert.False(t, reloaded.ShowUnpricedModels())
		assert.True(t, reloaded.ShowRegistration())
		assert.False(t, reloaded.ShowSiteLabel())
		assert.Equal(t, "内部服务", reloaded.SiteLabelText)
	}
}

func TestValidateSiteLabel(t *testing.T) {
	for _, tc := range []struct {
		name, text string
		valid      bool
	}{
		{"empty", "", false}, {"whitespace", " \t", false},
		{"custom", "内部服务", true}, {"unicode boundary", strings.Repeat("😀", 20), true},
		{"too long", strings.Repeat("字", 21), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSiteLabel(tc.text)
			if tc.valid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}
