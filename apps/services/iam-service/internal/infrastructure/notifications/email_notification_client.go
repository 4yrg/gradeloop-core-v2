package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	gl_logger "github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/google/uuid"
)

// EmailNotificationClient implements the NotificationPort interface using HTTP calls to the email service
type EmailNotificationClient struct {
	httpClient *http.Client
	baseURL    string
	logger     *slog.Logger
}

// EmailRequest represents the request structure for the email service
type EmailRequest struct {
	To           []string               `json:"to"`
	Subject      string                 `json:"subject"`
	TemplateName string                 `json:"template_name"`
	TemplateData map[string]interface{} `json:"template_data"`
}

// EmailResponse represents the response from the email service
type EmailResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	EmailID string `json:"email_id,omitempty"`
}

// NewEmailNotificationClient creates a new HTTP-based email notification client
func NewEmailNotificationClient(baseURL string) ports.NotificationPort {
	return &EmailNotificationClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  false,
				TLSHandshakeTimeout: 10 * time.Second,
			},
		},
		baseURL: baseURL,
		logger:  gl_logger.New("iam-email-client"),
	}
}

// SendActivationLink sends an account activation email via the email service
func (c *EmailNotificationClient) SendActivationLink(ctx context.Context, userID uuid.UUID, email string, activationLink string) error {
	c.logger.Info("Sending account activation email",
		"user_id", userID,
		"email", email,
	)

	// Prepare email request
	emailReq := EmailRequest{
		To:           []string{email},
		Subject:      "Activate Your GradeLoop Account",
		TemplateName: "account_activation.html",
		TemplateData: map[string]interface{}{
			"Name":           extractNameFromEmail(email), // Fallback if name not available
			"ActivationLink": activationLink,
		},
	}

	// Send HTTP request to email service
	if err := c.sendEmailRequest(ctx, emailReq); err != nil {
		c.logger.Error("Failed to send activation email",
			"user_id", userID,
			"email", email,
			"error", err,
		)
		return fmt.Errorf("failed to send activation email: %w", err)
	}

	c.logger.Info("Account activation email sent successfully",
		"user_id", userID,
		"email", email,
	)

	return nil
}

// SendPasswordResetLink sends a password reset email via the email service
func (c *EmailNotificationClient) SendPasswordResetLink(ctx context.Context, userID uuid.UUID, email string, resetLink string) error {
	c.logger.Info("Sending password reset email",
		"user_id", userID,
		"email", email,
	)

	// Prepare email request
	emailReq := EmailRequest{
		To:           []string{email},
		Subject:      "Reset Your GradeLoop Password",
		TemplateName: "password_reset.html",
		TemplateData: map[string]interface{}{
			"Name":      extractNameFromEmail(email), // Fallback if name not available
			"ResetLink": resetLink,
		},
	}

	// Send HTTP request to email service
	if err := c.sendEmailRequest(ctx, emailReq); err != nil {
		c.logger.Error("Failed to send password reset email",
			"user_id", userID,
			"email", email,
			"error", err,
		)
		return fmt.Errorf("failed to send password reset email: %w", err)
	}

	c.logger.Info("Password reset email sent successfully",
		"user_id", userID,
		"email", email,
	)

	return nil
}

// sendEmailRequest makes an HTTP request to the email service
func (c *EmailNotificationClient) sendEmailRequest(ctx context.Context, emailReq EmailRequest) error {
	// Marshal request body
	reqBody, err := json.Marshal(emailReq)
	if err != nil {
		return fmt.Errorf("failed to marshal email request: %w", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("%s/api/v1/email/send", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "gradeloop-iam-service/1.0")

	// Add request ID for tracing
	if requestID := ctx.Value("request_id"); requestID != nil {
		req.Header.Set("X-Request-ID", fmt.Sprintf("%v", requestID))
	}

	// Make HTTP request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send HTTP request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusAccepted {
		// Try to read error response
		var errorBody bytes.Buffer
		if _, readErr := errorBody.ReadFrom(resp.Body); readErr == nil {
			return fmt.Errorf("email service returned error status %d: %s", resp.StatusCode, errorBody.String())
		}
		return fmt.Errorf("email service returned error status %d", resp.StatusCode)
	}

	// Parse response
	var emailResp EmailResponse
	if err := json.NewDecoder(resp.Body).Decode(&emailResp); err != nil {
		// If we can't decode the response but got a success status, consider it successful
		c.logger.Warn("Failed to decode email service response", "error", err)
		return nil
	}

	// Check if email service reported an error
	if emailResp.Status == "error" || emailResp.Status == "failed" {
		return fmt.Errorf("email service reported error: %s", emailResp.Message)
	}

	c.logger.Info("Email sent successfully via email service",
		"status", emailResp.Status,
		"email_id", emailResp.EmailID,
	)

	return nil
}

// extractNameFromEmail extracts a name from an email address as a fallback
// This is used when the full name is not available from the user context
func extractNameFromEmail(email string) string {
	// Simple extraction: take the part before @ and clean it up
	parts := []rune(email)
	name := ""

	for _, char := range parts {
		if char == '@' {
			break
		}
		if char == '.' || char == '_' || char == '-' {
			name += " "
		} else {
			name += string(char)
		}
	}

	if name == "" {
		return "User" // Ultimate fallback
	}

	// Capitalize first letter of each word
	nameBytes := []byte(name)
	capitalize := true

	for i, b := range nameBytes {
		if b == ' ' {
			capitalize = true
		} else if capitalize && b >= 'a' && b <= 'z' {
			nameBytes[i] = b - 32 // Convert to uppercase
			capitalize = false
		} else {
			capitalize = false
		}
	}

	return string(nameBytes)
}

// HealthCheck checks if the email service is healthy
func (c *EmailNotificationClient) HealthCheck(ctx context.Context) error {
	url := fmt.Sprintf("%s/health", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("email service health check failed with status %d", resp.StatusCode)
	}

	return nil
}

// Close closes the HTTP client and cleans up resources
func (c *EmailNotificationClient) Close() error {
	// Close any persistent connections
	c.httpClient.CloseIdleConnections()
	return nil
}
