package service

import (
	"context"
	"fmt"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/storage"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type CodeStorageService interface {
	CreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.CodeRepo, error)
	GetOrCreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.CodeRepo, error)
	GetRepoFiles(ctx context.Context, assignmentID, userID uuid.UUID, path string) ([]CodeFileInfo, error)
	GetFileContent(ctx context.Context, assignmentID, userID uuid.UUID, filePath string) (content string, err error)
	SaveFile(ctx context.Context, assignmentID, userID uuid.UUID, filePath, content, message string) (sha string, err error)
	SubmitAssignment(ctx context.Context, repo *domain.CodeRepo, userID, assignmentID uuid.UUID, message string) (*domain.CodeVersion, error)
	GetSubmissionVersions(ctx context.Context, userID, assignmentID uuid.UUID) ([]domain.CodeVersion, error)
	GetSubmissionVersionsByCommit(ctx context.Context, assignmentID uuid.UUID, commitSHA string) ([]domain.CodeVersion, error)
	UpdateVersion(version *domain.CodeVersion) error
	GetCommitHistory(ctx context.Context, assignmentID, userID uuid.UUID) ([]CodeCommitInfo, error)
}

type CodeFileInfo struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	SHA      string `json:"sha"`
	Size     int64  `json:"size"`
	Type     string `json:"type"`
	Content  string `json:"content,omitempty"`
	IsFolder bool   `json:"is_folder"`
}

type CodeCommitInfo struct {
	SHA      string    `json:"sha"`
	Message  string    `json:"message"`
	Author   string    `json:"author"`
	Date     time.Time `json:"date"`
	Files    []string  `json:"files"`
}

type codeStorageService struct {
	codeRepoRepo  repository.CodeRepository
	storage       *storage.SeaweedGitStorage
	db            *gorm.DB
	logger        *zap.Logger
}

func NewCodeStorageService(codeRepoRepo repository.CodeRepository, storage *storage.SeaweedGitStorage, db *gorm.DB, logger *zap.Logger) CodeStorageService {
	return &codeStorageService{
		codeRepoRepo: codeRepoRepo,
		storage:      storage,
		db:           db,
		logger:       logger,
	}
}

func (s *codeStorageService) CreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.CodeRepo, error) {
	exists, _ := s.codeRepoRepo.GetRepoByAssignmentAndUser(assignmentID, userID)
	if exists != nil {
		return exists, nil
	}

	storagePath := fmt.Sprintf("code/%s/%s", assignmentID.String(), userID.String())

	if err := s.storage.InitRepo(ctx, assignmentID.String(), userID.String()); err != nil {
		s.logger.Error("failed to init seaweed repo", zap.Error(err))
		return nil, fmt.Errorf("failed to init repo: %w", err)
	}

	repo := &domain.CodeRepo{
		AssignmentID: assignmentID,
		UserID:       userID,
		StoragePath:  storagePath,
		LanguageID:   assignment.LanguageID,
		Language:     "python",
		IsActive:     true,
		UsedAt:       time.Now(),
	}

	if err := s.codeRepoRepo.CreateRepo(repo); err != nil {
		return nil, fmt.Errorf("failed to save repo: %w", err)
	}

	s.logger.Info("code repo created",
		zap.String("assignment", assignmentID.String()),
		zap.String("user", userID.String()),
	)

	return repo, nil
}

func (s *codeStorageService) GetOrCreateStudentRepo(ctx context.Context, assignmentID, userID uuid.UUID, assignment *domain.Assignment) (*domain.CodeRepo, error) {
	repo, err := s.codeRepoRepo.GetRepoByAssignmentAndUser(assignmentID, userID)
	if err != nil {
		return nil, err
	}
	if repo != nil {
		repo.UsedAt = time.Now()
		_ = s.codeRepoRepo.UpdateRepo(repo)
		return repo, nil
	}

	return s.CreateStudentRepo(ctx, assignmentID, userID, assignment)
}

func (s *codeStorageService) GetRepoFiles(ctx context.Context, assignmentID, userID uuid.UUID, path string) ([]CodeFileInfo, error) {
	files, err := s.storage.ListFiles(ctx, assignmentID.String(), userID.String(), path)
	if err != nil {
		return nil, fmt.Errorf("listing files: %w", err)
	}

	var result []CodeFileInfo
	for _, f := range files {
		result = append(result, CodeFileInfo{
			Name:     f.Name,
			Path:     f.Path,
			SHA:      "",
			Size:     f.Size,
			Type:     "file",
			IsFolder: f.IsFolder,
		})
	}

	return result, nil
}

func (s *codeStorageService) GetFileContent(ctx context.Context, assignmentID, userID uuid.UUID, filePath string) (string, error) {
	content, err := s.storage.GetFile(ctx, assignmentID.String(), userID.String(), filePath)
	if err != nil {
		return "", fmt.Errorf("getting file: %w", err)
	}
	return content, nil
}

func (s *codeStorageService) SaveFile(ctx context.Context, assignmentID, userID uuid.UUID, filePath, content, message string) (string, error) {
	sha, err := s.storage.SaveFile(ctx, assignmentID.String(), userID.String(), filePath, content)
	if err != nil {
		return "", fmt.Errorf("saving file: %w", err)
	}

	s.logger.Info("file saved",
		zap.String("assignment", assignmentID.String()),
		zap.String("user", userID.String()),
		zap.String("path", filePath),
	)

	return sha, nil
}

func (s *codeStorageService) SubmitAssignment(ctx context.Context, repo *domain.CodeRepo, userID, assignmentID uuid.UUID, message string) (*domain.CodeVersion, error) {
	versions, err := s.codeRepoRepo.GetVersionsByAssignmentAndUser(assignmentID, userID)
	if err != nil {
		return nil, err
	}

	newVersion := len(versions) + 1

	files, err := s.storage.ListFiles(ctx, assignmentID.String(), userID.String(), "")
	if err != nil {
		return nil, fmt.Errorf("getting files for commit: %w", err)
	}

	var fileNames []string
	for _, f := range files {
		fileNames = append(fileNames, f.Name)
	}

	sha := generateCommitSHA(message, assignmentID.String(), userID.String(), newVersion)

	err = s.storage.SaveVersion(ctx, assignmentID.String(), userID.String(), fmt.Sprintf("v%d", newVersion), message, fileNames)
	if err != nil {
		return nil, fmt.Errorf("saving version: %w", err)
	}

	version := &domain.CodeVersion{
		CodeRepoID:   repo.ID,
		AssignmentID: assignmentID,
		UserID:       userID,
		Version:      newVersion,
		CommitSHA:    sha,
		CommitMessage: message,
		TagName:      fmt.Sprintf("v%d", newVersion),
		GradingStatus: "pending",
		SubmittedAt:  time.Now(),
	}

	if err := s.codeRepoRepo.CreateVersion(version); err != nil {
		return nil, fmt.Errorf("creating version: %w", err)
	}

	s.logger.Info("assignment submitted",
		zap.String("assignment", assignmentID.String()),
		zap.String("user", userID.String()),
		zap.Int("version", newVersion),
		zap.String("sha", sha),
	)

	return version, nil
}

func (s *codeStorageService) GetSubmissionVersions(ctx context.Context, userID, assignmentID uuid.UUID) ([]domain.CodeVersion, error) {
	return s.codeRepoRepo.GetVersionsByAssignmentAndUser(assignmentID, userID)
}

func (s *codeStorageService) GetSubmissionVersionsByCommit(ctx context.Context, assignmentID uuid.UUID, commitSHA string) ([]domain.CodeVersion, error) {
	return s.codeRepoRepo.GetVersionsByCommitSHA(assignmentID, commitSHA)
}

func (s *codeStorageService) UpdateVersion(version *domain.CodeVersion) error {
	return s.codeRepoRepo.UpdateVersion(version)
}

func (s *codeStorageService) GetCommitHistory(ctx context.Context, assignmentID, userID uuid.UUID) ([]CodeCommitInfo, error) {
	versions, err := s.codeRepoRepo.GetVersionsByAssignmentAndUser(assignmentID, userID)
	if err != nil {
		return nil, err
	}

	var commits []CodeCommitInfo
	for _, v := range versions {
		commits = append(commits, CodeCommitInfo{
			SHA:     v.CommitSHA,
			Message: v.CommitMessage,
			Author:  userID.String(),
			Date:    v.SubmittedAt,
		})
	}

	return commits, nil
}

func generateCommitSHA(message, assignmentID, userID string, version int) string {
	return fmt.Sprintf("%s-%s-v%d-%d", assignmentID[:8], userID[:8], version, len(message))
}