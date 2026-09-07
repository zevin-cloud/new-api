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
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	claudeClientID    = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
	claudeAuthURL     = "https://claude.ai/oauth/authorize"
	claudeTokenURL    = "https://platform.claude.com/v1/oauth/token"
	claudeRedirectURI = "http://localhost:54545/callback"
	claudeScope       = "user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload"
)

type claudeTokenResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int64  `json:"expires_in"`
	TokenType        string `json:"token_type"`
	OrganizationUUID string `json:"organization_uuid"`
	AccountUUID      string `json:"account_uuid"`
	Error            string `json:"error"`
	ErrorDesc        string `json:"error_description"`
}

// BuildClaudeAuthURL 生成 Claude Code 授权 URL
func BuildClaudeAuthURL(state string, challenge string) string {
	u, _ := url.Parse(claudeAuthURL)
	q := u.Query()
	q.Set("client_id", claudeClientID)
	q.Set("response_type", "code")
	q.Set("redirect_uri", claudeRedirectURI)
	q.Set("scope", claudeScope)
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

// ExchangeClaudeToken 换取 Claude Token
func ExchangeClaudeToken(ctx context.Context, code string, verifier string) (*TokenBundle, error) {
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", claudeClientID)
	data.Set("code", strings.TrimSpace(code))
	data.Set("redirect_uri", claudeRedirectURI)
	if verifier != "" {
		data.Set("code_verifier", verifier)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, claudeTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建 Token 交换请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求换取 Claude Token 失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token endpoint failed (HTTP %d)", resp.StatusCode)
	}
	var tokenResp claudeTokenResponse
	if err := common.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if tokenResp.Error != "" {
		return nil, fmt.Errorf("authorization failed: %s", tokenResp.Error)
	}

	if tokenResp.AccessToken == "" {
		return nil, fmt.Errorf("未获取到有效的 Access Token")
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	if tokenResp.ExpiresIn <= 0 {
		expiresAt = time.Now().Add(24 * time.Hour)
	}

	return &TokenBundle{
		Provider:     "claude",
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		TokenType:    tokenResp.TokenType,
		ExpiresAt:    expiresAt,
		AccountID:    tokenResp.AccountUUID,
		RawPayload:   string(bodyBytes),
	}, nil
}

// RefreshClaudeToken 刷新 Claude Token
func RefreshClaudeToken(ctx context.Context, refreshToken string) (*TokenBundle, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return nil, fmt.Errorf("缺少 refresh_token")
	}

	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("client_id", claudeClientID)
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, claudeTokenURL, strings.NewReader(data.Encode()))
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
	var tokenResp claudeTokenResponse
	if err := common.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	if tokenResp.Error != "" {
		return nil, fmt.Errorf("authorization failed: %s", tokenResp.Error)
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	if tokenResp.ExpiresIn <= 0 {
		expiresAt = time.Now().Add(24 * time.Hour)
	}

	newRefreshToken := tokenResp.RefreshToken
	if newRefreshToken == "" {
		newRefreshToken = refreshToken
	}

	return &TokenBundle{
		Provider:     "claude",
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: newRefreshToken,
		TokenType:    tokenResp.TokenType,
		ExpiresAt:    expiresAt,
		AccountID:    tokenResp.AccountUUID,
		RawPayload:   string(bodyBytes),
	}, nil
}
