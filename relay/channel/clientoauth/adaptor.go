package clientoauth

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/codex"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/clientauth"
	"github.com/gin-gonic/gin"
)

// Adaptor delegates protocol conversion and accounting to the existing native
// adaptors, while owning OAuth credentials and client-specific wire envelopes.
type Adaptor struct {
	channel.Adaptor
	credential clientauth.TokenBundle
	initErr    error
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.Adaptor = &codex.Adaptor{} // unsupported endpoints fail closed
	if err := common.Unmarshal([]byte(info.ApiKey), &a.credential); err != nil {
		a.initErr = errors.New("invalid client credential")
		return
	}
	switch a.credential.Provider {
	case "kimi":
		a.Adaptor = &openai.Adaptor{}
	case "codex":
		a.Adaptor = &codex.Adaptor{}
	case "claude":
		a.Adaptor = &claude.Adaptor{}
	case "antigravity":
		a.Adaptor = &gemini.Adaptor{}
		info.ChannelSetting.HTTPProtocol = dto.HTTPProtocolHTTP1
	case "kiro":
		a.Adaptor = &claude.Adaptor{}
	default:
		a.initErr = errors.New("unsupported client provider")
		return
	}
	a.Adaptor.Init(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if a.initErr != nil {
		return "", a.initErr
	}
	base, err := clientauth.ProviderBaseURL(a.credential.Provider)
	if err != nil {
		return "", err
	}
	if a.credential.Provider == "antigravity" {
		custom := strings.TrimRight(strings.TrimSpace(info.ChannelBaseUrl), "/")
		if custom == "https://daily-cloudcode-pa.sandbox.googleapis.com" {
			base = custom
		} else {
			base = "https://daily-cloudcode-pa.googleapis.com"
		}
	}
	// OAuth tokens are restricted to their provider, regardless of channel edits.
	info.ChannelBaseUrl = base
	switch a.credential.Provider {
	case "codex":
		if info.RelayMode == relayconstant.RelayModeChatCompletions {
			return base + "/backend-api/codex/responses", nil
		}
		return a.Adaptor.GetRequestURL(info)
	case "kimi":
		return base + "/v1/chat/completions", nil
	case "antigravity":
		if info.IsStream {
			return base + "/v1internal:streamGenerateContent?alt=sse", nil
		}
		return base + "/v1internal:generateContent", nil
	case "kiro":
		return clientauth.KiroAPIBaseURL(a.credential.Region) + "/generateAssistantResponse", nil
	default:
		return a.Adaptor.GetRequestURL(info)
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, headers *http.Header, info *relaycommon.RelayInfo) error {
	if a.initErr != nil {
		return a.initErr
	}
	channel.SetupApiRequestHeader(info, c, headers)
	headers.Set("Content-Type", "application/json")
	headers.Set("Authorization", "Bearer "+a.credential.AccessToken)
	switch a.credential.Provider {
	case "claude":
		headers.Set("anthropic-version", "2023-06-01")
		headers.Set("anthropic-beta", "oauth-2025-04-20")
	case "codex":
		if a.credential.AccountID == "" {
			return errors.New("Codex account ID is missing; authorize again")
		}
		headers.Set("chatgpt-account-id", a.credential.AccountID)
		headers.Set("OpenAI-Beta", "responses=experimental")
	case "antigravity":
		headers.Set("User-Agent", "antigravity/hub/2.9.1 darwin/arm64")
	case "kiro":
		machineID := a.credential.MachineID
		if machineID == "" {
			machineID = clientauth.KiroMachineID(a.credential.RefreshToken, a.credential.ClientID)
		}
		userAgent, amzUserAgent := clientauth.KiroRuntimeUserAgents(machineID)
		headers.Set("Accept", "*/*")
		headers.Set("User-Agent", userAgent)
		headers.Set("X-Amz-User-Agent", amzUserAgent)
		headers.Set("Amz-Sdk-Invocation-Id", common.GetUUID())
		headers.Set("Amz-Sdk-Request", "attempt=1; max=3")
		headers.Set("x-amzn-kiro-agent-mode", "vibe")
		headers.Set("x-amzn-codewhisperer-optout", "true")
		if a.credential.ProfileARN != "" {
			headers.Set("x-amzn-kiro-profile-arn", a.credential.ProfileARN)
		}
	}
	if (info.IsStream && a.credential.Provider != "kiro") || a.credential.Provider == "codex" {
		headers.Set("Accept", "text/event-stream")
	}
	return nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (any, error) {
	if a.initErr != nil {
		return nil, a.initErr
	}
	switch a.credential.Provider {
	case "kimi":
		if info.RelayMode != relayconstant.RelayModeChatCompletions {
			return nil, errors.New("Kimi Code supports /v1/chat/completions")
		}
	case "claude":
		if info.RelayMode != relayconstant.RelayModeChatCompletions && info.RelayFormat != types.RelayFormatClaude {
			return nil, errors.New("Claude Code supports messages and chat completions")
		}
	case "antigravity":
		info.ChannelSetting.HTTPProtocol = dto.HTTPProtocolHTTP1
		if info.RelayMode != relayconstant.RelayModeChatCompletions && info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeGemini && info.RelayFormat != types.RelayFormatClaude {
			return nil, errors.New("unsupported Antigravity endpoint")
		}
	case "kiro":
		if info.RelayMode != relayconstant.RelayModeChatCompletions && info.RelayFormat != types.RelayFormatClaude {
			return nil, errors.New("Kiro supports messages and chat completions")
		}
	}
	credential, err := service.ResolveClientCredential(c.Request.Context(), info.ChannelId)
	if err != nil {
		return nil, err
	}
	if credential.Provider != a.credential.Provider {
		return nil, errors.New("client provider changed; retry the request")
	}
	a.credential = *credential
	if a.credential.Provider == "antigravity" {
		if credential.ProjectID == "" {
			return nil, errors.New("Antigravity project is missing")
		}
		var request json.RawMessage
		if err := common.DecodeJson(body, &request); err != nil {
			return nil, err
		}
		var reqMap map[string]any
		if err := common.Unmarshal(request, &reqMap); err == nil && reqMap != nil {
			if _, ok := reqMap["sessionId"]; !ok {
				reqMap["sessionId"] = fmt.Sprintf("-%d", rand.Int63()&0x7FFFFFFFFFFFFFFF)
			}
			if updatedReq, err := common.Marshal(reqMap); err == nil {
				request = updatedReq
			}
		}
		reqType := "agent"
		if strings.Contains(info.UpstreamModelName, "image") {
			reqType = "image_gen"
		}
		wrapped, err := common.Marshal(struct {
			Project     string          `json:"project"`
			Model       string          `json:"model"`
			Request     json.RawMessage `json:"request"`
			UserAgent   string          `json:"userAgent"`
			RequestType string          `json:"requestType"`
			RequestID   string          `json:"requestId"`
		}{
			Project:     credential.ProjectID,
			Model:       info.UpstreamModelName,
			Request:     request,
			UserAgent:   "antigravity",
			RequestType: reqType,
			RequestID:   "agent-" + common.GetUUID(),
		})
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(wrapped)
	}
	return channel.DoApiRequest(a, c, info, body)
}

func (a *Adaptor) DoResponse(c *gin.Context, response *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if a.credential.Provider == "kiro" && response.StatusCode == http.StatusOK {
		if info.IsStream {
			response.Body = newKiroClaudeStream(response.Body, info.OriginModelName, info.GetEstimatePromptTokens())
			response.Header.Set("Content-Type", "text/event-stream")
			response.Header.Del("Content-Length")
		} else {
			parsed, err := parseKiroResponse(response.Body)
			response.Body.Close()
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponse)
			}
			data, err := buildKiroClaudeResponse(parsed, info.OriginModelName, info.GetEstimatePromptTokens())
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponse)
			}
			response.Body = io.NopCloser(bytes.NewReader(data))
			response.Header.Set("Content-Type", "application/json")
			response.Header.Del("Content-Length")
		}
		return a.Adaptor.DoResponse(c, response, info)
	}
	if a.credential.Provider == "codex" {
		info.FinalRequestRelayFormat = types.RelayFormatOpenAIResponses
		if info.RelayMode == relayconstant.RelayModeChatCompletions {
			if info.IsStream {
				return openai.OaiResponsesToChatStreamHandler(c, info, response)
			}
			return openai.OaiResponsesToChatBufferedStreamHandler(c, info, response)
		}
		if info.RelayMode == relayconstant.RelayModeResponses && !info.IsStream {
			data, err := readCodexResponse(response.Body)
			response.Body.Close()
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponse)
			}
			response.Body = io.NopCloser(bytes.NewReader(data))
			response.Header.Set("Content-Type", "application/json")
			response.Header.Del("Content-Length")
		}
	}
	if a.credential.Provider != "antigravity" {
		return a.Adaptor.DoResponse(c, response, info)
	}
	if response.StatusCode != http.StatusOK {
		return a.Adaptor.DoResponse(c, response, info)
	}
	if info.IsStream {
		scanner := bufio.NewScanner(response.Body)
		scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
		response.Body = &antigravityStream{body: response.Body, scanner: scanner}
	} else {
		body := response.Body
		var envelope struct {
			Response json.RawMessage `json:"response"`
		}
		err := common.DecodeJson(io.LimitReader(body, 32<<20), &envelope)
		body.Close()
		if err != nil || len(envelope.Response) == 0 {
			return nil, types.NewError(errors.New("invalid Antigravity response"), types.ErrorCodeBadResponse)
		}
		response.Body = io.NopCloser(bytes.NewReader(envelope.Response))
	}
	return a.Adaptor.DoResponse(c, response, info)
}

// antigravityStream unwraps each SSE data frame without buffering the response.
type antigravityStream struct {
	body    io.ReadCloser
	scanner *bufio.Scanner
	pending []byte
}

func (s *antigravityStream) Close() error { return s.body.Close() }
func (s *antigravityStream) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	for len(s.pending) == 0 {
		if !s.scanner.Scan() {
			if err := s.scanner.Err(); err != nil {
				return 0, err
			}
			return 0, io.EOF
		}
		line := s.scanner.Text()
		if strings.HasPrefix(line, "data:") {
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if data != "[DONE]" {
				var envelope struct {
					Response json.RawMessage `json:"response"`
				}
				if err := common.Unmarshal([]byte(data), &envelope); err != nil || len(envelope.Response) == 0 {
					return 0, fmt.Errorf("invalid Antigravity stream frame")
				}
				line = "data: " + string(envelope.Response)
			}
		}
		s.pending = []byte(line + "\n")
	}
	n := copy(p, s.pending)
	s.pending = s.pending[n:]
	return n, nil
}
func (a *Adaptor) GetChannelName() string { return "Client OAuth" }

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if a.initErr != nil {
		return nil, a.initErr
	}
	if a.credential.Provider == "kiro" {
		converted, err := a.Adaptor.ConvertOpenAIRequest(c, info, request)
		if err != nil {
			return nil, err
		}
		claudeRequest, ok := converted.(*dto.ClaudeRequest)
		if !ok {
			return nil, errors.New("invalid Claude conversion for Kiro")
		}
		return buildKiroRequest(claudeRequest, a.credential.ProfileARN)
	}
	if a.credential.Provider != "codex" {
		return a.Adaptor.ConvertOpenAIRequest(c, info, request)
	}
	converted, err := relayconvert.ConvertRequest(c, info, types.RelayFormatOpenAIResponses, request)
	if err != nil {
		return nil, err
	}
	responses, ok := converted.Value.(*dto.OpenAIResponsesRequest)
	if !ok {
		return nil, errors.New("invalid Responses conversion")
	}
	return a.ConvertOpenAIResponsesRequest(c, info, *responses)
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if a.initErr != nil {
		return nil, a.initErr
	}
	if a.credential.Provider == "kiro" {
		return buildKiroRequest(request, a.credential.ProfileARN)
	}
	return a.Adaptor.ConvertClaudeRequest(c, info, request)
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	if a.initErr != nil {
		return nil, a.initErr
	}
	if a.credential.Provider == "codex" && info.RelayMode != relayconstant.RelayModeResponsesCompact {
		request.Stream = common.GetPointer(true)
	}
	return a.Adaptor.ConvertOpenAIResponsesRequest(c, info, request)
}

// readCodexResponse restores the non-streaming Responses contract from the
// mandatory upstream event stream, requiring an explicit terminal response.
func readCodexResponse(body io.Reader) ([]byte, error) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 64*1024), 32*1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var event struct {
			Type     string          `json:"type"`
			Response json.RawMessage `json:"response"`
		}
		if err := common.Unmarshal([]byte(data), &event); err != nil {
			return nil, errors.New("invalid Codex response event")
		}
		switch event.Type {
		case "response.completed", "response.incomplete":
			if len(event.Response) == 0 {
				return nil, errors.New("Codex response missing terminal payload")
			}
			return event.Response, nil
		case "error", "response.failed":
			return nil, errors.New("Codex generation failed")
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return nil, errors.New("Codex stream ended without a terminal response")
}

func (a *Adaptor) GetModelList() []string {
	switch a.credential.Provider {
	case "antigravity":
		if a.credential.AccessToken != "" {
			models := clientauth.FetchAntigravityAvailableModels(context.Background(), a.credential.AccessToken)
			if len(models) > 0 {
				return models
			}
		}
		return []string{
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
	default:
		if a.Adaptor != nil {
			return a.Adaptor.GetModelList()
		}
		return nil
	}
}
