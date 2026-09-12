package clientoauth

import (
	"bytes"
	"encoding/binary"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildKiroRequestPreservesConversationToolsAndProfile(t *testing.T) {
	maxTokens := uint(4096)
	request := &dto.ClaudeRequest{
		Model:     "claude-sonnet-4-6-thinking",
		System:    "Be precise.",
		MaxTokens: &maxTokens,
		Tools: []any{map[string]any{
			"name": "read_file", "description": "Read a file",
			"input_schema": map[string]any{"type": "object", "properties": map[string]any{"path": map[string]any{"type": "string"}}},
		}},
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "Inspect the repository."},
			{Role: "assistant", Content: []any{map[string]any{"type": "tool_use", "id": "tool-1", "name": "read_file", "input": map[string]any{"path": "README.md"}}}},
			{Role: "user", Content: []any{map[string]any{"type": "tool_result", "tool_use_id": "tool-1", "content": "contents"}}},
		},
	}

	payload, err := buildKiroRequest(request, "arn:profile")
	require.NoError(t, err)
	assert.Equal(t, "arn:profile", payload.ProfileARN)
	assert.Equal(t, "claude-sonnet-4.6", payload.ConversationState.CurrentMessage.UserInputMessage.ModelID)
	assert.Equal(t, 4096, payload.InferenceConfig.MaxTokens)
	require.NotNil(t, payload.AdditionalModelRequestFields)
	assert.Equal(t, "high", payload.AdditionalModelRequestFields["output_config"].(map[string]any)["effort"])
	assert.Len(t, payload.ConversationState.History, 3)
	context := payload.ConversationState.CurrentMessage.UserInputMessage.UserInputMessageContext
	require.NotNil(t, context)
	assert.Len(t, context.Tools, 1)
	assert.Len(t, context.ToolResults, 1)
	assert.Equal(t, "tool-1", context.ToolResults[0].ToolUseID)
}

func TestMapKiroModelsAdvertisedByCLI(t *testing.T) {
	models := []string{
		"auto",
		"claude-sonnet-4.5",
		"claude-sonnet-4",
		"claude-haiku-4.5",
		"deepseek-3.2",
		"minimax-m2.5",
		"minimax-m2.1",
		"glm-5",
		"qwen3-coder-next",
	}
	for _, model := range models {
		t.Run(model, func(t *testing.T) {
			assert.Equal(t, model, mapKiroModel(model))
		})
	}
	assert.Equal(t, "future-model-1", mapKiroModel("future-model-1"))
}

func TestKiroEventStreamConvertsToClaudeResponse(t *testing.T) {
	var stream bytes.Buffer
	stream.Write(kiroTestEventFrame(t, "assistantResponseEvent", map[string]any{"assistantResponseEvent": map[string]any{
		"content":  "hello ",
		"toolUses": []any{map[string]any{"toolUseId": "tool-embedded", "name": "search", "input": map[string]any{"query": "Kiro"}}},
	}}))
	stream.Write(kiroTestEventFrame(t, "toolUseEvent", map[string]any{"toolUseEvent": map[string]any{"toolUseId": "tool-1", "name": "read_file", "input": `{"path":"README.md"}`}}))
	stream.Write(kiroTestEventFrame(t, "toolUseEvent", map[string]any{"toolUseEvent": map[string]any{"toolUseId": "tool-1", "name": "read_file", "stop": true}}))
	stream.Write(kiroTestEventFrame(t, "metadataEvent", map[string]any{"metadataEvent": map[string]any{"tokenUsage": map[string]any{"uncachedInputTokens": 12, "outputTokens": 7, "cacheReadInputTokens": 3}}}))

	parsed, err := parseKiroResponse(&stream)
	require.NoError(t, err)
	assert.Equal(t, "hello ", parsed.Text.String())
	assert.Equal(t, 12, parsed.Usage.InputTokens)
	assert.Equal(t, 7, parsed.Usage.OutputTokens)
	assert.Equal(t, "tool_use", parsed.StopReason)
	require.Len(t, parsed.Tools, 2)
	assert.Equal(t, "Kiro", parsed.Tools[0].Input["query"])
	assert.Equal(t, "README.md", parsed.Tools[1].Input["path"])

	body, err := buildKiroClaudeResponse(parsed, "claude-sonnet-4-6", 99)
	require.NoError(t, err)
	var response map[string]any
	require.NoError(t, common.Unmarshal(body, &response))
	assert.Equal(t, "message", response["type"])
	assert.Equal(t, "tool_use", response["stop_reason"])
}

func TestKiroEventStreamConvertsIncrementallyToClaudeSSE(t *testing.T) {
	var stream bytes.Buffer
	stream.Write(kiroTestEventFrame(t, "reasoningContentEvent", map[string]any{"reasoningContentEvent": map[string]any{"text": "thinking"}}))
	stream.Write(kiroTestEventFrame(t, "assistantResponseEvent", map[string]any{"assistantResponseEvent": map[string]any{"content": "answer"}}))
	stream.Write(kiroTestEventFrame(t, "toolUseEvent", map[string]any{"toolUseEvent": map[string]any{"toolUseId": "tool-1", "name": "read_file", "input": `{"path":`}}))
	stream.Write(kiroTestEventFrame(t, "toolUseEvent", map[string]any{"toolUseEvent": map[string]any{"toolUseId": "tool-1", "input": `"README.md"}`}}))
	stream.Write(kiroTestEventFrame(t, "toolUseEvent", map[string]any{"toolUseEvent": map[string]any{"toolUseId": "tool-1", "stop": true}}))
	stream.Write(kiroTestEventFrame(t, "metadataEvent", map[string]any{"metadataEvent": map[string]any{"tokenUsage": map[string]any{"uncachedInputTokens": 5, "outputTokens": 2}}}))

	var output strings.Builder
	require.NoError(t, streamKiroAsClaude(&stream, &output, "claude-opus-4-8", 20))
	result := output.String()
	assert.Contains(t, result, "event: message_start")
	assert.Contains(t, result, `"type":"thinking_delta"`)
	assert.Contains(t, result, `"type":"text_delta"`)
	assert.Contains(t, result, `"id":"tool-1"`)
	assert.Contains(t, result, `"partial_json":"{\"path\":"`)
	assert.Contains(t, result, `"type":"signature_delta"`)
	assert.Contains(t, result, `"input_tokens":5`)
	assert.Contains(t, result, `"output_tokens":2`)
	assert.True(t, strings.HasSuffix(result, "\n\n"))
}

func kiroTestEventFrame(t *testing.T, eventType string, payload any) []byte {
	t.Helper()
	payloadBytes, err := common.Marshal(payload)
	require.NoError(t, err)
	name := []byte(":event-type")
	value := []byte(eventType)
	headers := make([]byte, 0, 7+len(name)+3+len(value))
	headers = append(headers, 4, 't', 'e', 's', 't', 0)
	headers = append(headers, byte(len(name)))
	headers = append(headers, name...)
	headers = append(headers, 7, byte(len(value)>>8), byte(len(value)))
	headers = append(headers, value...)
	totalLength := 12 + len(headers) + len(payloadBytes) + 4
	frame := make([]byte, totalLength)
	binary.BigEndian.PutUint32(frame[0:4], uint32(totalLength))
	binary.BigEndian.PutUint32(frame[4:8], uint32(len(headers)))
	copy(frame[12:], headers)
	copy(frame[12+len(headers):], payloadBytes)
	return frame
}
