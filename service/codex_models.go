package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	codexLatestReleaseURL      = "https://api.github.com/repos/openai/codex/releases/latest"
	codexClientVersionCacheTTL = time.Hour
)

type codexClientVersionCache struct {
	sync.Mutex
	version   string
	expiresAt time.Time
}

var latestCodexClientVersion codexClientVersionCache

func GetLatestCodexClientVersion(ctx context.Context, client *http.Client) (string, error) {
	return latestCodexClientVersion.get(ctx, client, codexLatestReleaseURL, time.Now())
}

func (cache *codexClientVersionCache) get(ctx context.Context, client *http.Client, releaseURL string, now time.Time) (string, error) {
	cache.Lock()
	defer cache.Unlock()

	if cache.version != "" && now.Before(cache.expiresAt) {
		return cache.version, nil
	}

	version, err := fetchLatestCodexClientVersion(ctx, client, releaseURL)
	if err != nil {
		if cache.version != "" {
			cache.expiresAt = now.Add(codexClientVersionCacheTTL)
			return cache.version, nil
		}
		return "", err
	}

	cache.version = version
	cache.expiresAt = now.Add(codexClientVersionCacheTTL)
	return version, nil
}

func fetchLatestCodexClientVersion(ctx context.Context, client *http.Client, releaseURL string) (string, error) {
	if client == nil {
		return "", fmt.Errorf("nil http client")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, releaseURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "new-api")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("codex release lookup failed: status=%d", resp.StatusCode)
	}

	var release struct {
		Name       string `json:"name"`
		Draft      bool   `json:"draft"`
		Prerelease bool   `json:"prerelease"`
	}
	if err := common.DecodeJson(resp.Body, &release); err != nil {
		return "", err
	}
	if release.Draft || release.Prerelease {
		return "", fmt.Errorf("latest codex release is not stable")
	}
	version := strings.TrimSpace(release.Name)
	if version == "" {
		return "", fmt.Errorf("latest codex release has no version name")
	}
	return version, nil
}

func FetchCodexModels(
	ctx context.Context,
	client *http.Client,
	baseURL string,
	oauthKey *CodexOAuthKey,
	clientVersion string,
) (statusCode int, models []string, err error) {
	if client == nil {
		return 0, nil, fmt.Errorf("nil http client")
	}
	if oauthKey == nil {
		return 0, nil, fmt.Errorf("nil oauth key")
	}

	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	accessToken := strings.TrimSpace(oauthKey.AccessToken)
	accountID := strings.TrimSpace(oauthKey.AccountID)
	clientVersion = strings.TrimSpace(clientVersion)
	if baseURL == "" {
		return 0, nil, fmt.Errorf("empty baseURL")
	}
	if accessToken == "" {
		return 0, nil, fmt.Errorf("codex channel: access_token is required")
	}
	if accountID == "" {
		return 0, nil, fmt.Errorf("codex channel: account_id is required")
	}
	if clientVersion == "" {
		return 0, nil, fmt.Errorf("codex channel: client_version is required")
	}

	modelsURL, err := url.Parse(baseURL + "/backend-api/codex/models")
	if err != nil {
		return 0, nil, err
	}
	query := modelsURL.Query()
	query.Set("client_version", clientVersion)
	modelsURL.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsURL.String(), nil)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("ChatGPT-Account-Id", accountID)
	req.Header.Set("User-Agent", "codex-cli/"+clientVersion)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	if resp.StatusCode == http.StatusNotFound {
		v1ModelsURL, parseErr := url.Parse(baseURL + "/v1/models")
		if parseErr == nil {
			v1Req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, v1ModelsURL.String(), nil)
			if reqErr == nil {
				v1Req.Header.Set("Authorization", "Bearer "+accessToken)
				if accountID != "" {
					v1Req.Header.Set("ChatGPT-Account-Id", accountID)
				}
				v1Req.Header.Set("User-Agent", "codex-cli/"+clientVersion)
				v1Req.Header.Set("Accept", "application/json")

				v1Resp, doErr := client.Do(v1Req)
				if doErr == nil {
					defer v1Resp.Body.Close()
					if v1Resp.StatusCode == http.StatusOK {
						v1Body, readErr := io.ReadAll(v1Resp.Body)
						if readErr == nil {
							var oaiResult struct {
								Data []struct {
									ID string `json:"id"`
								} `json:"data"`
							}
							if unmarshalErr := common.Unmarshal(v1Body, &oaiResult); unmarshalErr == nil && len(oaiResult.Data) > 0 {
								seen := make(map[string]struct{}, len(oaiResult.Data)+2)
								models = make([]string, 0, len(oaiResult.Data)+2)
								for _, item := range oaiResult.Data {
									id := strings.TrimSpace(item.ID)
									if id == "" {
										continue
									}
									if _, ok := seen[id]; ok {
										continue
									}
									seen[id] = struct{}{}
									models = append(models, id)
								}
								for _, imageModel := range []string{"gpt-image-2", "gpt-image-1"} {
									if _, ok := seen[imageModel]; !ok {
										seen[imageModel] = struct{}{}
										models = append(models, imageModel)
									}
								}
								return v1Resp.StatusCode, models, nil
							}
						}
					}
				}
			}
		}
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return resp.StatusCode, nil, nil
	}

	var result struct {
		Models []struct {
			Slug string `json:"slug"`
		} `json:"models"`
	}
	if err := common.Unmarshal(body, &result); err != nil {
		return resp.StatusCode, nil, err
	}

	seen := make(map[string]struct{}, len(result.Models)+2)
	models = make([]string, 0, len(result.Models)+2)
	for _, item := range result.Models {
		slug := strings.TrimSpace(item.Slug)
		if slug == "" {
			continue
		}
		if _, ok := seen[slug]; ok {
			continue
		}
		seen[slug] = struct{}{}
		models = append(models, slug)
	}
	for _, imageModel := range []string{"gpt-image-2", "gpt-image-1"} {
		if _, ok := seen[imageModel]; !ok {
			seen[imageModel] = struct{}{}
			models = append(models, imageModel)
		}
	}
	return resp.StatusCode, models, nil
}
