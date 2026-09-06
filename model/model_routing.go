package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// ModelRoutingPolicy distinguishes new model-based grants from legacy empty
// routing groups, which must continue to inherit the user's/token's group.
const ModelRoutingPolicy = "@model"

func (m *Model) ValidateRoutingGroups() error {
	if m.RoutingGroups == "" {
		return nil
	}
	if m.NameRule != NameRuleExact {
		return errors.New("Routing policies require an exact model name")
	}
	var groups []string
	if err := common.UnmarshalJsonStr(m.RoutingGroups, &groups); err != nil || groups == nil || len(groups) > 32 {
		return errors.New("Invalid model routing pools")
	}
	seen := make(map[string]bool)
	for _, group := range groups {
		if group == "" || strings.TrimSpace(group) != group || group == "auto" || group == ModelRoutingPolicy || !ratio_setting.ContainsGroupRatio(group) || seen[group] {
			return errors.New("Invalid model routing pools")
		}
		seen[group] = true
	}
	return nil
}

// GetModelRoutingGroups uses exact model metadata only. An unconfigured model
// stays in default; discovering a new channel must never expand its policy.
func GetModelRoutingGroups(name string) ([]string, error) {
	m, err := GetModelByName(name)
	if err == nil && m == nil {
		matchingName := ratio_setting.FormatMatchingModelName(name)
		if matchingName != name {
			m, err = GetModelByName(matchingName)
		}
	}
	if err != nil {
		return nil, err
	}
	if m == nil || m.NameRule != NameRuleExact || m.RoutingGroups == "" {
		return []string{"default"}, nil
	}
	if err := m.ValidateRoutingGroups(); err != nil {
		return nil, err
	}
	var groups []string
	if err := common.UnmarshalJsonStr(m.RoutingGroups, &groups); err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return []string{"default"}, nil
	}
	return groups, nil
}

// ValidateGrantRouting is kept for legacy compatibility. Model authorization is now decoupled from channel pools.
func ValidateGrantRouting(setIDs []int, names []string, routingGroup string) error {
	return nil
}
