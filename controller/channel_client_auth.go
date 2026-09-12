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

package controller

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/clientauth"
	"github.com/gin-gonic/gin"
)

type ClientAuthInitPayload struct {
	Provider string `json:"provider" binding:"required"`
}
type ClientAuthPollPayload struct {
	SessionID string `json:"session_id" binding:"required"`
}
type ClientAuthExchangePayload struct {
	SessionID string `json:"session_id" binding:"required"`
	Code      string `json:"code" binding:"required"`
}
type CreateClientChannelPayload struct {
	SessionID   string   `json:"session_id" binding:"required"`
	ChannelName string   `json:"channel_name" binding:"required,max=100"`
	Group       string   `json:"group"`
	Models      []string `json:"models" binding:"required,min=1,max=100"`
}

func GetClientAuthProviders(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []gin.H{
		{"slug": "kimi", "name": "Kimi Code", "endpoint": "/v1/chat/completions"},
		{"slug": "codex", "name": "ChatGPT / Codex", "endpoint": "/v1/responses, /v1/chat/completions"},
		{"slug": "claude", "name": "Claude Code", "endpoint": "/v1/messages, /v1/chat/completions"},
		{"slug": "antigravity", "name": "Antigravity", "endpoint": "/v1/chat/completions, /v1/responses"},
		{"slug": "kiro", "name": "Kiro", "endpoint": "/v1/messages, /v1/chat/completions"},
	}})
}

func InitClientAuth(c *gin.Context) {
	var payload ClientAuthInitPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"success": false, "message": "Invalid provider"})
		return
	}
	result, err := clientauth.DefaultManager.InitAuth(clientauth.WithOwner(c.Request.Context(), c.GetInt("id")), payload.Provider)
	if err != nil {
		c.JSON(400, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"success": true, "data": result})
}

func buildClientCredentialKey(ctx context.Context, token *clientauth.TokenBundle) (string, string, error) {
	baseURL, err := clientauth.ProviderBaseURL(token.Provider)
	if err != nil {
		return "", "", err
	}
	credential := *token
	credential.RawPayload = ""
	if credential.AccessToken == "" {
		return "", "", fmt.Errorf("missing access token")
	}
	if credential.Provider == "antigravity" && credential.ProjectID == "" {
		project, err := clientauth.DiscoverAntigravityProject(ctx, credential.AccessToken)
		if err != nil {
			return "", "", err
		}
		credential.ProjectID = project
	}
	key, err := common.Marshal(&credential)
	if err != nil {
		return "", "", err
	}
	return string(key), baseURL, nil
}

func PollClientAuth(c *gin.Context) {
	var payload ClientAuthPollPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"success": false, "message": "Missing session_id"})
		return
	}
	session, err := clientauth.DefaultManager.PollAuth(clientauth.WithOwner(c.Request.Context(), c.GetInt("id")), payload.SessionID)
	if err != nil {
		c.JSON(400, gin.H{"success": false, "message": err.Error()})
		return
	}
	respData := gin.H{
		"session_id":     session.ID,
		"provider":       session.Provider,
		"status":         session.Status,
		"error_msg":      session.ErrorMsg,
		"default_name":   session.DefaultName,
		"default_models": session.DefaultModels,
		"email":          session.Email,
	}
	if session.Status == clientauth.AuthStatusSuccess {
		ctx := clientauth.WithOwner(c.Request.Context(), c.GetInt("id"))
		if token, err := clientauth.DefaultManager.GetSessionToken(ctx, session.ID); err == nil && token != nil {
			if keyStr, baseURL, err := buildClientCredentialKey(c.Request.Context(), token); err == nil {
				respData["key"] = keyStr
				respData["base_url"] = baseURL
			}
		}
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"success": true, "data": respData})
}

func ExchangeClientOAuth(c *gin.Context) {
	var payload ClientAuthExchangePayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"success": false, "message": "Missing callback URL or session_id"})
		return
	}
	ctx := clientauth.WithOwner(c.Request.Context(), c.GetInt("id"))
	_, err := clientauth.DefaultManager.ExchangeOAuthCode(ctx, payload.SessionID, payload.Code)
	if err != nil {
		c.JSON(400, gin.H{"success": false, "message": err.Error()})
		return
	}
	session, _ := clientauth.DefaultManager.PollAuth(ctx, payload.SessionID)
	data := gin.H{"status": "success"}
	if session != nil {
		data["session_id"] = session.ID
		data["provider"] = session.Provider
		data["default_name"] = session.DefaultName
		data["default_models"] = session.DefaultModels
		data["email"] = session.Email
		if token, err := clientauth.DefaultManager.GetSessionToken(ctx, session.ID); err == nil && token != nil {
			if keyStr, baseURL, err := buildClientCredentialKey(c.Request.Context(), token); err == nil {
				data["key"] = keyStr
				data["base_url"] = baseURL
			}
		}
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"success": true, "data": data})
}

func GetClientChannelQuota(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid channel id"})
		return
	}
	channel, err := model.GetChannelById(id, true)
	if err != nil || channel == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "channel not found"})
		return
	}
	if channel.Type != constant.ChannelTypeClientOAuth {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "not a client auth channel"})
		return
	}

	credential, err := service.ResolveClientCredential(c.Request.Context(), channel.Id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("failed to resolve client credential: %v", err)})
		return
	}

	switch credential.Provider {
	case "kiro":
		summary, err := clientauth.FetchKiroQuotaSummary(c.Request.Context(), credential)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("获取 Kiro 配额失败: %v", err)})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"provider": credential.Provider,
			"email":    credential.Email,
			"data":     summary,
		})
		return
	case "antigravity":
		summary, err := clientauth.FetchAntigravityQuotaSummary(c.Request.Context(), credential.AccessToken, credential.ProjectID)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("获取 Antigravity 配额失败: %v", err)})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"provider": credential.Provider,
			"email":    credential.Email,
			"data":     summary,
		})
		return
	case "codex":
		statusCode, body, err := service.FetchCodexWhamUsage(c.Request.Context(), http.DefaultClient, "https://chatgpt.com", credential.AccessToken, credential.AccountID)
		if err != nil || statusCode != http.StatusOK {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("获取 Codex 用量失败: %v", err)})
			return
		}
		var parsed any
		_ = common.Unmarshal(body, &parsed)
		email := credential.Email
		if m, ok := parsed.(map[string]any); ok {
			if e, ok := m["email"].(string); ok && e != "" && email == "" {
				email = e
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"provider": credential.Provider,
			"email":    email,
			"data":     parsed,
		})
		return
	default:
		c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("暂不支持该 Provider 的配额详情查询: %s", credential.Provider)})
		return
	}
}

func CreateChannelWithClientToken(c *gin.Context) {
	var payload CreateClientChannelPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"success": false, "message": "Channel name, models and authorized session are required"})
		return
	}
	name := strings.TrimSpace(payload.ChannelName)
	if name == "" {
		c.JSON(400, gin.H{"success": false, "message": "Channel name is required"})
		return
	}
	group := strings.TrimSpace(payload.Group)
	if group == "" {
		group = "default"
	}
	for i, value := range payload.Models {
		value = strings.TrimSpace(value)
		if value == "" || len(value) > 200 || strings.ContainsAny(value, ",\r\n") {
			c.JSON(400, gin.H{"success": false, "message": "Invalid model name"})
			return
		}
		payload.Models[i] = value
	}
	id, err := clientauth.DefaultManager.CreateChannel(clientauth.WithOwner(c.Request.Context(), c.GetInt("id")), payload.SessionID, func(token *clientauth.TokenBundle) (int, error) {
		keyStr, baseURL, err := buildClientCredentialKey(c.Request.Context(), token)
		if err != nil {
			return 0, err
		}
		priority, weight := int64(0), uint(1)
		channel := &model.Channel{Type: constant.ChannelTypeClientOAuth, Name: name, Key: keyStr, BaseURL: &baseURL, Group: group, Models: strings.Join(payload.Models, ","), Priority: &priority, Weight: &weight, Status: common.ChannelStatusEnabled, CreatedTime: common.GetTimestamp()}
		if err := channel.Insert(); err != nil {
			return 0, err
		}
		model.InitChannelCache()
		return channel.Id, nil
	})
	if err != nil {
		c.JSON(400, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"success": true, "data": gin.H{"id": id}})
}

// GetClientChannels returns account metadata only; channel keys never leave this endpoint.
func GetClientChannels(c *gin.Context) {
	page := common.GetPageQuery(c)
	var channels []model.Channel
	var count int64
	query := model.DB.Model(&model.Channel{}).Where("type = ?", constant.ChannelTypeClientOAuth)
	if err := query.Count(&count).Error; err != nil {
		c.JSON(500, gin.H{"success": false, "message": "Unable to load client accounts"})
		return
	}
	if err := query.Order("id DESC").Limit(page.GetPageSize()).Offset(page.GetStartIdx()).Find(&channels).Error; err != nil {
		c.JSON(500, gin.H{"success": false, "message": "Unable to load client accounts"})
		return
	}
	items := make([]gin.H, 0, len(channels))
	for _, ch := range channels {
		var token clientauth.TokenBundle
		_ = common.Unmarshal([]byte(ch.Key), &token)
		items = append(items, gin.H{"id": ch.Id, "name": ch.Name, "status": ch.Status, "models": ch.Models, "provider": token.Provider, "expires_at": token.ExpiresAt, "email": token.Email})
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"success": true, "data": gin.H{"items": items, "total": count}})
}
