package handler

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type CodeHandler struct {
	codeStorageService service.CodeStorageService
	assignmentRepo     repository.AssignmentRepository
}

func NewCodeHandler(codeStorageService service.CodeStorageService, assignmentRepo repository.AssignmentRepository) *CodeHandler {
	return &CodeHandler{
		codeStorageService: codeStorageService,
		assignmentRepo:     assignmentRepo,
	}
}

func (h *CodeHandler) RegisterRoutes(app *fiber.App) {
	code := app.Group("/code")

	code.Get("/repos/:assignmentId", h.GetRepo)
	code.Post("/repos", h.CreateOrGetRepo)
	code.Get("/repos/:assignmentId/files", h.GetFiles)
	code.Get("/repos/:assignmentId/files/*", h.GetFileContent)
	code.Put("/repos/:assignmentId/files", h.SaveFile)
	code.Post("/repos/:assignmentId/submit", h.SubmitAssignment)
	code.Get("/repos/:assignmentId/versions", h.GetVersions)
	code.Get("/repos/:assignmentId/commits", h.GetCommits)
	code.Get("/config/:assignmentId", h.GetConfig)
	code.Put("/config/:assignmentId", h.UpdateConfig)
}

func (h *CodeHandler) GetRepo(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	assignment, _ := h.assignmentRepo.GetAssignmentByID(assignmentID)

	repo, err := h.codeStorageService.GetOrCreateStudentRepo(c.RequestCtx(), assignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	return c.JSON(dto.CodeRepoResponse{
		ID:           repo.ID,
		AssignmentID: repo.AssignmentID,
		UserID:       repo.UserID,
		StoragePath:  repo.StoragePath,
		LanguageID:   repo.LanguageID,
		Language:     repo.Language,
		CreatedAt:    repo.CreatedAt,
	})
}

func (h *CodeHandler) CreateOrGetRepo(c fiber.Ctx) error {
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

	repo, err := h.codeStorageService.GetOrCreateStudentRepo(c.RequestCtx(), req.AssignmentID, userID, assignment)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create repo")
	}

	return c.JSON(dto.CodeRepoResponse{
		ID:           repo.ID,
		AssignmentID: repo.AssignmentID,
		UserID:       repo.UserID,
		StoragePath:  repo.StoragePath,
		LanguageID:   repo.LanguageID,
		Language:     repo.Language,
		CreatedAt:    repo.CreatedAt,
	})
}

func (h *CodeHandler) GetFiles(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	path := c.Query("path", "")

	files, err := h.codeStorageService.GetRepoFiles(c.RequestCtx(), assignmentID, userID, path)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get files")
	}

	var response []dto.CodeFileResponse
	for _, f := range files {
		response = append(response, dto.CodeFileResponse{
			Name:     f.Name,
			Path:     f.Path,
			SHA:      f.SHA,
			Size:     f.Size,
			Type:     f.Type,
			IsFolder: f.IsFolder,
		})
	}

	if response == nil {
		response = []dto.CodeFileResponse{}
	}

	return c.JSON(response)
}

func (h *CodeHandler) GetFileContent(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	filePath := c.Params("*")
	if filePath == "" {
		return fiber.ErrBadRequest
	}

	content, err := h.codeStorageService.GetFileContent(c.RequestCtx(), assignmentID, userID, filePath)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get file")
	}

	return c.JSON(struct {
		Content string `json:"content"`
		SHA     string `json:"sha"`
	}{
		Content: content,
		SHA:     "",
	})
}

func (h *CodeHandler) SaveFile(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	var req dto.CodeSaveFileRequest
	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	sha, err := h.codeStorageService.SaveFile(c.RequestCtx(), assignmentID, userID, req.FilePath, req.Content, req.Message)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to save file")
	}

	return c.JSON(dto.CodeCommitResponse{
		Success: true,
		SHA:     sha,
		Message: req.Message,
	})
}

func (h *CodeHandler) SubmitAssignment(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	repo, err := h.codeStorageService.GetOrCreateStudentRepo(c.RequestCtx(), assignmentID, userID, nil)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get repo")
	}

	version, err := h.codeStorageService.SubmitAssignment(c.RequestCtx(), repo, userID, assignmentID, req.Message)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to submit")
	}

	return c.JSON(dto.CodeVersionResponse{
		ID:            version.ID,
		CodeRepoID:    version.CodeRepoID,
		AssignmentID:  version.AssignmentID,
		UserID:        version.UserID,
		Version:       version.Version,
		CommitSHA:     version.CommitSHA,
		CommitMessage: version.CommitMessage,
		TagName:       version.TagName,
		GradingStatus: version.GradingStatus,
		SubmittedAt:   version.SubmittedAt,
	})
}

func (h *CodeHandler) GetVersions(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	versions, err := h.codeStorageService.GetSubmissionVersions(c.RequestCtx(), userID, assignmentID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get versions")
	}

	var response []dto.CodeVersionResponse
	for _, v := range versions {
		response = append(response, dto.CodeVersionResponse{
			ID:            v.ID,
			CodeRepoID:    v.CodeRepoID,
			AssignmentID:  v.AssignmentID,
			UserID:        v.UserID,
			Version:       v.Version,
			CommitSHA:     v.CommitSHA,
			CommitMessage: v.CommitMessage,
			TagName:       v.TagName,
			Grade:         v.Grade,
			GradedAt:      v.GradedAt,
			GradingStatus: v.GradingStatus,
			GradingError:  v.GradingError,
			SubmittedAt:   v.SubmittedAt,
		})
	}

	if response == nil {
		response = []dto.CodeVersionResponse{}
	}

	return c.JSON(response)
}

func (h *CodeHandler) GetCommits(c fiber.Ctx) error {
	assignmentID, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	userID, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return fiber.ErrUnauthorized
	}

	commits, err := h.codeStorageService.GetCommitHistory(c.RequestCtx(), assignmentID, userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get commits")
	}

	var response []dto.CodeCommitResponse
	for _, c := range commits {
		response = append(response, dto.CodeCommitResponse{
			SHA:     c.SHA,
			Message: c.Message,
			Author:  c.Author,
			Date:    c.Date,
		})
	}

	if response == nil {
		response = []dto.CodeCommitResponse{}
	}

	return c.JSON(response)
}

func (h *CodeHandler) GetConfig(c fiber.Ctx) error {
	_, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	return c.JSON(struct {
		UseSeaweedFS bool   `json:"use_seaweedfs"`
		StarterCode  string `json:"starter_code"`
	}{
		UseSeaweedFS: true,
		StarterCode:  "",
	})
}

func (h *CodeHandler) UpdateConfig(c fiber.Ctx) error {
	_, err := uuid.Parse(c.Params("assignmentId"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req struct {
		UseSeaweedFS bool   `json:"use_seaweedfs"`
		StarterCode  string `json:"starter_code"`
	}
	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	return c.JSON(struct {
		Success bool `json:"success"`
	}{
		Success: true,
	})
}
