package repository

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GitHubRepository interface {
	CreateRepo(repo *domain.GitHubRepo) error
	GetRepo(id uuid.UUID) (*domain.GitHubRepo, error)
	GetRepoByAssignmentAndUser(assignmentID, userID uuid.UUID) (*domain.GitHubRepo, error)
	UpdateRepo(repo *domain.GitHubRepo) error
	DeleteRepo(id uuid.UUID) error
	ListReposByAssignment(assignmentID uuid.UUID) ([]domain.GitHubRepo, error)

	CreateVersion(version *domain.GitHubSubmissionVersion) error
	GetVersion(id uuid.UUID) (*domain.GitHubSubmissionVersion, error)
	GetVersionsByRepo(repoID uuid.UUID) ([]domain.GitHubSubmissionVersion, error)
	GetVersionsByUserAndAssignment(userID, assignmentID uuid.UUID) ([]domain.GitHubSubmissionVersion, error)
	GetLatestVersion(userID, assignmentID uuid.UUID) (*domain.GitHubSubmissionVersion, error)
	GetVersionsByCommit(assignmentID uuid.UUID, commitSHA string) ([]domain.GitHubSubmissionVersion, error)
	UpdateVersion(version *domain.GitHubSubmissionVersion) error

	GetAssignmentGitHubConfig(assignmentID uuid.UUID) (*domain.AssignmentGitHubConfig, error)
	CreateAssignmentGitHubConfig(config *domain.AssignmentGitHubConfig) error
	UpdateAssignmentGitHubConfig(config *domain.AssignmentGitHubConfig) error
}

type githubRepository struct {
	db *gorm.DB
}

func NewGitHubRepository(db *gorm.DB) GitHubRepository {
	return &githubRepository{db: db}
}

func (r *githubRepository) CreateRepo(repo *domain.GitHubRepo) error {
	return r.db.Create(repo).Error
}

func (r *githubRepository) GetRepo(id uuid.UUID) (*domain.GitHubRepo, error) {
	var repo domain.GitHubRepo
	if err := r.db.First(&repo, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &repo, nil
}

func (r *githubRepository) GetRepoByAssignmentAndUser(assignmentID, userID uuid.UUID) (*domain.GitHubRepo, error) {
	var repo domain.GitHubRepo
	if err := r.db.Where("assignment_id = ? AND user_id = ? AND is_active = ?", assignmentID, userID, true).First(&repo).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &repo, nil
}

func (r *githubRepository) UpdateRepo(repo *domain.GitHubRepo) error {
	return r.db.Save(repo).Error
}

func (r *githubRepository) DeleteRepo(id uuid.UUID) error {
	return r.db.Model(&domain.GitHubRepo{}).Where("id = ?", id).Update("is_active", false).Error
}

func (r *githubRepository) ListReposByAssignment(assignmentID uuid.UUID) ([]domain.GitHubRepo, error) {
	var repos []domain.GitHubRepo
	if err := r.db.Where("assignment_id = ? AND is_active = ?", assignmentID, true).Find(&repos).Error; err != nil {
		return nil, err
	}
	return repos, nil
}

func (r *githubRepository) CreateVersion(version *domain.GitHubSubmissionVersion) error {
	return r.db.Create(version).Error
}

func (r *githubRepository) GetVersion(id uuid.UUID) (*domain.GitHubSubmissionVersion, error) {
	var version domain.GitHubSubmissionVersion
	if err := r.db.First(&version, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &version, nil
}

func (r *githubRepository) GetVersionsByRepo(repoID uuid.UUID) ([]domain.GitHubSubmissionVersion, error) {
	var versions []domain.GitHubSubmissionVersion
	if err := r.db.Where("github_repo_id = ?", repoID).Order("version DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *githubRepository) GetVersionsByUserAndAssignment(userID, assignmentID uuid.UUID) ([]domain.GitHubSubmissionVersion, error) {
	var versions []domain.GitHubSubmissionVersion
	if err := r.db.Where("user_id = ? AND assignment_id = ?", userID, assignmentID).Order("version DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *githubRepository) GetLatestVersion(userID, assignmentID uuid.UUID) (*domain.GitHubSubmissionVersion, error) {
	var version domain.GitHubSubmissionVersion
	if err := r.db.Where("user_id = ? AND assignment_id = ?", userID, assignmentID).Order("version DESC").First(&version).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &version, nil
}

func (r *githubRepository) GetVersionsByCommit(assignmentID uuid.UUID, commitSHA string) ([]domain.GitHubSubmissionVersion, error) {
	var versions []domain.GitHubSubmissionVersion
	if err := r.db.Where("assignment_id = ? AND commit_sha = ?", assignmentID, commitSHA).Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *githubRepository) UpdateVersion(version *domain.GitHubSubmissionVersion) error {
	return r.db.Save(version).Error
}

func (r *githubRepository) GetAssignmentGitHubConfig(assignmentID uuid.UUID) (*domain.AssignmentGitHubConfig, error) {
	var config domain.AssignmentGitHubConfig
	if err := r.db.First(&config, "assignment_id = ?", assignmentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &config, nil
}

func (r *githubRepository) CreateAssignmentGitHubConfig(config *domain.AssignmentGitHubConfig) error {
	return r.db.Create(config).Error
}

func (r *githubRepository) UpdateAssignmentGitHubConfig(config *domain.AssignmentGitHubConfig) error {
	return r.db.Save(config).Error
}

type GitHubRepoContext struct {
	context.Context
	githubRepo GitHubRepository
}

func NewGitHubRepoContext(ctx context.Context, db *gorm.DB) context.Context {
	return context.WithValue(ctx, "github_repo", NewGitHubRepository(db))
}

func GetGitHubRepoFromContext(ctx context.Context) GitHubRepository {
	if repo, ok := ctx.Value("github_repo").(GitHubRepository); ok {
		return repo
	}
	return nil
}