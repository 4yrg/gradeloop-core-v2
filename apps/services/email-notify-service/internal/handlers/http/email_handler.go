package http

import (
	"log"
	"net/http"

	"email-notify-service/internal/core/domain"
	"email-notify-service/internal/core/ports"

	"github.com/gin-gonic/gin"
)

type EmailHandler struct {
	emailService ports.EmailService
}

func NewEmailHandler(emailService ports.EmailService) *EmailHandler {
	return &EmailHandler{
		emailService: emailService,
	}
}

// SendEmail handles HTTP requests to send emails
// @Summary Send an email
// @Description Send an email using the specified template and data
// @Tags email
// @Accept json
// @Produce json
// @Param email body domain.EmailRequest true "Email request"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/email/send [post]
func (h *EmailHandler) SendEmail(c *gin.Context) {
	var req domain.EmailRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[EmailHandler] Invalid request payload: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request payload",
			"details": err.Error(),
		})
		return
	}

	// Validate required fields
	if len(req.To) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one recipient is required",
		})
		return
	}

	if req.Subject == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Subject is required",
		})
		return
	}

	if req.TemplateName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Template name is required",
		})
		return
	}

	log.Printf("[EmailHandler] Sending email to %v with template %s", req.To, req.TemplateName)

	// Send email using the service
	if err := h.emailService.Send(c.Request.Context(), req); err != nil {
		log.Printf("[EmailHandler] Failed to send email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to send email",
			"details": err.Error(),
		})
		return
	}

	log.Printf("[EmailHandler] Email sent successfully to %v", req.To)
	c.JSON(http.StatusOK, gin.H{
		"message": "Email sent successfully",
		"to":      req.To,
		"subject": req.Subject,
	})
}

// HealthCheck handles health check requests
// @Summary Health check
// @Description Check the health of the email service
// @Tags health
// @Produce json
// @Success 200 {object} map[string]string
// @Router /health [get]
func (h *EmailHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "email-notify-service",
	})
}

// TestTemplate handles template testing requests
// @Summary Test email template
// @Description Test an email template with sample data
// @Tags email
// @Accept json
// @Produce json
// @Param template body map[string]interface{} true "Template test request"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/email/test-template [post]
func (h *EmailHandler) TestTemplate(c *gin.Context) {
	var req struct {
		TemplateName string                 `json:"template_name"`
		TemplateData map[string]interface{} `json:"template_data"`
		TestEmail    string                 `json:"test_email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request payload",
			"details": err.Error(),
		})
		return
	}

	if req.TemplateName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Template name is required",
		})
		return
	}

	if req.TestEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Test email is required",
		})
		return
	}

	// Create email request
	emailReq := domain.EmailRequest{
		To:           []string{req.TestEmail},
		Subject:      "Template Test - " + req.TemplateName,
		TemplateName: req.TemplateName,
		TemplateData: req.TemplateData,
	}

	// Send test email
	if err := h.emailService.Send(c.Request.Context(), emailReq); err != nil {
		log.Printf("[EmailHandler] Failed to send test email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to send test email",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Test email sent successfully",
		"template": req.TemplateName,
		"to":       req.TestEmail,
	})
}
