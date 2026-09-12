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
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"
)

type AuthManager struct {
	mu       sync.RWMutex
	sessions map[string]*AuthSession
}

var DefaultManager = &AuthManager{
	sessions: make(map[string]*AuthSession),
}

func init() {
	// 定时清理过期会话
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			DefaultManager.cleanExpiredSessions()
		}
	}()
}

func (m *AuthManager) cleanExpiredSessions() {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	for id, s := range m.sessions {
		if now.After(s.ExpiresAt) {
			delete(m.sessions, id)
		}
	}
}

func generateSessionID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// InitAuth 启动客户端授权流程
func (m *AuthManager) InitAuth(ctx context.Context, provider string) (*AuthInitResult, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	sessionID := generateSessionID()
	now := time.Now()

	switch provider {
	case "kimi":
		devResp, err := RequestKimiDeviceCode(ctx)
		if err != nil {
			return nil, err
		}

		session := &AuthSession{
			ID:           sessionID,
			OwnerID:      ownerID(ctx),
			Provider:     provider,
			AuthType:     AuthTypeDeviceCode,
			Status:       AuthStatusPending,
			DeviceCode:   devResp.DeviceCode,
			UserCode:     devResp.UserCode,
			CreatedAt:    now,
			ExpiresAt:    now.Add(time.Duration(devResp.ExpiresIn) * time.Second),
			PollInterval: time.Duration(devResp.Interval) * time.Second,
		}

		m.mu.Lock()
		m.sessions[sessionID] = session
		m.mu.Unlock()

		verificationURL := devResp.VerificationURIComplete
		if verificationURL == "" {
			verificationURL = devResp.VerificationURI
		}

		return &AuthInitResult{
			SessionID:       sessionID,
			Provider:        provider,
			AuthType:        AuthTypeDeviceCode,
			VerificationURL: verificationURL,
			UserCode:        devResp.UserCode,
			ExpiresIn:       devResp.ExpiresIn,
			Interval:        devResp.Interval,
			Instructions:    "请在浏览器中打开授权链接，确认授权码并完成 Kimi 登录",
			DefaultModels:   GetProviderDefaultModels(provider),
		}, nil

	case "codex":
		devResp, err := RequestCodexDeviceCode(ctx)
		if err != nil {
			return nil, err
		}

		session := &AuthSession{
			ID:           sessionID,
			OwnerID:      ownerID(ctx),
			Provider:     provider,
			AuthType:     AuthTypeDeviceCode,
			Status:       AuthStatusPending,
			DeviceCode:   devResp.DeviceAuthID,
			UserCode:     devResp.UserCode,
			CreatedAt:    now,
			ExpiresAt:    now.Add(15 * time.Minute),
			PollInterval: time.Duration(devResp.Interval) * time.Second,
		}

		m.mu.Lock()
		m.sessions[sessionID] = session
		m.mu.Unlock()

		return &AuthInitResult{
			SessionID:       sessionID,
			Provider:        provider,
			AuthType:        AuthTypeDeviceCode,
			VerificationURL: codexDeviceVerificationURL,
			UserCode:        devResp.UserCode,
			ExpiresIn:       900,
			Interval:        devResp.Interval,
			Instructions:    fmt.Sprintf("请访问 %s，输入验证码: %s 授权登录", codexDeviceVerificationURL, devResp.UserCode),
			DefaultModels:   GetProviderDefaultModels(provider),
		}, nil

	case "antigravity":
		verifier, challenge, err := GeneratePKCE()
		if err != nil {
			return nil, fmt.Errorf("生成 PKCE 失败: %w", err)
		}

		authURL := BuildAntigravityAuthURL(sessionID, challenge)
		session := &AuthSession{
			ID:           sessionID,
			OwnerID:      ownerID(ctx),
			Provider:     provider,
			AuthType:     AuthTypeOAuthPKCE,
			Status:       AuthStatusPending,
			CodeVerifier: verifier,
			CreatedAt:    now,
			ExpiresAt:    now.Add(10 * time.Minute),
		}

		m.mu.Lock()
		m.sessions[sessionID] = session
		m.mu.Unlock()

		return &AuthInitResult{
			SessionID:    sessionID,
			Provider:     provider,
			AuthType:     AuthTypeOAuthPKCE,
			AuthURL:      authURL,
			ExpiresIn:    600,
			Instructions: "请点击授权链接，在 Google 授权页面登录并获取授权码贴回",
		}, nil

	case "claude":
		verifier, challenge, err := GeneratePKCE()
		if err != nil {
			return nil, fmt.Errorf("生成 PKCE 失败: %w", err)
		}

		authURL := BuildClaudeAuthURL(sessionID, challenge)
		session := &AuthSession{
			ID:           sessionID,
			OwnerID:      ownerID(ctx),
			Provider:     provider,
			AuthType:     AuthTypeOAuthPKCE,
			Status:       AuthStatusPending,
			CodeVerifier: verifier,
			CreatedAt:    now,
			ExpiresAt:    now.Add(10 * time.Minute),
		}

		m.mu.Lock()
		m.sessions[sessionID] = session
		m.mu.Unlock()

		return &AuthInitResult{
			SessionID:     sessionID,
			Provider:      provider,
			AuthType:      AuthTypeOAuthPKCE,
			AuthURL:       authURL,
			ExpiresIn:     600,
			Instructions:  "请点击授权链接，在 Claude 官方页面登录授权后贴回授权码",
			DefaultModels: GetProviderDefaultModels(provider),
		}, nil

	case "kiro":
		verifier, challenge, err := GeneratePKCE()
		if err != nil {
			return nil, fmt.Errorf("生成 PKCE 失败: %w", err)
		}
		session := &AuthSession{
			ID:           sessionID,
			OwnerID:      ownerID(ctx),
			Provider:     provider,
			AuthType:     AuthTypeOAuthPKCE,
			Status:       AuthStatusPending,
			CodeVerifier: verifier,
			CreatedAt:    now,
			ExpiresAt:    now.Add(10 * time.Minute),
			Region:       kiroDefaultRegion,
			StartURL:     kiroSocialAuthURL,
		}
		m.mu.Lock()
		m.sessions[sessionID] = session
		m.mu.Unlock()
		return &AuthInitResult{
			SessionID:    sessionID,
			Provider:     provider,
			AuthType:     AuthTypeOAuthPKCE,
			AuthURL:      BuildKiroSocialAuthURL(sessionID, challenge),
			ExpiresIn:    600,
			Instructions: "请使用 Kiro 个人账号（Google 或 GitHub）完成授权，然后粘贴完整回调地址",
		}, nil

	default:
		return nil, fmt.Errorf("暂不支持客户端类型: %s", provider)
	}
}

// PollAuth 查询认证状态
func (m *AuthManager) PollAuth(ctx context.Context, sessionID string) (*AuthSession, error) {
	m.mu.RLock()
	session, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("认证会话不存在或已过期")
	}

	session.mu.Lock()
	defer session.mu.Unlock()
	if session.OwnerID != ownerID(ctx) {
		return nil, fmt.Errorf("authorization session not found")
	}
	if session.Status == AuthStatusSuccess {
		return session.snapshot(), nil
	}

	if time.Now().After(session.ExpiresAt) {
		session.Status = AuthStatusExpired
		return session.snapshot(), nil
	}

	// 对于 Device Code 模式，主动轮询一次
	if session.Status != AuthStatusPending || time.Now().Before(session.NextPollAt) {
		return session.snapshot(), nil
	}
	session.NextPollAt = time.Now().Add(session.PollInterval)
	if session.AuthType == AuthTypeDeviceCode {
		switch session.Provider {
		case "kimi":
			token, pending, err := PollKimiToken(ctx, session.DeviceCode)
			if err != nil {
				session.Status = AuthStatusFailed
				session.ErrorMsg = err.Error()
				return session.snapshot(), nil
			}
			if !pending && token != nil {
				session.Status = AuthStatusSuccess
				session.TokenResult = token
				session.DefaultModels = GetProviderDefaultModels("kimi")
				session.DefaultName = "Kimi Code"
			}
		case "codex":
			token, pending, err := PollCodexToken(ctx, session.DeviceCode, session.UserCode)
			if err != nil {
				session.Status = AuthStatusFailed
				session.ErrorMsg = err.Error()
				return session.snapshot(), nil
			}
			if !pending && token != nil {
				session.Status = AuthStatusSuccess
				session.TokenResult = token
				session.DefaultModels = GetProviderDefaultModels("codex")
				session.Email = token.Email
				if token.Email != "" {
					session.DefaultName = fmt.Sprintf("ChatGPT / Codex (%s)", token.Email)
				} else {
					session.DefaultName = "ChatGPT / Codex"
				}
			}
		}
	}

	return session.snapshot(), nil
}

func providerTitle(provider string) string {
	switch strings.ToLower(provider) {
	case "antigravity":
		return "Antigravity"
	case "codex":
		return "ChatGPT / Codex"
	case "claude":
		return "Claude Code"
	case "kimi":
		return "Kimi Code"
	case "kiro":
		return "Kiro"
	default:
		return provider
	}
}

// ExchangeOAuthCode 手动回填 OAuth 授权码换取 Token
func (m *AuthManager) ExchangeOAuthCode(ctx context.Context, sessionID string, code string) (*TokenBundle, error) {
	m.mu.RLock()
	session, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("认证会话不存在或已过期")
	}

	session.mu.Lock()
	defer session.mu.Unlock()
	if session.OwnerID != ownerID(ctx) {
		return nil, fmt.Errorf("authorization session not found")
	}
	if time.Now().After(session.ExpiresAt) || session.Status != AuthStatusPending {
		return nil, fmt.Errorf("authorization session expired or already used")
	}

	callback, parseErr := url.Parse(strings.TrimSpace(code))
	if parseErr != nil || callback.Query().Get("state") != session.ID || callback.Query().Get("code") == "" {
		return nil, fmt.Errorf("paste the complete callback URL including code and state")
	}
	expected := claudeRedirectURI
	if session.Provider == "antigravity" {
		expected = antigravityRedirectURI
	} else if session.Provider == "kiro" {
		if session.ClientID == "" {
			expected = kiroSocialRedirectURI + "/oauth/callback"
		} else {
			expected = KiroRedirectURI()
		}
	}
	target, _ := url.Parse(expected)
	if callback.Scheme != target.Scheme || callback.Host != target.Host || callback.Path != target.Path {
		return nil, fmt.Errorf("invalid OAuth callback URL")
	}
	code = callback.Query().Get("code")

	var token *TokenBundle
	var err error

	switch session.Provider {
	case "antigravity":
		token, err = ExchangeAntigravityToken(ctx, code, session.CodeVerifier)
	case "claude":
		token, err = ExchangeClaudeToken(ctx, code, session.CodeVerifier)
	case "kiro":
		if session.ClientID == "" {
			token, err = ExchangeKiroSocialToken(ctx, code, session.CodeVerifier, callback.Query().Get("login_option"))
		} else {
			token, err = ExchangeKiroToken(ctx, code, session.CodeVerifier, session.ClientID, session.ClientSecret, session.Region, session.StartURL)
		}
	default:
		return nil, fmt.Errorf("该 Provider 不支持手动 Exchange: %s", session.Provider)
	}

	if err != nil {
		session.Status = AuthStatusFailed
		session.ErrorMsg = err.Error()
		return nil, err
	}

	session.Status = AuthStatusSuccess
	session.TokenResult = token
	session.Email = token.Email

	// Auto-discover/onboard project & fetch available models for Antigravity
	if session.Provider == "antigravity" {
		if token.ProjectID == "" {
			if project, errProject := DiscoverAntigravityProject(ctx, token.AccessToken); errProject == nil && project != "" {
				token.ProjectID = project
			}
		}
		session.DefaultModels = FetchAntigravityAvailableModels(ctx, token.AccessToken)
		if token.Email != "" {
			session.DefaultName = fmt.Sprintf("Antigravity (%s)", token.Email)
		} else {
			session.DefaultName = "Antigravity"
		}
	} else if session.Provider == "claude" {
		session.DefaultModels = GetProviderDefaultModels("claude")
		if token.Email != "" {
			session.DefaultName = fmt.Sprintf("Claude Code (%s)", token.Email)
		} else {
			session.DefaultName = "Claude Code"
		}
	} else if session.Provider == "kiro" {
		if models, modelsErr := FetchKiroAvailableModels(ctx, token); modelsErr == nil {
			session.DefaultModels = models
		}
		if token.Email != "" {
			session.DefaultName = fmt.Sprintf("Kiro (%s)", token.Email)
		} else {
			session.DefaultName = "Kiro"
		}
	}

	return token, nil
}

// GetProviderDefaultModels 获取对应客户端的推荐模型列表
func GetProviderDefaultModels(provider string) []string {
	switch strings.ToLower(provider) {
	case "kimi":
		return []string{"kimi-k3", "kimi-k2.7-code", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"}
	case "codex":
		return []string{
			"gpt-6-astra",
			"gpt-reserve",
			"gpt-5.6-sol",
			"gpt-5.6-terra",
			"gpt-5.6-luna",
			"gpt-5.5",
			"gpt-5.4-mini",
			"codex-auto-review",
			"gpt-image-2",
			"gpt-image-1",
		}
	case "antigravity":
		return []string{
			"gemini-3-flash",
			"claude-sonnet-4-6",
			"claude-opus-4-6-thinking",
			"gemini-3.6-flash-high",
			"gemini-3.7-flash-high",
			"gemini-3.8-flash-high",
			"gemini-3.1-flash-image",
			"gemini-pro-agent",
			"gemini-3.1-pro-low",
			"gpt-oss-120b-medium",
			"gemini-3.1-flash-lite",
		}
	case "claude":
		return []string{"claude-3-7-sonnet-20250219", "claude-3-7-sonnet-thought", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"}
	default:
		return []string{"default"}
	}
}

// WithOwner binds an authorization session to the authenticated administrator.
type ownerContextKey struct{}

func WithOwner(ctx context.Context, id int) context.Context {
	return context.WithValue(ctx, ownerContextKey{}, id)
}
func ownerID(ctx context.Context) int { id, _ := ctx.Value(ownerContextKey{}).(int); return id }

// CreateChannel consumes an authorization once, retaining the result for safe retries.
func (m *AuthManager) CreateChannel(ctx context.Context, id string, create func(*TokenBundle) (int, error)) (int, error) {
	m.mu.RLock()
	session := m.sessions[id]
	m.mu.RUnlock()
	if session == nil {
		return 0, fmt.Errorf("authorization session not found")
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.OwnerID != ownerID(ctx) || time.Now().After(session.ExpiresAt) {
		return 0, fmt.Errorf("authorization session not found or expired")
	}
	if session.ChannelID != 0 {
		return session.ChannelID, nil
	}
	if session.Status != AuthStatusSuccess || session.TokenResult == nil {
		return 0, fmt.Errorf("authorization is not complete")
	}
	channelID, err := create(session.TokenResult)
	if err != nil {
		return 0, err
	}
	session.ChannelID = channelID
	session.TokenResult = nil
	return channelID, nil
}

// GetSessionToken retrieves the token result of a completed session for its owner.
func (m *AuthManager) GetSessionToken(ctx context.Context, id string) (*TokenBundle, error) {
	m.mu.RLock()
	session := m.sessions[id]
	m.mu.RUnlock()
	if session == nil {
		return nil, fmt.Errorf("authorization session not found")
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.OwnerID != ownerID(ctx) || time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("authorization session not found or expired")
	}
	if session.Status != AuthStatusSuccess || session.TokenResult == nil {
		return nil, fmt.Errorf("authorization is not complete")
	}
	return session.TokenResult, nil
}

// snapshot exposes progress without sharing mutable session state or credentials.
func (s *AuthSession) snapshot() *AuthSession {
	return &AuthSession{
		ID:            s.ID,
		Provider:      s.Provider,
		Status:        s.Status,
		ErrorMsg:      s.ErrorMsg,
		DefaultName:   s.DefaultName,
		DefaultModels: s.DefaultModels,
		Email:         s.Email,
	}
}
