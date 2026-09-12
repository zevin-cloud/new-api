/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

package clientoauth

import (
	"bufio"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

const kiroMaxEventFrameSize = 16 << 20

type kiroRequest struct {
	ConversationState            kiroConversationState `json:"conversationState"`
	ProfileARN                   string                `json:"profileArn,omitempty"`
	InferenceConfig              *kiroInferenceConfig  `json:"inferenceConfig,omitempty"`
	AdditionalModelRequestFields map[string]any        `json:"additionalModelRequestFields,omitempty"`
}

type kiroConversationState struct {
	AgentTaskType   string               `json:"agentTaskType"`
	ChatTriggerType string               `json:"chatTriggerType"`
	ConversationID  string               `json:"conversationId"`
	CurrentMessage  kiroCurrentMessage   `json:"currentMessage"`
	History         []kiroHistoryMessage `json:"history,omitempty"`
}

type kiroCurrentMessage struct {
	UserInputMessage kiroUserMessage `json:"userInputMessage"`
}

type kiroHistoryMessage struct {
	UserInputMessage         *kiroUserMessage      `json:"userInputMessage,omitempty"`
	AssistantResponseMessage *kiroAssistantMessage `json:"assistantResponseMessage,omitempty"`
}

type kiroUserMessage struct {
	Content                 string                  `json:"content"`
	ModelID                 string                  `json:"modelId"`
	Origin                  string                  `json:"origin"`
	Images                  []kiroImage             `json:"images,omitempty"`
	UserInputMessageContext *kiroUserMessageContext `json:"userInputMessageContext,omitempty"`
}

type kiroAssistantMessage struct {
	Content  string        `json:"content"`
	ToolUses []kiroToolUse `json:"toolUses,omitempty"`
}

type kiroUserMessageContext struct {
	Tools       []kiroTool       `json:"tools,omitempty"`
	ToolResults []kiroToolResult `json:"toolResults,omitempty"`
}

type kiroTool struct {
	ToolSpecification kiroToolSpecification `json:"toolSpecification"`
}

type kiroToolSpecification struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema kiroInputSchema `json:"inputSchema"`
}

type kiroInputSchema struct {
	JSON any `json:"json"`
}

type kiroToolUse struct {
	ToolUseID string         `json:"toolUseId"`
	Name      string         `json:"name"`
	Input     map[string]any `json:"input"`
}

type kiroToolResult struct {
	Content   []kiroTextContent `json:"content"`
	Status    string            `json:"status"`
	ToolUseID string            `json:"toolUseId"`
}

type kiroTextContent struct {
	Text string `json:"text"`
}

type kiroImage struct {
	Format string          `json:"format"`
	Source kiroImageSource `json:"source"`
}

type kiroImageSource struct {
	Bytes string `json:"bytes"`
}

type kiroInferenceConfig struct {
	MaxTokens   int      `json:"maxTokens,omitempty"`
	Temperature *float64 `json:"temperature,omitempty"`
	TopP        *float64 `json:"topP,omitempty"`
}

type kiroUsage struct {
	InputTokens     int
	OutputTokens    int
	CacheReadTokens int
}

type kiroParsedResponse struct {
	Text       strings.Builder
	Reasoning  strings.Builder
	Tools      []kiroToolUse
	Usage      kiroUsage
	StopReason string
}

type kiroEventFrame struct {
	Type    string
	Payload []byte
}

func buildKiroRequest(request *dto.ClaudeRequest, profileARN string) (*kiroRequest, error) {
	if request == nil {
		return nil, errors.New("Kiro request is nil")
	}
	model := mapKiroModel(request.Model)
	if model == "" {
		return nil, fmt.Errorf("unsupported Kiro model: %s", request.Model)
	}

	tools, err := convertKiroTools(request.Tools)
	if err != nil {
		return nil, err
	}
	history := make([]kiroHistoryMessage, 0, len(request.Messages)+1)
	if system := claudeContentText(request.System); strings.TrimSpace(system) != "" {
		history = append(history, kiroHistoryMessage{UserInputMessage: &kiroUserMessage{
			Content: system,
			ModelID: model,
			Origin:  "AI_EDITOR",
		}})
	}

	var current *kiroUserMessage
	for index, message := range request.Messages {
		last := index == len(request.Messages)-1
		switch message.Role {
		case "user":
			userMessage, toolResults, err := convertKiroUserMessage(message.Content, model)
			if err != nil {
				return nil, err
			}
			if len(toolResults) > 0 {
				userMessage.UserInputMessageContext = &kiroUserMessageContext{ToolResults: toolResults}
			}
			if last {
				current = &userMessage
				if current.UserInputMessageContext == nil {
					current.UserInputMessageContext = &kiroUserMessageContext{}
				}
				current.UserInputMessageContext.Tools = tools
			} else {
				history = append(history, kiroHistoryMessage{UserInputMessage: &userMessage})
			}
		case "assistant":
			assistant, err := convertKiroAssistantMessage(message.Content)
			if err != nil {
				return nil, err
			}
			history = append(history, kiroHistoryMessage{AssistantResponseMessage: &assistant})
		}
	}
	if current == nil {
		current = &kiroUserMessage{Content: "Continue", ModelID: model, Origin: "AI_EDITOR"}
		if len(tools) > 0 {
			current.UserInputMessageContext = &kiroUserMessageContext{Tools: tools}
		}
	}
	if strings.TrimSpace(current.Content) == "" {
		current.Content = "Continue"
	}

	var inference *kiroInferenceConfig
	if request.MaxTokens != nil || request.Temperature != nil || request.TopP != nil {
		inference = &kiroInferenceConfig{Temperature: request.Temperature, TopP: request.TopP}
		if request.MaxTokens != nil {
			inference.MaxTokens = int(*request.MaxTokens)
		}
	}
	result := &kiroRequest{
		ConversationState: kiroConversationState{
			AgentTaskType:   "vibe",
			ChatTriggerType: "MANUAL",
			ConversationID:  common.GetUUID(),
			CurrentMessage:  kiroCurrentMessage{UserInputMessage: *current},
			History:         history,
		},
		ProfileARN:      profileARN,
		InferenceConfig: inference,
	}
	if supportsKiroAdaptiveThinking(model) && (request.Thinking != nil || strings.HasSuffix(strings.ToLower(strings.TrimSpace(request.Model)), "-thinking")) {
		effort := "high"
		if len(request.OutputConfig) > 0 {
			var outputConfig dto.OutputConfigForEffort
			if err := common.Unmarshal(request.OutputConfig, &outputConfig); err == nil && strings.TrimSpace(outputConfig.Effort) != "" {
				effort = strings.TrimSpace(outputConfig.Effort)
			}
		}
		result.AdditionalModelRequestFields = map[string]any{
			"thinking":      map[string]any{"type": "adaptive", "display": "summarized"},
			"output_config": map[string]any{"effort": effort},
		}
	}
	return result, nil
}

func supportsKiroAdaptiveThinking(model string) bool {
	for _, prefix := range []string{"claude-opus-4.6", "claude-opus-4.7", "claude-opus-4.8", "claude-sonnet-4.6", "claude-sonnet-4.7", "claude-sonnet-4.8", "claude-haiku-4.6", "claude-haiku-4.7", "claude-haiku-4.8"} {
		if model == prefix || strings.HasPrefix(model, prefix+"-") {
			return true
		}
	}
	return false
}

func mapKiroModel(model string) string {
	model = strings.ToLower(strings.TrimSpace(model))
	model = strings.TrimSuffix(model, "-thinking")
	switch model {
	case "auto", "claude-sonnet-4", "deepseek-3.2", "minimax-m2.5", "minimax-m2.1", "glm-5", "qwen3-coder-next":
		return model
	case "claude-opus-4-8", "claude-opus-4.8":
		return "claude-opus-4.8"
	case "claude-opus-4-7", "claude-opus-4.7":
		return "claude-opus-4.7"
	case "claude-opus-4-6", "claude-opus-4.6":
		return "claude-opus-4.6"
	case "claude-sonnet-4-6", "claude-sonnet-4.6":
		return "claude-sonnet-4.6"
	case "claude-opus-4-5-20251101", "claude-opus-4.5":
		return "claude-opus-4.5"
	case "claude-sonnet-4-5", "claude-sonnet-4-5-20250929", "claude-sonnet-4.5":
		return "claude-sonnet-4.5"
	case "claude-haiku-4-5", "claude-haiku-4-5-20251001", "claude-haiku-4.5":
		return "claude-haiku-4.5"
	default:
		return model
	}
}

func convertKiroTools(value any) ([]kiroTool, error) {
	if value == nil {
		return nil, nil
	}
	var tools []map[string]any
	data, err := common.Marshal(value)
	if err != nil {
		return nil, err
	}
	if err := common.Unmarshal(data, &tools); err != nil {
		return nil, fmt.Errorf("invalid Claude tools: %w", err)
	}
	result := make([]kiroTool, 0, len(tools))
	for _, tool := range tools {
		name, _ := tool["name"].(string)
		if strings.TrimSpace(name) == "" {
			continue
		}
		description, _ := tool["description"].(string)
		schema := tool["input_schema"]
		if schema == nil {
			schema = map[string]any{"type": "object", "properties": map[string]any{}}
		}
		result = append(result, kiroTool{ToolSpecification: kiroToolSpecification{
			Name:        name,
			Description: description,
			InputSchema: kiroInputSchema{JSON: schema},
		}})
	}
	return result, nil
}

func convertKiroUserMessage(content any, model string) (kiroUserMessage, []kiroToolResult, error) {
	message := kiroUserMessage{ModelID: model, Origin: "AI_EDITOR"}
	if text, ok := content.(string); ok {
		message.Content = text
		return message, nil, nil
	}
	blocks, err := claudeContentBlocks(content)
	if err != nil {
		return message, nil, err
	}
	var text strings.Builder
	var results []kiroToolResult
	for _, block := range blocks {
		typeName, _ := block["type"].(string)
		switch typeName {
		case "text":
			value, _ := block["text"].(string)
			text.WriteString(value)
		case "image":
			source, _ := block["source"].(map[string]any)
			mediaType, _ := source["media_type"].(string)
			data, _ := source["data"].(string)
			format := strings.TrimPrefix(strings.ToLower(mediaType), "image/")
			if format == "jpg" {
				format = "jpeg"
			}
			if data != "" && (format == "jpeg" || format == "png" || format == "gif" || format == "webp") {
				message.Images = append(message.Images, kiroImage{Format: format, Source: kiroImageSource{Bytes: data}})
			}
		case "tool_result":
			toolUseID, _ := block["tool_use_id"].(string)
			if toolUseID == "" {
				continue
			}
			status := "success"
			if isError, _ := block["is_error"].(bool); isError {
				status = "error"
			}
			results = append(results, kiroToolResult{
				Content:   []kiroTextContent{{Text: claudeContentText(block["content"])}},
				Status:    status,
				ToolUseID: toolUseID,
			})
		}
	}
	message.Content = text.String()
	if message.Content == "" && len(results) > 0 {
		message.Content = "Tool results provided."
	}
	return message, results, nil
}

func convertKiroAssistantMessage(content any) (kiroAssistantMessage, error) {
	if text, ok := content.(string); ok {
		return kiroAssistantMessage{Content: text}, nil
	}
	blocks, err := claudeContentBlocks(content)
	if err != nil {
		return kiroAssistantMessage{}, err
	}
	var text strings.Builder
	var toolUses []kiroToolUse
	for _, block := range blocks {
		typeName, _ := block["type"].(string)
		switch typeName {
		case "text":
			value, _ := block["text"].(string)
			text.WriteString(value)
		case "thinking":
			value, _ := block["thinking"].(string)
			if value != "" {
				text.WriteString("<thinking>" + value + "</thinking>\n\n")
			}
		case "tool_use":
			id, _ := block["id"].(string)
			name, _ := block["name"].(string)
			input, _ := block["input"].(map[string]any)
			if input == nil {
				input = map[string]any{}
			}
			toolUses = append(toolUses, kiroToolUse{ToolUseID: id, Name: name, Input: input})
		}
	}
	if text.Len() == 0 {
		text.WriteString(" ")
	}
	return kiroAssistantMessage{Content: text.String(), ToolUses: toolUses}, nil
}

func claudeContentBlocks(content any) ([]map[string]any, error) {
	data, err := common.Marshal(content)
	if err != nil {
		return nil, err
	}
	var blocks []map[string]any
	if err := common.Unmarshal(data, &blocks); err != nil {
		return nil, fmt.Errorf("invalid Claude message content: %w", err)
	}
	return blocks, nil
}

func claudeContentText(content any) string {
	if text, ok := content.(string); ok {
		return text
	}
	blocks, err := claudeContentBlocks(content)
	if err != nil {
		return ""
	}
	var result strings.Builder
	for _, block := range blocks {
		if value, ok := block["text"].(string); ok {
			result.WriteString(value)
			continue
		}
		if value, ok := block["content"].(string); ok {
			result.WriteString(value)
		}
	}
	return result.String()
}

func parseKiroResponse(body io.Reader) (*kiroParsedResponse, error) {
	parsed := &kiroParsedResponse{}
	reader := bufio.NewReader(body)
	seenTools := make(map[string]bool)
	var currentTool *kiroToolUse
	var toolInput strings.Builder
	appendTool := func(tool kiroToolUse) {
		if tool.ToolUseID == "" || tool.Name == "" || seenTools[tool.ToolUseID] {
			return
		}
		seenTools[tool.ToolUseID] = true
		parsed.Tools = append(parsed.Tools, tool)
	}
	for {
		frame, err := readKiroEventFrame(reader)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if strings.HasSuffix(strings.ToLower(frame.Type), "exception") {
			return nil, fmt.Errorf("Kiro upstream event: %s", frame.Type)
		}
		var event map[string]any
		if err := common.Unmarshal(frame.Payload, &event); err != nil {
			continue
		}
		updateKiroUsage(&parsed.Usage, event)
		nested := kiroNestedEvent(event, frame.Type)
		if reason := kiroStopReason(nested); reason != "" {
			parsed.StopReason = reason
		}
		switch frame.Type {
		case "assistantResponseEvent":
			parsed.Text.WriteString(kiroString(nested, "content"))
			for _, tool := range kiroToolUses(nested, event) {
				appendTool(tool)
			}
		case "reasoningContentEvent":
			parsed.Reasoning.WriteString(kiroString(nested, "text"))
		case "toolUseEvent":
			id := kiroString(nested, "toolUseId")
			name := kiroString(nested, "name")
			if id != "" && (currentTool == nil || currentTool.ToolUseID != id) {
				if currentTool != nil {
					currentTool.Input = decodeKiroToolInput(toolInput.String())
					appendTool(*currentTool)
				}
				currentTool = &kiroToolUse{ToolUseID: id, Name: name}
				toolInput.Reset()
			}
			if fragment, ok := nested["input"].(string); ok {
				toolInput.WriteString(fragment)
			} else if input, ok := nested["input"].(map[string]any); ok && currentTool != nil {
				currentTool.Input = input
			}
			if stopped, _ := nested["stop"].(bool); stopped && currentTool != nil {
				if currentTool.Input == nil {
					currentTool.Input = decodeKiroToolInput(toolInput.String())
				}
				appendTool(*currentTool)
				currentTool = nil
				toolInput.Reset()
			}
		}
	}
	if currentTool != nil {
		if currentTool.Input == nil {
			currentTool.Input = decodeKiroToolInput(toolInput.String())
		}
		appendTool(*currentTool)
	}
	if parsed.StopReason == "" {
		if len(parsed.Tools) > 0 {
			parsed.StopReason = "tool_use"
		} else {
			parsed.StopReason = "end_turn"
		}
	}
	return parsed, nil
}

func buildKiroClaudeResponse(parsed *kiroParsedResponse, model string, fallbackInputTokens int) ([]byte, error) {
	if parsed.Usage.InputTokens == 0 {
		parsed.Usage.InputTokens = fallbackInputTokens
	}
	content := make([]map[string]any, 0, 2+len(parsed.Tools))
	if parsed.Reasoning.Len() > 0 {
		content = append(content, map[string]any{"type": "thinking", "thinking": parsed.Reasoning.String(), "signature": "kiro_" + common.GetUUID()})
	}
	if parsed.Text.Len() > 0 {
		content = append(content, map[string]any{"type": "text", "text": parsed.Text.String()})
	}
	for _, tool := range parsed.Tools {
		content = append(content, map[string]any{"type": "tool_use", "id": tool.ToolUseID, "name": tool.Name, "input": tool.Input})
	}
	return common.Marshal(map[string]any{
		"id":          "msg_" + common.GetUUID(),
		"type":        "message",
		"role":        "assistant",
		"model":       model,
		"content":     content,
		"stop_reason": parsed.StopReason,
		"usage": map[string]any{
			"input_tokens":            parsed.Usage.InputTokens,
			"output_tokens":           parsed.Usage.OutputTokens,
			"cache_read_input_tokens": parsed.Usage.CacheReadTokens,
		},
	})
}

func newKiroClaudeStream(body io.ReadCloser, model string, fallbackInputTokens int) io.ReadCloser {
	reader, writer := io.Pipe()
	go func() {
		defer body.Close()
		defer writer.Close()
		if err := streamKiroAsClaude(body, writer, model, fallbackInputTokens); err != nil {
			_ = writer.CloseWithError(err)
		}
	}()
	return reader
}

func streamKiroAsClaude(body io.Reader, output io.Writer, model string, fallbackInputTokens int) error {
	reader := bufio.NewReader(body)
	messageID := "msg_" + common.GetUUID()
	usage := kiroUsage{InputTokens: fallbackInputTokens}
	blockIndex := -1
	openBlock := ""
	currentToolID := ""
	emittedTools := make(map[string]bool)
	stopReason := "end_turn"
	started := false

	emit := func(event string, payload map[string]any) error {
		data, err := common.Marshal(payload)
		if err != nil {
			return err
		}
		_, err = fmt.Fprintf(output, "event: %s\ndata: %s\n\n", event, data)
		return err
	}
	ensureStart := func() error {
		if started {
			return nil
		}
		started = true
		return emit("message_start", map[string]any{
			"type": "message_start",
			"message": map[string]any{
				"id": messageID, "type": "message", "role": "assistant", "model": model,
				"content": []any{}, "stop_reason": nil,
				"usage": map[string]any{"input_tokens": usage.InputTokens, "output_tokens": 0},
			},
		})
	}
	closeBlock := func() error {
		if openBlock == "" {
			return nil
		}
		if openBlock == "thinking" {
			if err := emit("content_block_delta", map[string]any{"type": "content_block_delta", "index": blockIndex, "delta": map[string]any{"type": "signature_delta", "signature": "kiro_" + common.GetUUID()}}); err != nil {
				return err
			}
		}
		err := emit("content_block_stop", map[string]any{"type": "content_block_stop", "index": blockIndex})
		openBlock = ""
		currentToolID = ""
		return err
	}
	openTextBlock := func(kind string) error {
		if openBlock == kind {
			return nil
		}
		if err := closeBlock(); err != nil {
			return err
		}
		if err := ensureStart(); err != nil {
			return err
		}
		blockIndex++
		openBlock = kind
		contentBlock := map[string]any{"type": kind}
		if kind == "text" {
			contentBlock["text"] = ""
		} else {
			contentBlock["thinking"] = ""
		}
		return emit("content_block_start", map[string]any{"type": "content_block_start", "index": blockIndex, "content_block": contentBlock})
	}

	for {
		frame, err := readKiroEventFrame(reader)
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if strings.HasSuffix(strings.ToLower(frame.Type), "exception") {
			return fmt.Errorf("Kiro upstream event: %s", frame.Type)
		}
		var event map[string]any
		if err := common.Unmarshal(frame.Payload, &event); err != nil {
			continue
		}
		updateKiroUsage(&usage, event)
		nested := kiroNestedEvent(event, frame.Type)
		if reason := kiroStopReason(nested); reason != "" {
			stopReason = reason
		}
		switch frame.Type {
		case "assistantResponseEvent":
			text := kiroString(nested, "content")
			if text != "" {
				if err := openTextBlock("text"); err != nil {
					return err
				}
				if err := emit("content_block_delta", map[string]any{"type": "content_block_delta", "index": blockIndex, "delta": map[string]any{"type": "text_delta", "text": text}}); err != nil {
					return err
				}
			}
			for _, tool := range kiroToolUses(nested, event) {
				if emittedTools[tool.ToolUseID] {
					continue
				}
				if err := closeBlock(); err != nil {
					return err
				}
				if err := ensureStart(); err != nil {
					return err
				}
				blockIndex++
				stopReason = "tool_use"
				emittedTools[tool.ToolUseID] = true
				if err := emit("content_block_start", map[string]any{"type": "content_block_start", "index": blockIndex, "content_block": map[string]any{"type": "tool_use", "id": tool.ToolUseID, "name": tool.Name, "input": map[string]any{}}}); err != nil {
					return err
				}
				input, err := common.Marshal(tool.Input)
				if err != nil {
					return err
				}
				if err := emit("content_block_delta", map[string]any{"type": "content_block_delta", "index": blockIndex, "delta": map[string]any{"type": "input_json_delta", "partial_json": string(input)}}); err != nil {
					return err
				}
				if err := emit("content_block_stop", map[string]any{"type": "content_block_stop", "index": blockIndex}); err != nil {
					return err
				}
			}
		case "reasoningContentEvent":
			text := kiroString(nested, "text")
			if text == "" {
				continue
			}
			if err := openTextBlock("thinking"); err != nil {
				return err
			}
			if err := emit("content_block_delta", map[string]any{"type": "content_block_delta", "index": blockIndex, "delta": map[string]any{"type": "thinking_delta", "thinking": text}}); err != nil {
				return err
			}
		case "toolUseEvent":
			id := kiroString(nested, "toolUseId")
			name := kiroString(nested, "name")
			if emittedTools[id] && currentToolID != id {
				continue
			}
			if id != "" && currentToolID != id {
				if err := closeBlock(); err != nil {
					return err
				}
				if err := ensureStart(); err != nil {
					return err
				}
				blockIndex++
				openBlock = "tool_use"
				currentToolID = id
				emittedTools[id] = true
				stopReason = "tool_use"
				if err := emit("content_block_start", map[string]any{"type": "content_block_start", "index": blockIndex, "content_block": map[string]any{"type": "tool_use", "id": id, "name": name, "input": map[string]any{}}}); err != nil {
					return err
				}
			}
			fragment := ""
			if value, ok := nested["input"].(string); ok {
				fragment = value
			} else if value, ok := nested["input"].(map[string]any); ok {
				data, err := common.Marshal(value)
				if err != nil {
					return err
				}
				fragment = string(data)
			}
			if fragment != "" && openBlock == "tool_use" {
				if err := emit("content_block_delta", map[string]any{"type": "content_block_delta", "index": blockIndex, "delta": map[string]any{"type": "input_json_delta", "partial_json": fragment}}); err != nil {
					return err
				}
			}
			if stopped, _ := nested["stop"].(bool); stopped {
				if err := closeBlock(); err != nil {
					return err
				}
			}
		}
	}
	if err := closeBlock(); err != nil {
		return err
	}
	if err := ensureStart(); err != nil {
		return err
	}
	if usage.InputTokens == 0 {
		usage.InputTokens = fallbackInputTokens
	}
	if err := emit("message_delta", map[string]any{
		"type":  "message_delta",
		"delta": map[string]any{"stop_reason": stopReason, "stop_sequence": nil},
		"usage": map[string]any{"input_tokens": usage.InputTokens, "output_tokens": usage.OutputTokens, "cache_read_input_tokens": usage.CacheReadTokens},
	}); err != nil {
		return err
	}
	return emit("message_stop", map[string]any{"type": "message_stop"})
}

func readKiroEventFrame(reader *bufio.Reader) (*kiroEventFrame, error) {
	prelude := make([]byte, 12)
	if _, err := io.ReadFull(reader, prelude); err != nil {
		return nil, err
	}
	totalLength := binary.BigEndian.Uint32(prelude[0:4])
	headersLength := binary.BigEndian.Uint32(prelude[4:8])
	if totalLength < 16 || totalLength > kiroMaxEventFrameSize {
		return nil, fmt.Errorf("invalid Kiro event frame length: %d", totalLength)
	}
	if headersLength > totalLength-16 {
		return nil, fmt.Errorf("invalid Kiro event header length: %d", headersLength)
	}
	remainder := make([]byte, int(totalLength)-12)
	if _, err := io.ReadFull(reader, remainder); err != nil {
		return nil, err
	}
	payloadEnd := len(remainder) - 4
	payloadStart := int(headersLength)
	if payloadStart > payloadEnd {
		return nil, errors.New("invalid Kiro event payload")
	}
	return &kiroEventFrame{Type: kiroEventType(remainder[:headersLength]), Payload: remainder[payloadStart:payloadEnd]}, nil
}

func kiroEventType(headers []byte) string {
	for offset := 0; offset < len(headers); {
		nameLength := int(headers[offset])
		offset++
		if offset+nameLength+1 > len(headers) {
			return ""
		}
		name := string(headers[offset : offset+nameLength])
		offset += nameLength
		valueType := headers[offset]
		offset++
		if valueType != 7 {
			next, ok := skipKiroEventHeaderValue(headers, offset, valueType)
			if !ok {
				return ""
			}
			offset = next
			continue
		}
		if offset+2 > len(headers) {
			return ""
		}
		valueLength := int(binary.BigEndian.Uint16(headers[offset : offset+2]))
		offset += 2
		if offset+valueLength > len(headers) {
			return ""
		}
		value := string(headers[offset : offset+valueLength])
		offset += valueLength
		if name == ":event-type" || name == ":exception-type" {
			return value
		}
	}
	return ""
}

func skipKiroEventHeaderValue(headers []byte, offset int, valueType byte) (int, bool) {
	length := 0
	switch valueType {
	case 0, 1:
		return offset, true
	case 2:
		length = 1
	case 3:
		length = 2
	case 4:
		length = 4
	case 5, 8:
		length = 8
	case 6:
		if offset+2 > len(headers) {
			return 0, false
		}
		length = 2 + int(binary.BigEndian.Uint16(headers[offset:offset+2]))
	case 9:
		length = 16
	default:
		return 0, false
	}
	if offset+length > len(headers) {
		return 0, false
	}
	return offset + length, true
}

func updateKiroUsage(usage *kiroUsage, event map[string]any) {
	if usage == nil {
		return
	}
	for _, candidate := range []map[string]any{event, kiroNestedEvent(event, "metadataEvent")} {
		if tokenUsage, ok := candidate["tokenUsage"].(map[string]any); ok {
			setKiroUsageValue(&usage.InputTokens, tokenUsage["uncachedInputTokens"])
			setKiroUsageValue(&usage.OutputTokens, tokenUsage["outputTokens"])
			setKiroUsageValue(&usage.CacheReadTokens, tokenUsage["cacheReadInputTokens"])
		}
		setKiroUsageValue(&usage.InputTokens, candidate["inputTokens"])
		setKiroUsageValue(&usage.OutputTokens, candidate["outputTokens"])
	}
}

func setKiroUsageValue(target *int, value any) {
	if number, ok := value.(float64); ok && number >= 0 {
		*target = common.QuotaFromFloat(number)
	}
}

func kiroNestedEvent(event map[string]any, key string) map[string]any {
	if nested, ok := event[key].(map[string]any); ok {
		return nested
	}
	return event
}

func kiroString(value map[string]any, key string) string {
	text, _ := value[key].(string)
	return text
}

func kiroStopReason(value map[string]any) string {
	if reason := kiroString(value, "stopReason"); reason != "" {
		return reason
	}
	return kiroString(value, "stop_reason")
}

func kiroToolUses(primary, fallback map[string]any) []kiroToolUse {
	raw, _ := primary["toolUses"].([]any)
	if len(raw) == 0 {
		raw, _ = fallback["toolUses"].([]any)
	}
	tools := make([]kiroToolUse, 0, len(raw))
	for _, item := range raw {
		value, ok := item.(map[string]any)
		if !ok {
			continue
		}
		id := kiroString(value, "toolUseId")
		name := kiroString(value, "name")
		if id == "" || name == "" {
			continue
		}
		input, _ := value["input"].(map[string]any)
		if input == nil {
			if encoded, ok := value["input"].(string); ok {
				input = decodeKiroToolInput(encoded)
			} else {
				input = map[string]any{}
			}
		}
		tools = append(tools, kiroToolUse{ToolUseID: id, Name: name, Input: input})
	}
	return tools
}

func decodeKiroToolInput(value string) map[string]any {
	result := map[string]any{}
	if strings.TrimSpace(value) != "" {
		_ = common.Unmarshal([]byte(value), &result)
	}
	return result
}
