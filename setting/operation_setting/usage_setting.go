package operation_setting

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/setting/config"
)

// Nil switches inherit the legacy preset until individually configured.
type UsageSetting struct {
	AllowUnpricedModelsEnabled *bool  `json:"allow_unpriced_models_enabled"`
	ShowUnpricedModelsEnabled  *bool  `json:"show_unpriced_models_enabled"`
	ShowRegistrationEnabled    *bool  `json:"show_registration_enabled"`
	SiteLabelEnabled           *bool  `json:"site_label_enabled"`
	SiteLabelText              string `json:"site_label_text"`
}

var usageSetting = UsageSetting{SiteLabelText: "自用模式"}

func init() {
	config.GlobalConfig.Register("usage_setting", &usageSetting)
}

func GetUsageSetting() *UsageSetting { return &usageSetting }

func (s *UsageSetting) AllowUnpricedModels() bool {
	if s.AllowUnpricedModelsEnabled != nil {
		return *s.AllowUnpricedModelsEnabled
	}
	return SelfUseModeEnabled
}

func (s *UsageSetting) ShowUnpricedModels() bool {
	if s.ShowUnpricedModelsEnabled != nil {
		return *s.ShowUnpricedModelsEnabled
	}
	return SelfUseModeEnabled
}

func (s *UsageSetting) ShowRegistration() bool {
	if s.ShowRegistrationEnabled != nil {
		return *s.ShowRegistrationEnabled
	}
	return !SelfUseModeEnabled
}

func (s *UsageSetting) ShowSiteLabel() bool {
	if s.SiteLabelEnabled != nil {
		return *s.SiteLabelEnabled
	}
	return SelfUseModeEnabled
}

func ValidateSiteLabel(text string) error {
	if strings.TrimSpace(text) == "" || utf8.RuneCountInString(text) > 20 {
		return fmt.Errorf("站点标签须为 1 至 20 个字符，且不能全为空白")
	}
	return nil
}
