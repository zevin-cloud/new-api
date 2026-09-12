package clientauth

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type authTransport func(*http.Request) (*http.Response, error)

func (f authTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func mockOAuth(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	target, err := url.Parse(server.URL)
	require.NoError(t, err)
	previous := OAuthHTTPClient
	OAuthHTTPClient = &http.Client{Transport: authTransport(func(req *http.Request) (*http.Response, error) {
		request := req.Clone(req.Context())
		request.URL.Scheme, request.URL.Host = target.Scheme, target.Host
		return server.Client().Transport.RoundTrip(request)
	})}
	t.Cleanup(func() { OAuthHTTPClient = previous })
}

func TestSessionOwnershipExpiryAndSingleConsumption(t *testing.T) {
	for _, tc := range []struct {
		name    string
		owner   int
		expired bool
		allowed bool
	}{
		{"owner", 7, false, true}, {"other administrator", 8, false, false}, {"expired", 7, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			deadline := time.Now().Add(time.Minute)
			if tc.expired {
				deadline = time.Now().Add(-time.Minute)
			}
			manager := &AuthManager{sessions: map[string]*AuthSession{"session": {ID: "session", OwnerID: 7, Status: AuthStatusSuccess, ExpiresAt: deadline, TokenResult: &TokenBundle{Provider: "kimi", AccessToken: "secret"}}}}
			writes := 0
			create := func(token *TokenBundle) (int, error) {
				writes++
				assert.Equal(t, "secret", token.AccessToken)
				return 42, nil
			}
			id, err := manager.CreateChannel(WithOwner(context.Background(), tc.owner), "session", create)
			if !tc.allowed {
				require.Error(t, err)
				assert.Zero(t, writes)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, 42, id)
			id, err = manager.CreateChannel(WithOwner(context.Background(), tc.owner), "session", create)
			require.NoError(t, err)
			assert.Equal(t, 42, id)
			assert.Equal(t, 1, writes)
			assert.Nil(t, manager.sessions["session"].TokenResult)
		})
	}
}

func TestOAuthCallbackRejectsWrongStateAndExpiredSession(t *testing.T) {
	for _, callback := range []string{"bare-code", "http://localhost:54545/callback?code=c&state=wrong", "https://attacker.example/callback?code=c&state=session"} {
		manager := &AuthManager{sessions: map[string]*AuthSession{"session": {ID: "session", OwnerID: 7, Provider: "claude", Status: AuthStatusPending, ExpiresAt: time.Now().Add(time.Minute)}}}
		_, err := manager.ExchangeOAuthCode(WithOwner(context.Background(), 7), "session", callback)
		require.Error(t, err)
		assert.Equal(t, AuthStatusPending, manager.sessions["session"].Status)
	}
	manager := &AuthManager{sessions: map[string]*AuthSession{"session": {ID: "session", OwnerID: 7, Provider: "claude", Status: AuthStatusPending, ExpiresAt: time.Now().Add(-time.Minute)}}}
	_, err := manager.ExchangeOAuthCode(WithOwner(context.Background(), 7), "session", "http://localhost:54545/callback?code=c&state=session")
	require.Error(t, err)
}

func TestDevicePollingRetainsPendingAndReturnsNoCredentials(t *testing.T) {
	calls := 0
	mockOAuth(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		require.NoError(t, r.ParseForm())
		assert.Equal(t, "device-secret", r.Form.Get("device_code"))
		if calls == 1 {
			w.WriteHeader(400)
			_, _ = io.WriteString(w, `{"error":"authorization_pending"}`)
			return
		}
		_, _ = io.WriteString(w, `{"access_token":"access","refresh_token":"refresh","expires_in":3600}`)
	})
	manager := &AuthManager{sessions: map[string]*AuthSession{"session": {ID: "session", OwnerID: 7, Provider: "kimi", DeviceCode: "device-secret", AuthType: AuthTypeDeviceCode, Status: AuthStatusPending, ExpiresAt: time.Now().Add(time.Minute)}}}
	ctx := WithOwner(context.Background(), 7)
	progress, err := manager.PollAuth(ctx, "session")
	require.NoError(t, err)
	assert.Equal(t, AuthStatusPending, progress.Status)
	progress, err = manager.PollAuth(ctx, "session")
	require.NoError(t, err)
	assert.Equal(t, AuthStatusSuccess, progress.Status)
	assert.Nil(t, progress.TokenResult)
	assert.Equal(t, "refresh", manager.sessions["session"].TokenResult.RefreshToken)
	_, err = manager.PollAuth(WithOwner(context.Background(), 8), "session")
	require.Error(t, err)
	assert.Equal(t, 2, calls)
}

func TestRefreshPreservesAccountAndRotatesTokenForEveryProvider(t *testing.T) {
	for _, provider := range []string{"kimi", "codex", "claude", "antigravity"} {
		t.Run(provider, func(t *testing.T) {
			mockOAuth(t, func(w http.ResponseWriter, r *http.Request) {
				require.NoError(t, r.ParseForm())
				assert.Equal(t, "refresh_token", r.Form.Get("grant_type"))
				assert.Equal(t, "old", r.Form.Get("refresh_token"))
				_, _ = io.WriteString(w, `{"access_token":"new-access","refresh_token":"rotated","expires_in":3600}`)
			})
			token, err := RefreshToken(context.Background(), &TokenBundle{Provider: provider, RefreshToken: "old", AccountID: "account", ProjectID: "project"})
			require.NoError(t, err)
			assert.Equal(t, "rotated", token.RefreshToken)
			assert.Equal(t, "new-access", token.AccessToken)
			assert.Equal(t, "account", token.AccountID)
			assert.Equal(t, "project", token.ProjectID)
			assert.Empty(t, token.RawPayload)
		})
	}
}

func TestCodexStringPollingInterval(t *testing.T) {
	mockOAuth(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"device_auth_id":"device","user_code":"code","interval":"5"}`)
	})
	result, err := RequestCodexDeviceCode(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 5, result.Interval)
}

func TestRefreshRejectsMissingAccessToken(t *testing.T) {
	mockOAuth(t, func(w http.ResponseWriter, r *http.Request) { _, _ = io.WriteString(w, `{}`) })
	for _, provider := range []string{"kimi", "codex", "claude", "antigravity"} {
		_, err := RefreshToken(context.Background(), &TokenBundle{Provider: provider, RefreshToken: "old"})
		require.Error(t, err)
		assert.False(t, strings.Contains(err.Error(), "old"))
	}
}

func TestKiroSocialAuthAndRefresh(t *testing.T) {
	previous := OAuthHTTPClient
	OAuthHTTPClient = &http.Client{Transport: authTransport(func(req *http.Request) (*http.Response, error) {
		var body string
		switch req.URL.Path {
		case "/oauth/token":
			requestBody, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			var payload map[string]string
			require.NoError(t, common.Unmarshal(requestBody, &payload))
			assert.Equal(t, "auth-code", payload["code"])
			assert.Equal(t, "http://localhost:49153/oauth/callback?login_option=google", payload["redirect_uri"])
			body = `{"accessToken":"access-1","refreshToken":"refresh-old","expiresIn":3600}`
		case "/refreshToken":
			requestBody, err := io.ReadAll(req.Body)
			require.NoError(t, err)
			var payload map[string]string
			require.NoError(t, common.Unmarshal(requestBody, &payload))
			assert.Equal(t, "refresh-old", payload["refreshToken"])
			body = `{"accessToken":"access-2","expiresIn":3600}`
		case "/ListAvailableModels":
			assert.Equal(t, "AI_EDITOR", req.URL.Query().Get("origin"))
			assert.Equal(t, "Bearer access-1", req.Header.Get("Authorization"))
			body = `{"models":[{"modelId":"auto"},{"modelId":"claude-sonnet-4.5"}]}`
		case "/getUsageLimits":
			assert.Equal(t, "AI_EDITOR", req.URL.Query().Get("origin"))
			assert.Equal(t, "AGENTIC_REQUEST", req.URL.Query().Get("resourceType"))
			assert.Equal(t, "Bearer access-2", req.Header.Get("Authorization"))
			body = `{"subscriptionInfo":{"subscriptionTitle":"Kiro Pro","type":"PRO"},"usageBreakdownList":[{"resourceType":"CREDIT","currentUsageWithPrecision":125,"usageLimitWithPrecision":1000}]}`
		default:
			return nil, fmt.Errorf("unexpected Kiro path: %s", req.URL.Path)
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})}
	t.Cleanup(func() { OAuthHTTPClient = previous })

	manager := &AuthManager{sessions: make(map[string]*AuthSession)}
	ctx := WithOwner(context.Background(), 7)
	initResult, err := manager.InitAuth(ctx, "kiro")
	require.NoError(t, err)
	assert.Equal(t, AuthTypeOAuthPKCE, initResult.AuthType)
	assert.Contains(t, initResult.AuthURL, "app.kiro.dev/signin")
	assert.Contains(t, initResult.AuthURL, "redirect_from=KiroIDE")
	assert.Contains(t, initResult.AuthURL, "redirect_uri=http%3A%2F%2Flocalhost%3A49153")

	callback := "http://localhost:49153/oauth/callback?login_option=google&code=auth-code&state=" + initResult.SessionID
	token, err := manager.ExchangeOAuthCode(ctx, initResult.SessionID, callback)
	require.NoError(t, err)
	assert.Equal(t, "kiro", token.Provider)
	assert.Empty(t, token.ClientID)
	assert.Empty(t, token.ClientSecret)
	assert.Equal(t, "social", token.AuthMethod)
	assert.Len(t, token.MachineID, 64)
	models, err := FetchKiroAvailableModels(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, []string{"auto", "claude-sonnet-4.5"}, models)

	refreshed, err := RefreshToken(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, "access-2", refreshed.AccessToken)
	assert.Equal(t, "refresh-old", refreshed.RefreshToken)
	assert.Equal(t, "social", refreshed.AuthMethod)

	quota, err := FetchKiroQuotaSummary(context.Background(), refreshed)
	require.NoError(t, err)
	assert.Equal(t, "Kiro Pro", quota.SubscriptionInfo.SubscriptionTitle)
	assert.Equal(t, 87.5, quota.RemainingPercent())
}
