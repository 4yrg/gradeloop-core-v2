package handler

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type GitHubHandler struct {
	githubService    service.GitHubService
	assignmentRepo   repository.AssignmentRepository
}

func NewGitHubHandler(githubService service.GitHubService, assignmentRepo repository.AssignmentRepository) *GitHubHandler {
	return &GitHubHandler{
		githubService:  githubService,
		assignmentRepo: assignmentRepo,
	}
}

func (h *GitHubHandler) RegisterRoutes(app *fiber.App) {
	github := app.Group("/github")

	github.Get("/repos/:assignmentId", h.GetRepo)
	github.Post("/repos", h.CreateOrGetRepo)
	github.Get("/repos/:assignmentId/files", h.GetFiles)
	github.Get("/repos/:assignmentId/files/*", h.GetFileContent)
	github.Put("/repos/:assignmentId/files", h.CommitFile)
	github.Post("/repos/:assignmentId/submit", h.SubmitAssignment)
	github.Get("/repos/:assignmentId/versions", h.GetVersions)
	github.Get("/repos/:assignmentId/commits", h.GetCommits)
	github.Get("/config/:assignmentId", h.GetConfig)
	github.Put("/config/:assignmentId", h.UpdateConfig)
}

func (h *GitHubHandler) GetRepo(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, _ := h.assignmentRepo.GetAssignmentByID(assignmentID)

	repo, err := h.githubService.GetOrCreateStudentRepo(c.Context(), assignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	return c.JSON(dto.GitHubRepoResponse{
		ID:           repo.ID,
		AssignmentID: repo.AssignmentID,
		UserID:       repo.UserID,
		OrgName:      repo.OrgName,
		RepoName:     repo.RepoName,
		RepoURL:      repo.RepoURL,
		CloneURL:     repo.CloneURL,
		HTMLURL:      repo.HTMLURL,
		LanguageID:   repo.LanguageID,
		Language:     repo.Language,
		CreatedAt:    repo.CreatedAt,
	})
}

func (h *GitHubHandler) CreateOrGetRepo(c fiber.Ctx) error {
	var req struct {
		AssignmentID uuid.UUID `json:"assignment_id"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, err := h.assignmentRepo.GetAssignmentByID(req.AssignmentID)
	if err != nil || assignment == nil {
		return fiber.NewError(fiber.StatusNotFound, "Assignment not found")
	}

	repo, err := h.githubService.GetOrCreateStudentRepo(c.Context(), req.AssignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create repo")
	}

	return c.JSON(dto.GitHubRepoResponse{
		ID:           repo.ID,
		AssignmentID: repo.AssignmentID,
		UserID:       repo.UserID,
		OrgName:      repo.OrgName,
		RepoName:     repo.RepoName,
		RepoURL:      repo.RepoURL,
		CloneURL:     repo.CloneURL,
		HTMLURL:      repo.HTMLURL,
		LanguageID:   repo.LanguageID,
		Language:     repo.Language,
		CreatedAt:    repo.CreatedAt,
	})
}

func (h *GitHubHandler) GetFiles(c fiber.Ctx) error {
	assignmentIDStr := c.Params("assignmentId")
	path := c.Query("path")

	assignmentID, err := uuid.Parse(assignmentIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, _ := h.assignmentRepo.GetAssignmentByID(assignmentID)

	repo, err := h.githubService.GetOrCreateStudentRepo(c.Context(), assignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	files, err := h.githubService.GetRepoFiles(c.Context(), repo.OrgName, repo.RepoName, path)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get files")
	}

	result := make([]dto.GitHubFileResponse, len(files))
	for i, f := range files {
		result[i] = dto.GitHubFileResponse{
			Name:        f.Name,
			Path:        f.Path,
			SHA:         f.SHA,
			Size:        f.Size,
			Type:        f.Type,
			DownloadURL: f.DownloadURL,
		}
	}

	return c.JSON(result)
}

func (h *GitHubHandler) GetFileContent(c fiber.Ctx) error {
	assignmentIDStr := c.Params("assignmentId")
	filePath := c.Params("*")

	assignmentID, err := uuid.Parse(assignmentIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, _ := h.assignmentRepo.GetAssignmentByID(assignmentID)

	repo, err := h.githubService.GetOrCreateStudentRepo(c.Context(), assignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	content, sha, err := h.githubService.GetFileContent(c.Context(), repo.OrgName, repo.RepoName, filePath)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get file content")
	}

	return c.JSON(fiber.Map{
		"content": content,
		"sha":     sha,
	})
}

func (h *GitHubHandler) CommitFile(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req dto.GitHubCommitRequest
	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, _ := h.assignmentRepo.GetAssignmentByID(assignmentID)

	repo, err := h.githubService.GetOrCreateStudentRepo(c.Context(), assignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	err = h.githubService.CommitFile(c.Context(), repo.OrgName, repo.RepoName, req.FilePath, req.Content, req.Message, req.SHA)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to commit")
	}

	return c.JSON(dto.GitHubCommitResponse{
		Success: true,
		Message: req.Message,
	})
}

func (h *GitHubHandler) SubmitAssignment(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req dto.GitHubSubmitRequest
	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, _ := h.assignmentRepo.GetAssignmentByID(assignmentID)

	repo, err := h.githubService.GetOrCreateStudentRepo(c.Context(), assignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	version, err := h.githubService.SubmitAssignment(c.Context(), repo, userID, assignmentID, req.Message)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to submit")
	}

	return c.JSON(dto.GitHubVersionResponse{
		ID:              version.ID,
		GitHubRepoID:    version.GitHubRepoID,
		AssignmentID:   version.AssignmentID,
		UserID:          version.UserID,
		Version:         version.Version,
		CommitSHA:       version.CommitSHA,
		CommitMessage:   version.CommitMessage,
		TagName:         version.TagName,
		Grade:           version.Grade,
		GradedAt:        version.GradedAt,
		GradingStatus:   version.GradingStatus,
		GradingError:    version.GradingError,
		SubmittedAt:     version.SubmittedAt,
	})
}

func (h *GitHubHandler) GetVersions(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	versions, err := h.githubService.GetSubmissionVersions(c.Context(), userID, assignmentID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get versions")
	}

	result := make([]dto.GitHubVersionResponse, len(versions))
	for i, v := range versions {
		result[i] = dto.GitHubVersionResponse{
			ID:              v.ID,
			GitHubRepoID:    v.GitHubRepoID,
			AssignmentID:   v.AssignmentID,
			UserID:          v.UserID,
			Version:         v.Version,
			CommitSHA:       v.CommitSHA,
			CommitMessage:   v.CommitMessage,
			TagName:         v.TagName,
			Grade:           v.Grade,
			GradedAt:        v.GradedAt,
			GradingStatus:   v.GradingStatus,
			GradingError:    v.GradingError,
			SubmittedAt:     v.SubmittedAt,
		}
	}

	return c.JSON(dto.ListGitHubVersionsResponse{
		Versions: result,
		Count:    len(result),
	})
}

func (h *GitHubHandler) GetCommits(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, _ := h.assignmentRepo.GetAssignmentByID(assignmentID)

	repo, err := h.githubService.GetOrCreateStudentRepo(c.Context(), assignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	commits, err := h.githubService.GetCommitHistory(c.Context(), repo.OrgName, repo.RepoName)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get commits")
	}

	type commitResponse struct {
		SHA      string `json:"sha"`
		Message  string `json:"message"`
		Date     string `json:"date"`
	}

	result := make([]commitResponse, len(commits))
	for i, c := range commits {
		result[i] = commitResponse{
			SHA:     c.SHA,
			Message: c.Message,
			Date:    c.Date.Format("2006-01-02T15:04:05Z"),
		}
	}

	return c.JSON(result)
}

func (h *GitHubHandler) GetConfig(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	assignment, err := h.assignmentRepo.GetAssignmentByID(assignmentID)
	if err != nil || assignment == nil {
		return fiber.NewError(fiber.StatusNotFound, "Assignment not found")
	}

	return c.JSON(dto.GitHubConfigResponse{
		GitHubOrg:       assignment.GitHubOrg,
		UseGitHub:       assignment.UseGitHub,
		StarterCodeRepo: assignment.StarterCodeRepo,
	})
}

func (h *GitHubHandler) UpdateConfig(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req dto.GitHubConfigRequest
	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	assignment, err := h.assignmentRepo.GetAssignmentByID(assignmentID)
	if err != nil || assignment == nil {
		return fiber.NewError(fiber.StatusNotFound, "Assignment not found")
	}

	assignment.GitHubOrg = req.GitHubOrg
	assignment.UseGitHub = req.UseGitHub
	assignment.StarterCodeRepo = req.StarterCodeRepo

	err = h.assignmentRepo.UpdateAssignment(assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update config")
	}

	return c.JSON(fiber.Map{"message": "Config updated"})
}