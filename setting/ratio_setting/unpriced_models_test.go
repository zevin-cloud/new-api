package ratio_setting

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestUnpricedModelCallPermissionDoesNotCreatePricing(t *testing.T) {
	setting := operation_setting.GetUsageSetting()
	original := *setting
	t.Cleanup(func() { *setting = original })
	const modelName = "test-unpriced-model-independent-controls"
	require.False(t, HasConfiguredModelRatio(modelName))
	for _, allowed := range []bool{false, true} {
		setting.AllowUnpricedModelsEnabled = &allowed
		ratio, accepted, _ := GetModelRatio(modelName)
		assert.Equal(t, allowed, accepted)
		assert.Positive(t, ratio, "unpriced models must not become free")
		assert.False(t, HasConfiguredModelRatio(modelName), "fallback billing is not configured pricing")
	}
}
