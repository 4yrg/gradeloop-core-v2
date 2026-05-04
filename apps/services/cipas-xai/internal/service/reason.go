package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/cipas/cipas-xai/internal/client"
	"github.com/4yrg/gradeloop-core-v2/apps/services/cipas/cipas-xai/internal/dto"
	"go.uber.org/zap"
)

// ReasonService handles reasoning operations
type ReasonService struct {
	llmClient client.LLMClient
	logger    *zap.Logger
}

// NewReasonService creates a new reason service
func NewReasonService(llmClient client.LLMClient, logger *zap.Logger) *ReasonService {
	return &ReasonService{
		llmClient: llmClient,
		logger:    logger,
	}
}

// GetReason generates reasoning for the given code and type
func (s *ReasonService) GetReason(ctx context.Context, req dto.ReasonRequest) (*dto.ReasonResponse, error) {
	systemPrompt := `You are an expert computer science professor specializing in Explainable AI (XAI) for code plagiarism and AI-generated code detection. Your goal is to explain *why* the provided code snippets are classified as a specific type of plagiarism or AI-generated.

You MUST return your response as a raw JSON object with no markdown formatting wrapping the JSON block, exactly matching this structure:
{
  "analysis": [
    {
      "code": "specific exact lines of code quoted from the provided snippets",
      "reason": "explanation of why this specific code is evidence of the classification"
    },
    {
      "code": "another specific snippet of code",
      "reason": "explanation of why this code is evidence"
    }
  ]
}
Provide as many evidence blocks as necessary to build a complete argument. Do not hallucinate or guess; rely only on the provided code.`

	userPrompt := s.buildUserPrompt(req)

	messages := []dto.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	resp, err := s.llmClient.SendChat(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("calling LLM: %w", err)
	}

	// Clean JSON response (remove markdown if any)
	cleanContent := strings.TrimSpace(resp.Content)
	cleanContent = strings.TrimPrefix(cleanContent, "```json")
	cleanContent = strings.TrimPrefix(cleanContent, "```")
	cleanContent = strings.TrimSuffix(cleanContent, "```")
	cleanContent = strings.TrimSpace(cleanContent)

	var llmResp dto.LLMReasonResponse
	if err := json.Unmarshal([]byte(cleanContent), &llmResp); err != nil {
		s.logger.Error("failed to unmarshal LLM response", zap.Error(err), zap.String("content", resp.Content))
		return nil, fmt.Errorf("parsing LLM response: %w", err)
	}

	return &dto.ReasonResponse{
		Analysis: llmResp.Analysis,
	}, nil
}

func (s *ReasonService) buildUserPrompt(req dto.ReasonRequest) string {
	semanticNames := map[string]string{
		"TYPE-01": "Exact Clones",
		"TYPE-02": "Renamed Clones",
		"TYPE-03": "Modified Clones",
		"TYPE-04": "Semantic Clones",
		"TYPE-AI": "AI-generated code",
	}

	typeDefinitions := map[string]string{
		"TYPE-01": "Exact Clones are identical code fragments, typically copy-pasted with only minor changes like whitespace or comments.",
		"TYPE-02": "Renamed Clones have identical structural logic but feature renamed identifiers (variable/function names) or different literal values.",
		"TYPE-03": "Modified Clones have had statements added, removed, or refactored, but remain fundamentally derived from the same source logic.",
		"TYPE-04": "Semantic Clones perform the same functionality and logic but are implemented using different syntax, algorithms, or control flows.",
		"TYPE-AI": "AI-generated code exhibits characteristics of Large Language Model (LLM) generation, such as generic patterns, lack of context-specific idiosyncrasies, or overly verbose documentation/comments.",
	}

	semanticName := semanticNames[req.Type]
	definition := typeDefinitions[req.Type]

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("I have analyzed the following code and classified it as %s. %s\n\n", semanticName, definition))

	for i, code := range req.Code {
		sb.WriteString(fmt.Sprintf("Snippet %d:\n```\n%s\n```\n\n", i+1, code))
	}

	if req.Type == "TYPE-AI" {
		sb.WriteString("Extract the specific code blocks that exhibit characteristics of AI-generated code, and provide the reasoning for each block in the requested JSON format.")
	} else {
		sb.WriteString(fmt.Sprintf("Extract the specific code blocks that prove these snippets are %s, and provide the reasoning for each block in the requested JSON format.", semanticName))
	}

	return sb.String()
}
