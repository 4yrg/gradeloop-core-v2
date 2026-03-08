package dto

// ChatMessage represents a single message in a chat conversation
type ChatMessage struct {
	Role    string `json:"role"`    // "system", "user", or "assistant"
	Content string `json:"content"` // The content of the message
}

// ChatRequest represents the request body for chat endpoint
type ChatRequest struct {
	Messages  []ChatMessage `json:"messages"`             // Array of chat messages
	Model     string        `json:"model,omitempty"`      // Optional model override
	Stream    bool          `json:"stream,omitempty"`     // Whether to stream the response
	MaxTokens int           `json:"max_tokens,omitempty"` // Optional max tokens override
}

// ChatResponse represents a non-streaming chat response
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

// StreamChunk represents a single chunk in a streaming response
type StreamChunk struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Content string `json:"content"`
	Done    bool   `json:"done"`
}
