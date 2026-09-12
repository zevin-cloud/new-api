/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

package clientauth

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	kiroDefaultRegion     = "us-east-1"
	kiroBuilderIDURL      = "https://view.awsapps.com/start"
	kiroRedirectURI       = "http://127.0.0.1:9876/oauth/callback"
	kiroSocialRedirectURI = "http://localhost:49153"
	kiroRuntimeSDK        = "1.0.34"
	kiroRuntimeVersion    = "0.11.132"
	kiroOIDCSDKVersion    = "3.980.0"
	kiroIdentityUserAgent = "KiroIDE"
	kiroSignInURL         = "https://app.kiro.dev/signin"
	kiroSocialAuthURL     = "https://prod.us-east-1.auth.desktop.kiro.dev"
)

var kiroScopes = []string{
	"codewhisperer:completions",
	"codewhisperer:analysis",
	"codewhisperer:conversations",
	"codewhisperer:transformations",
	"codewhisperer:taskassist",
}

type kiroClientRegistration struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

type kiroTokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ProfileARN   string `json:"profileArn"`
	ExpiresIn    int64  `json:"expiresIn"`
}

type kiroSocialTokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ProfileARN   string `json:"profileArn"`
	ExpiresIn    int64  `json:"expiresIn"`
}

type kiroModelsResponse struct {
	Models []struct {
		ModelID   string `json:"modelId"`
		ModelName string `json:"modelName"`
	} `json:"models"`
}

type KiroQuotaSummary struct {
	NextDateReset        any                      `json:"nextDateReset"`
	OverageConfiguration KiroOverageConfiguration `json:"overageConfiguration"`
	SubscriptionInfo     KiroSubscriptionInfo     `json:"subscriptionInfo"`
	UsageBreakdownList   []KiroUsageBreakdown     `json:"usageBreakdownList"`
}

type KiroOverageConfiguration struct {
	OverageStatus string `json:"overageStatus"`
}

type KiroSubscriptionInfo struct {
	SubscriptionTitle string `json:"subscriptionTitle"`
	Type              string `json:"type"`
}

type KiroUsageBreakdown struct {
	Currency                     string             `json:"currency"`
	CurrentOverages              *float64           `json:"currentOverages"`
	CurrentOveragesWithPrecision *float64           `json:"currentOveragesWithPrecision"`
	CurrentUsage                 *float64           `json:"currentUsage"`
	CurrentUsageWithPrecision    *float64           `json:"currentUsageWithPrecision"`
	DisplayName                  string             `json:"displayName"`
	DisplayNamePlural            string             `json:"displayNamePlural"`
	FreeTrialInfo                *KiroFreeTrialInfo `json:"freeTrialInfo"`
	NextDateReset                any                `json:"nextDateReset"`
	OverageCharges               *float64           `json:"overageCharges"`
	ResourceType                 string             `json:"resourceType"`
	UsageLimit                   *float64           `json:"usageLimit"`
	UsageLimitWithPrecision      *float64           `json:"usageLimitWithPrecision"`
}

type KiroFreeTrialInfo struct {
	CurrentUsage              *float64 `json:"currentUsage"`
	CurrentUsageWithPrecision *float64 `json:"currentUsageWithPrecision"`
	FreeTrialExpiry           any      `json:"freeTrialExpiry"`
	FreeTrialStatus           string   `json:"freeTrialStatus"`
	UsageLimit                *float64 `json:"usageLimit"`
	UsageLimitWithPrecision   *float64 `json:"usageLimitWithPrecision"`
}

func RegisterKiroClient(ctx context.Context, region, startURL string) (*kiroClientRegistration, error) {
	region = normalizeKiroRegion(region)
	if strings.TrimSpace(startURL) == "" {
		startURL = kiroBuilderIDURL
	}
	payload := map[string]any{
		"clientName":   "Kiro IDE",
		"clientType":   "public",
		"scopes":       kiroScopes,
		"grantTypes":   []string{"authorization_code", "refresh_token"},
		"redirectUris": []string{kiroRedirectURI},
		"issuerUrl":    startURL,
	}
	var registration kiroClientRegistration
	if err := doKiroJSON(ctx, http.MethodPost, kiroOIDCEndpoint(region)+"/client/register", payload, &registration); err != nil {
		return nil, fmt.Errorf("register Kiro client: %w", err)
	}
	if registration.ClientID == "" || registration.ClientSecret == "" {
		return nil, fmt.Errorf("register Kiro client: incomplete response")
	}
	return &registration, nil
}

func BuildKiroAuthURL(clientID, state, challenge, region string) string {
	values := url.Values{}
	values.Set("response_type", "code")
	values.Set("client_id", clientID)
	values.Set("redirect_uri", kiroRedirectURI)
	values.Set("scopes", strings.Join(kiroScopes, " "))
	values.Set("state", state)
	values.Set("code_challenge", challenge)
	values.Set("code_challenge_method", "S256")
	return kiroOIDCEndpoint(normalizeKiroRegion(region)) + "/authorize?" + values.Encode()
}

func BuildKiroSocialAuthURL(state, challenge string) string {
	values := url.Values{}
	values.Set("state", state)
	values.Set("code_challenge", challenge)
	values.Set("code_challenge_method", "S256")
	values.Set("redirect_uri", kiroSocialRedirectURI)
	values.Set("redirect_from", "KiroIDE")
	return kiroSignInURL + "?" + values.Encode()
}

func ExchangeKiroSocialToken(ctx context.Context, code, verifier, loginOption string) (*TokenBundle, error) {
	loginOption = strings.ToLower(strings.TrimSpace(loginOption))
	if loginOption == "" {
		loginOption = "google"
	}
	redirectURI := kiroSocialRedirectURI + "/oauth/callback?login_option=" + url.QueryEscape(loginOption)
	payload := map[string]string{
		"code":          strings.TrimSpace(code),
		"code_verifier": verifier,
		"redirect_uri":  redirectURI,
	}
	return requestKiroSocialToken(ctx, kiroSocialAuthURL+"/oauth/token", payload, "")
}

func ExchangeKiroToken(ctx context.Context, code, verifier, clientID, clientSecret, region, startURL string) (*TokenBundle, error) {
	payload := map[string]string{
		"clientId":     clientID,
		"clientSecret": clientSecret,
		"code":         strings.TrimSpace(code),
		"codeVerifier": verifier,
		"redirectUri":  kiroRedirectURI,
		"grantType":    "authorization_code",
	}
	return requestKiroToken(ctx, payload, clientID, clientSecret, region, startURL, "")
}

func RefreshKiroToken(ctx context.Context, token *TokenBundle) (*TokenBundle, error) {
	if token != nil && token.AuthMethod == "social" && token.RefreshToken != "" {
		return requestKiroSocialToken(ctx, kiroSocialAuthURL+"/refreshToken", map[string]string{"refreshToken": token.RefreshToken}, token.RefreshToken)
	}
	if token == nil || token.ClientID == "" || token.ClientSecret == "" || token.RefreshToken == "" {
		return nil, fmt.Errorf("Kiro credential is incomplete; authorize again")
	}
	payload := map[string]string{
		"clientId":     token.ClientID,
		"clientSecret": token.ClientSecret,
		"refreshToken": token.RefreshToken,
		"grantType":    "refresh_token",
	}
	return requestKiroToken(ctx, payload, token.ClientID, token.ClientSecret, token.Region, token.StartURL, token.ProfileARN)
}

func requestKiroSocialToken(ctx context.Context, endpoint string, payload map[string]string, fallbackRefreshToken string) (*TokenBundle, error) {
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", "KiroIDE-0.11.132-"+KiroMachineID(fallbackRefreshToken, payload["code_verifier"]))
	resp, err := OAuthHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err = io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Kiro social token exchange failed (HTTP %d)", resp.StatusCode)
	}
	var result kiroSocialTokenResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.AccessToken == "" {
		return nil, fmt.Errorf("Kiro social token exchange returned no access token")
	}
	if result.RefreshToken == "" {
		result.RefreshToken = fallbackRefreshToken
	}
	expiresIn := result.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600
	}
	machineSeed := payload["code_verifier"]
	if strings.TrimSpace(machineSeed) == "" {
		machineSeed = payload["refreshToken"]
	}
	return &TokenBundle{
		Provider:     "kiro",
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		TokenType:    "Bearer",
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
		ProfileARN:   result.ProfileARN,
		AuthMethod:   "social",
		Region:       kiroDefaultRegion,
		StartURL:     kiroSocialAuthURL,
		MachineID:    KiroMachineID(result.RefreshToken, machineSeed),
	}, nil
}

func requestKiroToken(ctx context.Context, payload map[string]string, clientID, clientSecret, region, startURL, fallbackProfileARN string) (*TokenBundle, error) {
	region = normalizeKiroRegion(region)
	if strings.TrimSpace(startURL) == "" {
		startURL = kiroBuilderIDURL
	}
	var response kiroTokenResponse
	if err := doKiroJSON(ctx, http.MethodPost, kiroOIDCEndpoint(region)+"/token", payload, &response); err != nil {
		return nil, fmt.Errorf("exchange Kiro token: %w", err)
	}
	if response.AccessToken == "" {
		return nil, fmt.Errorf("exchange Kiro token: missing access token")
	}
	if response.RefreshToken == "" {
		response.RefreshToken = payload["refreshToken"]
	}
	if response.ProfileARN == "" {
		response.ProfileARN = fallbackProfileARN
	}
	email := fetchKiroEmail(ctx, response.AccessToken, region)
	expiresIn := response.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 3600
	}
	return &TokenBundle{
		Provider:     "kiro",
		AccessToken:  response.AccessToken,
		RefreshToken: response.RefreshToken,
		TokenType:    "Bearer",
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
		ProfileARN:   response.ProfileARN,
		AuthMethod:   "idc",
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Region:       region,
		StartURL:     startURL,
		MachineID:    KiroMachineID(response.RefreshToken, clientID),
		Email:        email,
	}, nil
}

func KiroMachineID(refreshToken, fallback string) string {
	seed := strings.TrimSpace(refreshToken)
	if seed != "" {
		seed = "KotlinNativeAPI/" + seed
	} else {
		seed = "KiroFallback/" + strings.TrimSpace(fallback)
	}
	sum := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(sum[:])
}

func KiroAPIBaseURL(region string) string {
	return fmt.Sprintf("https://q.%s.amazonaws.com", normalizeKiroRegion(region))
}

func KiroRuntimeUserAgents(machineID string) (string, string) {
	identity := fmt.Sprintf("KiroIDE-%s-%s", kiroRuntimeVersion, machineID)
	return fmt.Sprintf("aws-sdk-js/%s ua/2.1 api/codewhispererstreaming#%s m/E %s", kiroRuntimeSDK, kiroRuntimeSDK, identity),
		fmt.Sprintf("aws-sdk-js/%s %s", kiroRuntimeSDK, identity)
}

func FetchKiroQuotaSummary(ctx context.Context, token *TokenBundle) (*KiroQuotaSummary, error) {
	if token == nil || strings.TrimSpace(token.AccessToken) == "" {
		return nil, fmt.Errorf("Kiro access token is missing")
	}
	endpoint, err := url.Parse(KiroAPIBaseURL(token.Region) + "/getUsageLimits")
	if err != nil {
		return nil, err
	}
	query := endpoint.Query()
	query.Set("origin", "AI_EDITOR")
	query.Set("resourceType", "AGENTIC_REQUEST")
	if profileARN := strings.TrimSpace(token.ProfileARN); profileARN != "" {
		query.Set("profileArn", profileARN)
	}
	endpoint.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	machineID := token.MachineID
	if machineID == "" {
		machineID = KiroMachineID(token.RefreshToken, token.ClientID)
	}
	userAgent, amzUserAgent := KiroRuntimeUserAgents(machineID)
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("X-Amz-User-Agent", amzUserAgent)
	req.Header.Set("x-amzn-kiro-agent-mode", "vibe")
	req.Header.Set("x-amzn-codewhisperer-optout", "true")
	req.Header.Set("Amz-Sdk-Invocation-Id", common.GetUUID())
	req.Header.Set("Amz-Sdk-Request", "attempt=1; max=3")
	if token.ProfileARN != "" {
		req.Header.Set("x-amzn-kiro-profile-arn", token.ProfileARN)
	}
	resp, err := OAuthHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Kiro usage endpoint failed (HTTP %d)", resp.StatusCode)
	}
	var summary KiroQuotaSummary
	if err := common.Unmarshal(body, &summary); err != nil {
		return nil, err
	}
	return &summary, nil
}

// FetchKiroAvailableModels returns the catalog currently enabled for this account.
func FetchKiroAvailableModels(ctx context.Context, token *TokenBundle) ([]string, error) {
	if token == nil || strings.TrimSpace(token.AccessToken) == "" {
		return nil, fmt.Errorf("Kiro access token is missing")
	}
	endpoint, err := url.Parse(KiroAPIBaseURL(token.Region) + "/ListAvailableModels")
	if err != nil {
		return nil, err
	}
	query := endpoint.Query()
	query.Set("origin", "AI_EDITOR")
	if profileARN := strings.TrimSpace(token.ProfileARN); profileARN != "" {
		query.Set("profileArn", profileARN)
	}
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, err
	}
	machineID := token.MachineID
	if machineID == "" {
		machineID = KiroMachineID(token.RefreshToken, token.ClientID)
	}
	userAgent, amzUserAgent := KiroRuntimeUserAgents(machineID)
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("X-Amz-User-Agent", amzUserAgent)
	req.Header.Set("x-amzn-kiro-agent-mode", "vibe")
	req.Header.Set("x-amzn-codewhisperer-optout", "true")
	req.Header.Set("Amz-Sdk-Invocation-Id", common.GetUUID())
	req.Header.Set("Amz-Sdk-Request", "attempt=1; max=3")
	if token.ProfileARN != "" {
		req.Header.Set("x-amzn-kiro-profile-arn", token.ProfileARN)
	}

	resp, err := OAuthHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("Kiro models endpoint failed (HTTP %d)", resp.StatusCode)
	}
	var result kiroModelsResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	models := make([]string, 0, len(result.Models))
	seen := make(map[string]struct{}, len(result.Models))
	for _, item := range result.Models {
		model := strings.TrimSpace(item.ModelID)
		if model == "" {
			model = strings.TrimSpace(item.ModelName)
		}
		if model == "" {
			continue
		}
		if _, exists := seen[model]; exists {
			continue
		}
		seen[model] = struct{}{}
		models = append(models, model)
	}
	if len(models) == 0 {
		return nil, fmt.Errorf("Kiro models endpoint returned no models")
	}
	return models, nil
}

func (s *KiroQuotaSummary) RemainingPercent() float64 {
	if s == nil {
		return 0
	}
	for _, item := range s.UsageBreakdownList {
		if !strings.EqualFold(strings.TrimSpace(item.ResourceType), "CREDIT") {
			continue
		}
		current := item.CurrentUsageWithPrecision
		if current == nil {
			current = item.CurrentUsage
		}
		limit := item.UsageLimitWithPrecision
		if limit == nil {
			limit = item.UsageLimit
		}
		if current == nil || limit == nil || *limit <= 0 {
			return 0
		}
		remaining := (1 - *current / *limit) * 100
		if remaining < 0 {
			return 0
		}
		if remaining > 100 {
			return 100
		}
		return remaining
	}
	return 0
}

func KiroRedirectURI() string { return kiroRedirectURI }

func normalizeKiroRegion(region string) string {
	region = strings.TrimSpace(region)
	if region == "" {
		return kiroDefaultRegion
	}
	return region
}

func kiroOIDCEndpoint(region string) string {
	return fmt.Sprintf("https://oidc.%s.amazonaws.com", normalizeKiroRegion(region))
}

func fetchKiroEmail(ctx context.Context, accessToken, region string) string {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, kiroOIDCEndpoint(region)+"/userinfo", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := OAuthHTTPClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return ""
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return ""
	}
	var user struct {
		Email string `json:"email"`
	}
	if err := common.Unmarshal(body, &user); err != nil {
		return ""
	}
	return strings.TrimSpace(user.Email)
}

func doKiroJSON(ctx context.Context, method, endpoint string, payload any, target any) error {
	var body io.Reader
	if payload != nil {
		data, err := common.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("aws-sdk-js/%s ua/2.1 api/sso-oidc#%s m/E %s", kiroOIDCSDKVersion, kiroOIDCSDKVersion, kiroIdentityUserAgent))
	req.Header.Set("X-Amz-User-Agent", fmt.Sprintf("aws-sdk-js/%s %s", kiroOIDCSDKVersion, kiroIdentityUserAgent))
	req.Header.Set("Amz-Sdk-Invocation-Id", common.GetUUID())
	req.Header.Set("Amz-Sdk-Request", "attempt=1; max=4")
	resp, err := OAuthHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("Kiro identity endpoint failed (HTTP %d)", resp.StatusCode)
	}
	if target == nil || len(responseBody) == 0 {
		return nil
	}
	return common.Unmarshal(responseBody, target)
}
