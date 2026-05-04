package dto

// ReasonRequest represents the request body for the reason endpoint
type ReasonRequest struct {
	Type string   `json:"type"` // TYPE-1, TYPE-2, TYPE-3, TYPE-4, TYPE-AI
	Code []string `json:"code"`
}

// ReasonResponse represents the response body for the reason endpoint
type ReasonResponse struct {
	Reason string `json:"reason"`
}

// LLMReasonResponse represents the internal structure to parse the LLM JSON response
type LLMReasonResponse struct {
	Reason string `json:"reason"`
}

// ChatMessage represents a single message in a conversation with an LLM
type ChatMessage struct {
	Role    string      `json:"role"`    // "system", "user", or "assistant"
	Content interface{} `json:"content"` // String or array of MessageContent
}

// MessageContent represents a single content item in a message (text or image)
type MessageContent struct {
	Type     string    `json:"type"` // "text" or "image_url"
	Text     string    `json:"text,omitempty"`
	ImageURL *ImageURL `json:"image_url,omitempty"`
}

// ImageURL represents an image URL in a message
type ImageURL struct {
	URL string `json:"url"`
}

// ChatResponse represents a raw chat response from the LLM client
type ChatResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Content string `json:"content"`
	Usage   Usage  `json:"usage,omitempty"`
}

// Usage represents token usage statistics
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// GetContentAsString returns content as a string if it's a simple text message
func (m *ChatMessage) GetContentAsString() string {
	if content, ok := m.Content.(string); ok {
		return content
	}
	return ""
}

// GetContentAsArray returns content as an array of MessageContent for multi-modal messages
func (m *ChatMessage) GetContentAsArray() []MessageContent {
	if content, ok := m.Content.([]interface{}); ok {
		var result []MessageContent
		for _, item := range content {
			if itemMap, ok := item.(map[string]interface{}); ok {
				msgContent := MessageContent{
					Type: getStringValue(itemMap, "type"),
					Text: getStringValue(itemMap, "text"),
				}
				if imageURL, ok := itemMap["image_url"].(map[string]interface{}); ok {
					msgContent.ImageURL = &ImageURL{
						URL: getStringValue(imageURL, "url"),
					}
				}
				result = append(result, msgContent)
			}
		}
		return result
	}
	return nil
}

// getStringValue safely gets a string value from a map
func getStringValue(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// StreamChunk represents a single chunk in a streaming response (kept for interface compatibility)
type StreamChunk struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Content string `json:"content"`
	Done    bool   `json:"done"`
}
