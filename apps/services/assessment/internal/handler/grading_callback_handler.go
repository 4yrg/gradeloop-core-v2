package handler

import (
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type GradingCallbackRequest struct {
	AssignmentID string `json:"assignment_id"`
	CommitSHA    string `json:"commit_sha"`
	Status       string `json:"status"`
	Score        int    `json:"score"`
	Feedback     string `json:"feedback"`
}

type GradingCallbackHandler struct {
	githubService service.GitHubService
}

func NewGradingCallbackHandler(githubService service.GitHubService) *GradingCallbackHandler {
	return &GradingCallbackHandler{
		githubService: githubService,
	}
}

func (h *GradingCallbackHandler) RegisterRoutes(app *fiber.App) {
	grading := app.Group("/github")
	grading.Post("/grading-callback", h.HandleGradingCallback)
}

func (h *GradingCallbackHandler) HandleGradingCallback(c fiber.Ctx) error {
	var req GradingCallbackRequest
	if err := c.Bind().Body(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	assignmentID, err := uuid.Parse(req.AssignmentID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid assignment ID")
	}

	versions, err := h.githubService.GetSubmissionVersionsByCommit(c.RequestCtx(), assignmentID, req.CommitSHA)
	if err != nil || len(versions) == 0 {
		return fiber.NewError(fiber.StatusNotFound, "No submission found for this commit")
	}

	version := &versions[0]

	grade := float64(req.Score)
	version.Grade = &grade
	version.GradingStatus = req.Status
	now := time.Now()
	version.GradedAt = &now

	if req.Feedback != "" {
		version.GradingError = req.Feedback
	}

	err = h.githubService.UpdateVersion(version)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update grade")
	}

	return c.JSON(fiber.Map{
		"message":   "Grade received",
		"version":   version.Version,
		"score":     req.Score,
		"status":    req.Status,
	})
}