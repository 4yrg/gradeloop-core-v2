package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/service"
	"github.com/gofiber/fiber/v3"
)

type WebhookHandler struct {
	githubService service.GitHubService
	webhookSecret string
}

func NewWebhookHandler(githubService service.GitHubService, webhookSecret string) *WebhookHandler {
	return &WebhookHandler{
		githubService: githubService,
		webhookSecret: webhookSecret,
	}
}

func (h *WebhookHandler) RegisterRoutes(app *fiber.App) {
	webhook := app.Group("/github")
	webhook.Post("/webhook", h.HandleWebhook)
}

type GitHubPushEvent struct {
	Ref        string `json:"ref"`
	Before     string `json:"before"`
	After      string `json:"after"`
	Repository struct {
		Name   string `json:"name"`
		Owner  struct {
			Login string `json:"login"`
		} `json:"owner"`
	} `json:"repository"`
	Pusher struct {
		Name string `json:"name"`
	} `json:"pusher"`
	Commits []struct {
		ID        string `json:"id"`
		Message   string `json:"message"`
		Timestamp string `json:"timestamp"`
		Author    struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		} `json:"author"`
	} `json:"commits"`
}

func (h *WebhookHandler) HandleWebhook(c fiber.Ctx) error {
	eventType := c.Get("X-GitHub-Event")

	// Handle ping event immediately
	if eventType == "ping" {
		return c.JSON(fiber.Map{"status": "ok", "message": "pong"})
	}

	signature := c.Get("X-Hub-Signature-256")
	if signature == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "Missing signature")
	}

	if h.webhookSecret != "" {
		payload := c.Body()
		expectedSig := computeHMAC(payload, h.webhookSecret)
		if !hmac.Equal([]byte(signature), []byte("sha256="+expectedSig)) {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid signature")
		}
	}

	switch eventType {
	case "push":
		return h.handlePushEvent(c)
	case "workflow_run":
		return h.handleWorkflowRunEvent(c)
	default:
		return c.JSON(fiber.Map{"status": "ignored", "event": eventType})
	}
}

func (h *WebhookHandler) handlePushEvent(c fiber.Ctx) error {
	var event GitHubPushEvent
	if err := json.Unmarshal(c.Body(), &event); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid payload")
	}

	if event.Ref != "refs/heads/main" && event.Ref != "refs/heads/master" {
		return c.JSON(fiber.Map{"status": "ignored", "reason": "not main branch"})
	}

	if len(event.Commits) == 0 {
		return c.JSON(fiber.Map{"status": "ignored", "reason": "no commits"})
	}

	return c.JSON(fiber.Map{
		"status":    "received",
		"event":      "push",
		"repo":       event.Repository.Name,
		"commits":    len(event.Commits),
		"after":      event.After,
	})
}

func (h *WebhookHandler) handleWorkflowRunEvent(c fiber.Ctx) error {
	var event struct {
		Action      string `json:"action"`
		WorkflowRun struct {
			ID          int    `json:"id"`
			Conclusion  string `json:"conclusion"`
			HeadBranch  string `json:"head_branch"`
			HeadSHA     string `json:"head_sha"`
			RunNumber   int    `json:"run_number"`
		} `json:"workflow_run"`
		Repository struct {
			Name string `json:"name"`
		} `json:"repository"`
	}

	if err := json.Unmarshal(c.Body(), &event); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid payload")
	}

	if event.Action != "completed" {
		return c.JSON(fiber.Map{"status": "ignored", "action": event.Action})
	}

	conclusion := event.WorkflowRun.Conclusion
	headSHA := event.WorkflowRun.HeadSHA

	return c.JSON(fiber.Map{
		"status":     "received",
		"event":      "workflow_run",
		"conclusion": conclusion,
		"head_sha":   headSHA,
	})
}

func computeHMAC(payload []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}