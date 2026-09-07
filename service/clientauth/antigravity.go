/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package clientauth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

var (
	antigravityClientID      = xorDecode([]byte{107, 106, 109, 107, 106, 106, 108, 106, 108, 106, 111, 99, 107, 119, 46, 55, 50, 41, 41, 51, 52, 104, 50, 104, 107, 54, 57, 40, 63, 104, 105, 111, 44, 46, 53, 54, 53, 48, 50, 110, 61, 110, 106, 105, 63, 42, 116, 59, 42, 42, 41, 116, 61, 53, 53, 61, 54, 63, 47, 41, 63, 40, 57, 53, 52, 46, 63, 52, 46, 116, 57, 53, 55})
	antigravityClientSecret  = xorDecode([]byte{29, 21, 25, 9, 10, 2, 119, 17, 111, 98, 28, 13, 8, 110, 98, 108, 22, 62, 22, 16, 107, 55, 22, 24, 98, 41, 2, 25, 110, 32, 108, 43, 30, 27, 60})
	antigravityAuthEndpoint  = "https://accounts.google.com/o/oauth2/v2/auth"
	antigravityTokenEndpoint = "https://oauth2.googleapis.com/token"
	antigravityRedirectURI   = "http://localhost:51121/callback"
)

func xorDecode(b []byte) string {
	res := make([]byte, len(b))
	for i, v := range b {
		res[i] = v ^ 0x5a
	}
	return string(res)
}

var antigravityScopes = []string{
	"https://www.googleapis.com/auth/cloud-platform",
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"https://www.googleapis.com/auth/cclog",
	"https://www.googleapis.com/auth/experimentsandconfigs",
}

type googleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

// GeneratePKCE 生成 PKCE CodeVerifier 和 CodeChallenge
func GeneratePKCE() (verifier string, challenge string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	verifier = base64.RawURLEncoding.EncodeToString(b)
	h := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(h[:])
	return verifier, challenge, nil
}

// BuildAntigravityAuthURL 生成 Antigravity 授权 URL
func BuildAntigravityAuthURL(state string, challenge string) string {
	u, _ := url.Parse(antigravityAuthEndpoint)
	q := u.Query()
	q.Set("client_id", antigravityClientID)
	q.Set("redirect_uri", antigravityRedirectURI)
	q.Set("response_type", "code")
	q.Set("scope", strings.Join(antigravityScopes, " "))
	q.Set("access_type", "offline")
	q.Set("prompt", "consent")
	if state != "" {
		q.Set("state", state)
	}
	if challenge != "" {
		q.Set("code_challenge", challenge)
		q.Set("code_challenge_method", "S256")
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// ExchangeAntigravityToken 通过授权码换取 Google Token
func ExchangeAntigravityToken(ctx context.Context, code string, verifier string) (*TokenBundle, error) {
	data := url.Values{}
	data.Set("client_id", antigravityClientID)
	data.Set("client_secret", antigravityClientSecret)
	data.Set("code", strings.TrimSpace(code))
	data.Set("grant_type", "authorization_code")
	data.Set("redirect_uri", antigravityRedirectURI)
	if verifier != "" {
		data.Set("code_verifier", verifier)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, antigravityTokenEndpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建 Token 交换请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求换取 Google Token 失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token endpoint failed (HTTP %d)", resp.StatusCode)
	}
	var tokenResp googleTokenResponse
	if err := common.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return nil, fmt.Errorf("解析 Google 响应失败: %w", err)
	}

	if tokenResp.Error != "" {
		return nil, fmt.Errorf("authorization failed: %s", tokenResp.Error)
	}

	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("未获取到有效的 Access Token")
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	if tokenResp.ExpiresIn <= 0 {
		expiresAt = time.Now().Add(1 * time.Hour)
	}

	email, _ := FetchAntigravityUserInfo(ctx, tokenResp.AccessToken)

	return &TokenBundle{
		Provider:     "antigravity",
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		TokenType:    tokenResp.TokenType,
		ExpiresAt:    expiresAt,
		Scope:        tokenResp.Scope,
		Email:        email,
		RawPayload:   string(bodyBytes),
	}, nil
}

// FetchAntigravityUserInfo 获取 Google 账号基本信息（如邮箱）
func FetchAntigravityUserInfo(ctx context.Context, accessToken string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo?alt=json", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := OAuthHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("userinfo request failed with status %d", resp.StatusCode)
	}
	var info struct {
		Email string `json:"email"`
	}
	if err := common.DecodeJson(resp.Body, &info); err != nil {
		return "", err
	}
	return strings.TrimSpace(info.Email), nil
}

func extractProjectID(val any) string {
	if s, ok := val.(string); ok && strings.TrimSpace(s) != "" {
		return strings.TrimSpace(s)
	}
	if m, ok := val.(map[string]any); ok {
		for _, key := range []string{"id", "projectId", "project"} {
			if s, ok := m[key].(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

// OnboardAntigravityUser 自动为新 Google 账号开通激活 Antigravity 免费项目 (对齐 CPA)
func OnboardAntigravityUser(ctx context.Context, accessToken string, tierID string) (string, error) {
	if tierID == "" {
		tierID = "free-tier"
	}
	endpoints := []string{
		"https://cloudcode-pa.googleapis.com/v1internal:onboardUser",
		"https://daily-cloudcode-pa.googleapis.com/v1internal:onboardUser",
	}

	reqBody, _ := common.Marshal(map[string]any{
		"tier_id": tierID,
		"metadata": map[string]string{
			"ide_type":    "ANTIGRAVITY",
			"ide_version": "1.105.0",
			"ide_name":    "antigravity",
		},
	})

	for _, endpointURL := range endpoints {
		for attempt := 1; attempt <= 3; attempt++ {
			req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpointURL, bytes.NewReader(reqBody))
			if err != nil {
				return "", err
			}
			req.Header.Set("Authorization", "Bearer "+accessToken)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Accept", "*/*")
			req.Header.Set("User-Agent", "antigravity/1.105.0 darwin/arm64")
			req.Header.Set("X-Goog-Api-Client", "gl-node/20.18.0")

			resp, err := OAuthHTTPClient.Do(req)
			if err != nil {
				break
			}
			bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
			_ = resp.Body.Close()
			if err != nil || resp.StatusCode != http.StatusOK {
				break
			}

			var data struct {
				Done     bool `json:"done"`
				Response struct {
					CompanionProject any    `json:"cloudaicompanionProject"`
					ProjectID        string `json:"projectId"`
				} `json:"response"`
			}
			if err := common.Unmarshal(bodyBytes, &data); err == nil {
				if data.Done {
					projectID := extractProjectID(data.Response.CompanionProject)
					if projectID == "" {
						projectID = data.Response.ProjectID
					}
					if projectID != "" {
						return projectID, nil
					}
				}
			}
			time.Sleep(1 * time.Second)
		}
	}
	return "", fmt.Errorf("onboardUser did not complete")
}

// FetchAntigravityAvailableModels 动态获取 Antigravity 账号支持的模型列表 (严格对齐 CPA)
func FetchAntigravityAvailableModels(ctx context.Context, accessToken string) []string {
	endpoints := []string{
		"https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
		"https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels",
		"https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
	}
	defaultModels := []string{
		"gemini-3-flash",
		"gemini-3.6-flash-high",
		"gemini-3.7-flash-high",
		"gemini-3.8-flash-high",
		"claude-sonnet-4-6",
		"claude-opus-4-6-thinking",
		"gemini-pro-agent",
		"gemini-3.1-pro-low",
		"gemini-3.1-flash-image",
		"gemini-3.1-flash-lite",
		"gpt-oss-120b-medium",
	}

	for _, endpointURL := range endpoints {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpointURL, bytes.NewBufferString(`{}`))
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)")
		resp, err := OAuthHTTPClient.Do(req)
		if err != nil {
			continue
		}
		bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		_ = resp.Body.Close()
		if err != nil || resp.StatusCode != http.StatusOK {
			continue
		}

		var respData struct {
			Models map[string]struct {
				DisplayName string `json:"displayName"`
			} `json:"models"`
		}
		if err := common.Unmarshal(bodyBytes, &respData); err == nil && len(respData.Models) > 0 {
			var models []string
			seen := make(map[string]bool)
			for _, m := range defaultModels {
				if _, ok := respData.Models[m]; ok {
					models = append(models, m)
					seen[m] = true
				}
			}
			for modelID := range respData.Models {
				modelID = strings.TrimSpace(modelID)
				if seen[modelID] {
					continue
				}
				switch modelID {
				case "chat_20706", "chat_23310", "tab_flash_lite_preview", "tab_jump_flash_lite_preview", "gemini-2.5-flash-thinking", "gemini-2.5-pro":
					continue
				}
				models = append(models, modelID)
				seen[modelID] = true
			}
			if len(models) > 0 {
				return models
			}
		}
	}

	return defaultModels
}

// RefreshAntigravityToken 刷新 Antigravity Token
func RefreshAntigravityToken(ctx context.Context, refreshToken string) (*TokenBundle, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return nil, fmt.Errorf("缺少 refresh_token")
	}

	data := url.Values{}
	data.Set("client_id", antigravityClientID)
	data.Set("client_secret", antigravityClientSecret)
	data.Set("refresh_token", refreshToken)
	data.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, antigravityTokenEndpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建刷新请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求刷新失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取刷新响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token endpoint failed (HTTP %d)", resp.StatusCode)
	}
	var tokenResp googleTokenResponse
	if err := common.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if tokenResp.Error != "" {
		return nil, fmt.Errorf("authorization failed: %s", tokenResp.Error)
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	if tokenResp.ExpiresIn <= 0 {
		expiresAt = time.Now().Add(1 * time.Hour)
	}

	newRefreshToken := tokenResp.RefreshToken
	if newRefreshToken == "" {
		newRefreshToken = refreshToken
	}

	return &TokenBundle{
		Provider:     "antigravity",
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: newRefreshToken,
		TokenType:    tokenResp.TokenType,
		ExpiresAt:    expiresAt,
		Scope:        tokenResp.Scope,
		RawPayload:   string(bodyBytes),
	}, nil
}

type AntigravityQuotaBucket struct {
	ID                     string  `json:"id"`
	BucketID               string  `json:"bucketId,omitempty"`
	Label                  string  `json:"label"`
	DisplayName            string  `json:"displayName,omitempty"`
	Window                 string  `json:"window,omitempty"`
	RemainingFraction      float64 `json:"remainingFraction"`
	RemainingFractionSnake float64 `json:"remaining_fraction"`
	ResetTime              string  `json:"resetTime,omitempty"`
	ResetTimeSnake         string  `json:"reset_time,omitempty"`
	Description            string  `json:"description,omitempty"`
}

type AntigravityQuotaGroup struct {
	ID          string                   `json:"id"`
	Label       string                   `json:"label"`
	Description string                   `json:"description,omitempty"`
	Buckets     []AntigravityQuotaBucket `json:"buckets"`
}

type AntigravitySubscription struct {
	Plan     string `json:"plan"`     // "free", "pro", "ultra", "ultra-lite"
	TierID   string `json:"tierId"`   // "g1-pro-tier", "free-tier", etc.
	TierName string `json:"tierName"` // "Google AI Pro", "Antigravity", etc.
}

type AntigravityQuotaSummary struct {
	Plan     string                   `json:"plan,omitempty"`
	TierID   string                   `json:"tierId,omitempty"`
	TierName string                   `json:"tierName,omitempty"`
	Groups   []AntigravityQuotaGroup `json:"groups"`
}

// FetchAntigravitySubscription 获取 Antigravity 套餐信息 (如 套餐 Pro)
func FetchAntigravitySubscription(ctx context.Context, accessToken string) *AntigravitySubscription {
	endpoints := []string{
		"https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
		"https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
	}
	reqBody, _ := common.Marshal(map[string]any{
		"metadata": map[string]string{
			"ideType": "ANTIGRAVITY",
		},
	})
	for _, endpointURL := range endpoints {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpointURL, bytes.NewReader(reqBody))
		if err != nil {
			continue
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)")

		resp, err := OAuthHTTPClient.Do(req)
		if err != nil {
			continue
		}
		bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		_ = resp.Body.Close()
		if err != nil || resp.StatusCode != http.StatusOK {
			continue
		}

		var payload struct {
			CurrentTier struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"currentTier"`
			PaidTier struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"paidTier"`
		}
		if err := common.Unmarshal(bodyBytes, &payload); err == nil {
			tierID := strings.TrimSpace(payload.PaidTier.ID)
			tierName := strings.TrimSpace(payload.PaidTier.Name)
			if tierID == "" {
				tierID = strings.TrimSpace(payload.CurrentTier.ID)
				tierName = strings.TrimSpace(payload.CurrentTier.Name)
			}
			plan := "unknown"
			switch tierID {
			case "free-tier":
				plan = "free"
			case "g1-pro-tier":
				plan = "pro"
			case "g1-ultra-tier":
				plan = "ultra"
			case "g1-ultra-lite-tier":
				plan = "ultra-lite"
			default:
				if strings.Contains(tierID, "pro") {
					plan = "pro"
				} else if strings.Contains(tierID, "ultra") {
					plan = "ultra"
				} else if tierID != "" {
					plan = tierID
				}
			}
			return &AntigravitySubscription{
				Plan:     plan,
				TierID:   tierID,
				TierName: tierName,
			}
		}
	}
	return nil
}

// FetchAntigravityQuotaSummary 获取 Antigravity 账号剩余额度与配额窗口 (对齐 CPA)
func FetchAntigravityQuotaSummary(ctx context.Context, accessToken string, projectID string) (*AntigravityQuotaSummary, error) {
	if strings.TrimSpace(accessToken) == "" {
		return nil, fmt.Errorf("missing access token")
	}
	if strings.TrimSpace(projectID) == "" {
		p, err := DiscoverAntigravityProject(ctx, accessToken)
		if err != nil {
			return nil, err
		}
		projectID = p
	}

	sub := FetchAntigravitySubscription(ctx, accessToken)

	endpoints := []string{
		"https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
		"https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:retrieveUserQuotaSummary",
		"https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
	}

	reqBody, _ := common.Marshal(map[string]string{
		"project": projectID,
	})

	var lastErr error
	for _, endpointURL := range endpoints {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpointURL, bytes.NewReader(reqBody))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)")

		resp, err := OAuthHTTPClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
		_ = resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			lastErr = fmt.Errorf("retrieveUserQuotaSummary failed with HTTP %d: %s", resp.StatusCode, string(bodyBytes))
			continue
		}

		var rawData struct {
			Groups []struct {
				DisplayName      string `json:"displayName"`
				DisplayNameSnake string `json:"display_name"`
				Description      string `json:"description"`
				Buckets          []struct {
					BucketID               string   `json:"bucketId"`
					BucketIDSnake          string   `json:"bucket_id"`
					DisplayName            string   `json:"displayName"`
					DisplayNameSnake       string   `json:"display_name"`
					RemainingFraction      *float64 `json:"remainingFraction"`
					RemainingFractionSnake *float64 `json:"remaining_fraction"`
					Window                 string   `json:"window"`
					ResetTime              string   `json:"resetTime"`
					ResetTimeSnake         string   `json:"reset_time"`
					Description            string   `json:"description"`
				} `json:"buckets"`
			} `json:"groups"`
		}

		if err := common.Unmarshal(bodyBytes, &rawData); err != nil {
			lastErr = err
			continue
		}

		summary := &AntigravityQuotaSummary{
			Groups: make([]AntigravityQuotaGroup, 0, len(rawData.Groups)),
		}
		if sub != nil {
			summary.Plan = sub.Plan
			summary.TierID = sub.TierID
			summary.TierName = sub.TierName
		}

		for i, g := range rawData.Groups {
			label := strings.TrimSpace(g.DisplayName)
			if label == "" {
				label = strings.TrimSpace(g.DisplayNameSnake)
			}
			if label == "" {
				label = fmt.Sprintf("Group %d", i+1)
			}
			group := AntigravityQuotaGroup{
				ID:          fmt.Sprintf("quota-group-%d", i+1),
				Label:       label,
				Description: g.Description,
				Buckets:     make([]AntigravityQuotaBucket, 0, len(g.Buckets)),
			}
			for j, b := range g.Buckets {
				bID := strings.TrimSpace(b.BucketID)
				if bID == "" {
					bID = strings.TrimSpace(b.BucketIDSnake)
				}
				bLabel := strings.TrimSpace(b.DisplayName)
				if bLabel == "" {
					bLabel = strings.TrimSpace(b.DisplayNameSnake)
				}
				if bLabel == "" {
					bLabel = bID
				}
				if bLabel == "" {
					bLabel = fmt.Sprintf("Bucket %d", j+1)
				}
				rem := 0.0
				if b.RemainingFraction != nil {
					rem = *b.RemainingFraction
				} else if b.RemainingFractionSnake != nil {
					rem = *b.RemainingFractionSnake
				}
				resetTime := b.ResetTime
				if resetTime == "" {
					resetTime = b.ResetTimeSnake
				}
				bucket := AntigravityQuotaBucket{
					ID:                     bID,
					BucketID:               bID,
					Label:                  bLabel,
					DisplayName:            bLabel,
					Window:                 b.Window,
					RemainingFraction:      rem,
					RemainingFractionSnake: rem,
					ResetTime:              resetTime,
					ResetTimeSnake:         resetTime,
					Description:            b.Description,
				}
				group.Buckets = append(group.Buckets, bucket)
			}
			summary.Groups = append(summary.Groups, group)
		}

		return summary, nil
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("unable to retrieve quota summary from any endpoint")
}
