package clientauth

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// OAuthHTTPClient is shared so redirects cannot forward authorization payloads to another host.
var OAuthHTTPClient = &http.Client{Timeout: 20 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}

func ProviderBaseURL(provider string) (string, error) {
	switch provider {
	case "kimi":
		return "https://api.kimi.com/coding", nil
	case "codex":
		return "https://chatgpt.com", nil
	case "claude":
		return "https://api.anthropic.com", nil
	case "antigravity":
		return "https://daily-cloudcode-pa.googleapis.com", nil
	default:
		return "", fmt.Errorf("unsupported client provider")
	}
}

func RefreshToken(ctx context.Context, token *TokenBundle) (*TokenBundle, error) {
	if token == nil || strings.TrimSpace(token.RefreshToken) == "" {
		return nil, fmt.Errorf("credential expired; authorize the client again")
	}
	var next *TokenBundle
	var err error
	switch token.Provider {
	case "kimi":
		next, err = RefreshKimiToken(ctx, token.RefreshToken)
	case "codex":
		next, err = RefreshCodexToken(ctx, token.RefreshToken)
	case "claude":
		next, err = RefreshClaudeToken(ctx, token.RefreshToken)
	case "antigravity":
		next, err = RefreshAntigravityToken(ctx, token.RefreshToken)
	default:
		return nil, fmt.Errorf("unsupported client provider")
	}
	if err != nil {
		return nil, err
	}
	if next.AccessToken == "" {
		return nil, fmt.Errorf("refresh response missing access token")
	}
	next.ProjectID = token.ProjectID
	if next.AccountID == "" {
		next.AccountID = token.AccountID
	}
	if next.Email == "" {
		next.Email = token.Email
	}
	next.RawPayload = ""
	return next, nil
}

// DiscoverAntigravityProject reads the account's existing entitlement or auto-onboards a free project if missing.
func DiscoverAntigravityProject(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", bytes.NewBufferString(`{"metadata":{"ideType":"ANTIGRAVITY"}}`))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := OAuthHTTPClient.Do(req)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var result struct {
				Project any `json:"cloudaicompanionProject"`
			}
			if err := common.DecodeJson(io.LimitReader(resp.Body, 1<<20), &result); err == nil {
				project := extractProjectID(result.Project)
				if strings.TrimSpace(project) != "" {
					return strings.TrimSpace(project), nil
				}
			}
		}
	}

	// If the account has no active project, auto-onboard to free-tier (referencing CPA)
	onboardedProject, onboardErr := OnboardAntigravityUser(ctx, accessToken, "free-tier")
	if onboardErr == nil && strings.TrimSpace(onboardedProject) != "" {
		return strings.TrimSpace(onboardedProject), nil
	}

	if err != nil {
		return "", fmt.Errorf("could not load Antigravity entitlement: %w", err)
	}
	return "", fmt.Errorf("account has no active Antigravity project and auto-onboarding failed: %v", onboardErr)
}
