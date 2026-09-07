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

	return &TokenBundle{
		Provider:     "antigravity",
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		TokenType:    tokenResp.TokenType,
		ExpiresAt:    expiresAt,
		Scope:        tokenResp.Scope,
		RawPayload:   string(bodyBytes),
	}, nil
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
