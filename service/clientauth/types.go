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
	"sync"
	"time"
)

type AuthType string

const (
	AuthTypeDeviceCode AuthType = "device_code"
	AuthTypeOAuthPKCE  AuthType = "oauth_pkce"
)

type AuthStatus string

const (
	AuthStatusPending AuthStatus = "pending"
	AuthStatusSuccess AuthStatus = "success"
	AuthStatusExpired AuthStatus = "expired"
	AuthStatusFailed  AuthStatus = "failed"
)

// TokenBundle 代表成功提取的通用客户端凭证结构
type TokenBundle struct {
	ProjectID    string    `json:"project_id,omitempty"`
	Provider     string    `json:"provider"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type,omitempty"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
	Scope        string    `json:"scope,omitempty"`
	Email        string    `json:"email,omitempty"`
	AccountID    string    `json:"account_id,omitempty"`
	ProfileARN   string    `json:"profile_arn,omitempty"`
	AuthMethod   string    `json:"auth_method,omitempty"`
	ClientID     string    `json:"client_id,omitempty"`
	ClientSecret string    `json:"client_secret,omitempty"`
	Region       string    `json:"region,omitempty"`
	StartURL     string    `json:"start_url,omitempty"`
	MachineID    string    `json:"machine_id,omitempty"`
	RawPayload   string    `json:"raw_payload,omitempty"`
}

// AuthInitResult 代表启动授权返回给前端的引导信息
type AuthInitResult struct {
	SessionID       string   `json:"session_id"`
	Provider        string   `json:"provider"`
	AuthType        AuthType `json:"auth_type"`
	VerificationURL string   `json:"verification_url,omitempty"`
	UserCode        string   `json:"user_code,omitempty"`
	AuthURL         string   `json:"auth_url,omitempty"`
	ExpiresIn       int      `json:"expires_in"`
	Interval        int      `json:"interval,omitempty"`
	Instructions    string   `json:"instructions"`
	DefaultModels   []string `json:"default_models,omitempty"`
}

// AuthSession 内部认证会话
type AuthSession struct {
	mu            sync.Mutex
	OwnerID       int
	NextPollAt    time.Time
	ChannelID     int
	ID            string
	Provider      string
	AuthType      AuthType
	Status        AuthStatus
	DeviceCode    string
	UserCode      string
	CodeVerifier  string
	ErrorMsg      string
	TokenResult   *TokenBundle
	DefaultName   string
	DefaultModels []string
	Email         string
	CreatedAt     time.Time
	ExpiresAt     time.Time
	PollInterval  time.Duration
	ClientID      string
	ClientSecret  string
	Region        string
	StartURL      string
}
