package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUsageOptionRejectsInvalidValuesBeforePersistence(t *testing.T) {
	for _, tc := range []struct {
		key   string
		value any
	}{
		{"usage_setting.site_label_text", " "},
		{"usage_setting.site_label_text", strings.Repeat("字", 21)},
		{"usage_setting.site_label_enabled", "null"},
		{"usage_setting.show_registration_enabled", "yes"},
		{"usage_setting.unknown", true},
	} {
		t.Run(tc.key+common.Interface2String(tc.value), func(t *testing.T) {
			body, err := common.Marshal(OptionUpdateRequest{Key: tc.key, Value: tc.value})
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(body)))
			UpdateOption(ctx)
			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
			assert.NotEmpty(t, response.Message)
		})
	}
}
