package clientoauth

import (
	"bufio"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service/clientauth"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClientOAuthUsesProviderHostAndBearerToken(t *testing.T) {
	for _, tc := range []struct {
		provider, endpoint string
		mode               int
	}{
		{"kimi", "https://api.kimi.com/coding/v1/chat/completions", relayconstant.RelayModeChatCompletions},
		{"codex", "https://chatgpt.com/backend-api/codex/responses", relayconstant.RelayModeResponses},
		{"claude", "https://api.anthropic.com/v1/messages", relayconstant.RelayModeChatCompletions},
		{"antigravity", "https://cloudcode-pa.googleapis.com/v1internal:generateContent", relayconstant.RelayModeChatCompletions},
	} {
		t.Run(tc.provider, func(t *testing.T) {
			key, err := common.Marshal(clientauth.TokenBundle{Provider: tc.provider, AccessToken: "access", RefreshToken: "refresh", AccountID: "account"})
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{RelayMode: tc.mode, ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeClientOAuth, ApiKey: string(key), ChannelBaseUrl: "https://untrusted.example"}}
			adaptor := &Adaptor{}
			adaptor.Init(info)
			endpoint, err := adaptor.GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tc.endpoint, endpoint)
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			headers := http.Header{}
			require.NoError(t, adaptor.SetupRequestHeader(ctx, &headers, info))
			assert.Equal(t, "Bearer access", headers.Get("Authorization"))
			assert.Empty(t, headers.Get("x-api-key"))
			assert.NotContains(t, headers, "refresh")
			if tc.provider == "codex" {
				assert.Equal(t, "account", headers.Get("chatgpt-account-id"))
			}
		})
	}
}

func TestAntigravityStreamUnwrapsUsageAndPreservesSSEFrames(t *testing.T) {
	wire := "event: message\ndata: {\"response\":{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]}}]}}\n\ndata: {\"response\":{\"usageMetadata\":{\"totalTokenCount\":12}}}\n\ndata: [DONE]\n\n"
	body := io.NopCloser(strings.NewReader(wire))
	stream := &antigravityStream{body: body, scanner: bufio.NewScanner(body)}
	output, err := io.ReadAll(stream)
	require.NoError(t, err)
	assert.Equal(t, "event: message\ndata: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"hello\"}]}}]}\n\ndata: {\"usageMetadata\":{\"totalTokenCount\":12}}\n\ndata: [DONE]\n\n", string(output))
}

func TestAntigravityStreamRejectsMalformedEnvelope(t *testing.T) {
	for _, wire := range []string{"data: invalid\n\n", "data: {\"error\":\"denied\"}\n\n"} {
		body := io.NopCloser(strings.NewReader(wire))
		_, err := io.ReadAll(&antigravityStream{body: body, scanner: bufio.NewScanner(body)})
		require.Error(t, err)
	}
}

func TestAntigravityHTTP1AndUserAgent(t *testing.T) {
	key, err := common.Marshal(clientauth.TokenBundle{Provider: "antigravity", AccessToken: "ag-token", ProjectID: "proj-1"})
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeClientOAuth, ApiKey: string(key), ChannelBaseUrl: "https://daily-cloudcode-pa.googleapis.com"},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	assert.Equal(t, "http1", info.ChannelSetting.HTTPProtocol)

	endpoint, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse", endpoint)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	headers := http.Header{}
	require.NoError(t, adaptor.SetupRequestHeader(ctx, &headers, info))
	assert.Equal(t, "Bearer ag-token", headers.Get("Authorization"))
	assert.Equal(t, "antigravity/hub/2.9.1 darwin/arm64", headers.Get("User-Agent"))
}

