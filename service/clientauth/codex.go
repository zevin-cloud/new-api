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
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	codexClientID                       = "app_EMoamEEZ73f0CkXaXp7hrann"
	codexDeviceUserCodeURL              = "https://auth.openai.com/api/accounts/deviceauth/usercode"
	codexDeviceTokenURL                 = "https://auth.openai.com/api/accounts/deviceauth/token"
	codexDeviceVerificationURL          = "https://auth.openai.com/codex/device"
	codexDeviceTokenExchangeRedirectURI = "https://auth.openai.com/deviceauth/callback"
	codexTokenURL                       = "https://auth.openai.com/oauth/token"
)

type codexUserCodeResponse struct {
	DeviceAuthID string `json:"device_auth_id"`
	UserCode     string `json:"user_code"`
	Interval     int    `json:"interval"`
}

type codexDeviceTokenResponse struct {
	AuthorizationCode string `json:"authorization_code"`
	CodeVerifier      string `json:"code_verifier"`
	Error             string `json:"error"`
	ErrorDescription  string `json:"error_description"`
}

type codexOAuthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	IDToken      string `json:"id_token"`
	ExpiresIn    int64  `json:"expires_in"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

// RequestCodexDeviceCode 发起 OpenAI/Codex 设备码请求
func RequestCodexDeviceCode(ctx context.Context) (*codexUserCodeResponse, error) {
	reqBody, err := common.Marshal(map[string]string{
		"client_id": codexClientID,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, codexDeviceUserCodeURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("创建 Codex 设备码请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 Codex 设备码失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("authorization request failed (HTTP %d)", resp.StatusCode)
	}

	var raw map[string]json.RawMessage
	if err := common.Unmarshal(bodyBytes, &raw); err != nil {
		return nil, fmt.Errorf("invalid device response")
	}
	if len(raw["interval"]) > 0 && raw["interval"][0] == '"' {
		var interval string
		if err := common.Unmarshal(raw["interval"], &interval); err != nil {
			return nil, err
		}
		seconds, err := strconv.Atoi(interval)
		if err != nil {
			return nil, err
		}
		raw["interval"], _ = common.Marshal(seconds)
		bodyBytes, _ = common.Marshal(raw)
	}
	var codeResp codexUserCodeResponse
	if err := common.Unmarshal(bodyBytes, &codeResp); err != nil {
		return nil, fmt.Errorf("解析 Codex 响应失败: %w", err)
	}

	if codeResp.DeviceAuthID == "" || codeResp.UserCode == "" {
		return nil, fmt.Errorf("device response missing required fields")
	}
	if codeResp.Interval <= 0 {
		codeResp.Interval = 5
	}

	return &codeResp, nil
}

// PollCodexToken 轮询 Codex 设备码并换取 OAuth Token
func PollCodexToken(ctx context.Context, deviceAuthID string, userCode string) (*TokenBundle, bool, error) {
	reqPayload, err := common.Marshal(map[string]string{
		"device_auth_id": deviceAuthID,
		"user_code":      userCode,
	})
	if err != nil {
		return nil, false, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, codexDeviceTokenURL, bytes.NewReader(reqPayload))
	if err != nil {
		return nil, false, fmt.Errorf("创建 Codex 轮询请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, false, fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, false, fmt.Errorf("读取响应失败: %w", err)
	}

	// 400/404 等常见 pending 状态
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		return nil, true, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, false, fmt.Errorf("device polling failed (HTTP %d)", resp.StatusCode)
	}
	var devResp codexDeviceTokenResponse
	if err := common.Unmarshal(bodyBytes, &devResp); err != nil {
		return nil, false, fmt.Errorf("invalid device polling response")
	}

	if devResp.AuthorizationCode == "" {
		return nil, true, nil
	}

	// 拿到授权码后，向 token 端点换取 access_token
	tokenBundle, err := exchangeCodexCodeForToken(ctx, devResp.AuthorizationCode, devResp.CodeVerifier)
	if err != nil {
		return nil, false, err
	}

	return tokenBundle, false, nil
}

func exchangeCodexCodeForToken(ctx context.Context, authCode string, codeVerifier string) (*TokenBundle, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", codexClientID)
	data.Set("code", authCode)
	data.Set("redirect_uri", codexDeviceTokenExchangeRedirectURI)
	data.Set("code_verifier", codeVerifier)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, codexTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建 Token 交换请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求换取 Token 失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取 Token 响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token endpoint failed (HTTP %d)", resp.StatusCode)
	}
	var oauthResp codexOAuthTokenResponse
	if err := common.Unmarshal(bodyBytes, &oauthResp); err != nil {
		return nil, fmt.Errorf("解析 Token 响应失败: %w", err)
	}

	if oauthResp.Error != "" {
		return nil, fmt.Errorf("authorization failed: %s", oauthResp.Error)
	}

	if oauthResp.AccessToken == "" {
		return nil, fmt.Errorf("未获取到有效的 OpenAI Access Token")
	}

	expiresAt := time.Now().Add(time.Duration(oauthResp.ExpiresIn) * time.Second)
	if oauthResp.ExpiresIn <= 0 {
		expiresAt = time.Now().Add(24 * time.Hour)
	}

	return &TokenBundle{
		Provider:     "codex",
		AccountID:    codexAccountID(oauthResp.AccessToken, oauthResp.IDToken),
		AccessToken:  oauthResp.AccessToken,
		RefreshToken: oauthResp.RefreshToken,
		ExpiresAt:    expiresAt,
		RawPayload:   string(bodyBytes),
	}, nil
}

// RefreshCodexToken 使用 RefreshToken 刷新 AccessToken
func RefreshCodexToken(ctx context.Context, refreshToken string) (*TokenBundle, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return nil, fmt.Errorf("缺少 refresh_token")
	}

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("client_id", codexClientID)
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, codexTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建刷新请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求刷新失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token endpoint failed (HTTP %d)", resp.StatusCode)
	}
	var oauthResp codexOAuthTokenResponse
	if err := common.Unmarshal(bodyBytes, &oauthResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if oauthResp.Error != "" {
		return nil, fmt.Errorf("authorization failed: %s", oauthResp.Error)
	}

	expiresAt := time.Now().Add(time.Duration(oauthResp.ExpiresIn) * time.Second)
	if oauthResp.ExpiresIn <= 0 {
		expiresAt = time.Now().Add(24 * time.Hour)
	}

	newRefreshToken := oauthResp.RefreshToken
	if newRefreshToken == "" {
		newRefreshToken = refreshToken
	}

	return &TokenBundle{
		Provider:     "codex",
		AccountID:    codexAccountID(oauthResp.AccessToken, oauthResp.IDToken),
		AccessToken:  oauthResp.AccessToken,
		RefreshToken: newRefreshToken,
		ExpiresAt:    expiresAt,
		RawPayload:   string(bodyBytes),
	}, nil
}

// Claims are read only from tokens returned directly by the OAuth endpoint, never used for local authorization.
func codexAccountID(tokens ...string) string {
	for _, token := range tokens {
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			continue
		}
		data, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			continue
		}
		var claims struct {
			Auth struct {
				AccountID string `json:"chatgpt_account_id"`
			} `json:"https://api.openai.com/auth"`
		}
		if common.Unmarshal(data, &claims) == nil && claims.Auth.AccountID != "" {
			return claims.Auth.AccountID
		}
	}
	return ""
}
