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
	kimiClientID        = "17e5f671-d194-4dfb-9706-5516cb48c098"
	kimiOAuthHost       = "https://auth.kimi.com"
	kimiDeviceCodeURL   = kimiOAuthHost + "/api/oauth/device_authorization"
	kimiTokenURL        = kimiOAuthHost + "/api/oauth/token"
	kimiDefaultInterval = 5
)

type kimiDeviceCodeResponse struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type kimiTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	Scope        string `json:"scope"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

// RequestKimiDeviceCode 请求 Kimi 官方设备码
func RequestKimiDeviceCode(ctx context.Context) (*kimiDeviceCodeResponse, error) {
	data := url.Values{}
	data.Set("client_id", kimiClientID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, kimiDeviceCodeURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建 Kimi 请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Msh-Platform", "NewAPI-CLIProxy")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 Kimi 设备码失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取 Kimi 响应失败: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("authorization request failed (HTTP %d)", resp.StatusCode)
	}

	var codeResp kimiDeviceCodeResponse
	if err := common.Unmarshal(bodyBytes, &codeResp); err != nil {
		return nil, fmt.Errorf("解析 Kimi 设备码响应失败: %w", err)
	}

	if codeResp.Interval <= 0 {
		codeResp.Interval = kimiDefaultInterval
	}
	if codeResp.ExpiresIn <= 0 {
		codeResp.ExpiresIn = 900 // 默认 15 分钟
	}

	return &codeResp, nil
}

// PollKimiToken 一次性尝试向 Kimi 轮询 Token
// 返回: (tokenBundle, pending, error)
func PollKimiToken(ctx context.Context, deviceCode string) (*TokenBundle, bool, error) {
	data := url.Values{}
	data.Set("client_id", kimiClientID)
	data.Set("device_code", deviceCode)
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, kimiTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, false, fmt.Errorf("创建 Token 请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Msh-Platform", "NewAPI-CLIProxy")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, false, fmt.Errorf("请求 Token 失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, false, fmt.Errorf("读取 Token 响应失败: %w", err)
	}

	var tokenResp kimiTokenResponse
	if err := common.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return nil, false, fmt.Errorf("解析 Token 响应失败: %w", err)
	}

	// 仍在等待授权 (authorization_pending) 或频率限制 (slow_down)
	if tokenResp.Error == "authorization_pending" || tokenResp.Error == "slow_down" {
		return nil, true, nil
	}

	if tokenResp.Error != "" {
		return nil, false, fmt.Errorf("authorization failed: %s", tokenResp.Error)
	}

	if tokenResp.AccessToken == "" {
		return nil, false, fmt.Errorf("未获取到有效的 Access Token")
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	if tokenResp.ExpiresIn <= 0 {
		expiresAt = time.Now().Add(24 * time.Hour)
	}

	return &TokenBundle{
		Provider:     "kimi",
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		TokenType:    tokenResp.TokenType,
		ExpiresAt:    expiresAt,
		Scope:        tokenResp.Scope,
		RawPayload:   string(bodyBytes),
	}, false, nil
}

// RefreshKimiToken 使用 RefreshToken 刷新 AccessToken
func RefreshKimiToken(ctx context.Context, refreshToken string) (*TokenBundle, error) {
	if strings.TrimSpace(refreshToken) == "" {
		return nil, fmt.Errorf("缺少 refresh_token")
	}

	data := url.Values{}
	data.Set("client_id", kimiClientID)
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, kimiTokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("创建刷新请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Msh-Platform", "NewAPI-CLIProxy")

	client := OAuthHTTPClient
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求刷新 Token 失败: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("读取刷新响应失败: %w", err)
	}

	var tokenResp kimiTokenResponse
	if err := common.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return nil, fmt.Errorf("解析刷新响应失败: %w", err)
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
		Provider:     "kimi",
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: newRefreshToken,
		TokenType:    tokenResp.TokenType,
		ExpiresAt:    expiresAt,
		Scope:        tokenResp.Scope,
		RawPayload:   string(bodyBytes),
	}, nil
}
