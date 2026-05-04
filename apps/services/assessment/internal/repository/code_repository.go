package repository

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CodeRepository interface {
	CreateRepo(repo *domain.CodeRepo) error
	GetRepo(id uuid.UUID) (*domain.CodeRepo, error)
	GetRepoByAssignmentAndUser(assignmentID, userID uuid.UUID) (*domain.CodeRepo, error)
	UpdateRepo(repo *domain.CodeRepo) error
	DeleteRepo(id uuid.UUID) error
	ListReposByAssignment(assignmentID uuid.UUID) ([]domain.CodeRepo, error)

	CreateVersion(version *domain.CodeVersion) error
	GetVersion(id uuid.UUID) (*domain.CodeVersion, error)
	GetVersionsByRepo(repoID uuid.UUID) ([]domain.CodeVersion, error)
	GetVersionsByAssignmentAndUser(assignmentID, userID uuid.UUID) ([]domain.CodeVersion, error)
	GetLatestVersion(userID, assignmentID uuid.UUID) (*domain.CodeVersion, error)
	GetVersionsByCommitSHA(assignmentID uuid.UUID, commitSHA string) ([]domain.CodeVersion, error)
	UpdateVersion(version *domain.CodeVersion) error

	GetAssignmentCodeConfig(assignmentID uuid.UUID) (*domain.AssignmentCodeConfig, error)
	CreateAssignmentCodeConfig(config *domain.AssignmentCodeConfig) error
	UpdateAssignmentCodeConfig(config *domain.AssignmentCodeConfig) error
}

type codeRepository struct {
	db *gorm.DB
}

func NewCodeRepository(db *gorm.DB) CodeRepository {
	return &codeRepository{db: db}
}

func (r *codeRepository) CreateRepo(repo *domain.CodeRepo) error {
	return r.db.Create(repo).Error
}

func (r *codeRepository) GetRepo(id uuid.UUID) (*domain.CodeRepo, error) {
	var repo domain.CodeRepo
	if err := r.db.First(&repo, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &repo, nil
}

func (r *codeRepository) GetRepoByAssignmentAndUser(assignmentID, userID uuid.UUID) (*domain.CodeRepo, error) {
	var repo domain.CodeRepo
	if err := r.db.Where("assignment_id = ? AND user_id = ? AND is_active = ?", assignmentID, userID, true).First(&repo).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &repo, nil
}

func (r *codeRepository) UpdateRepo(repo *domain.CodeRepo) error {
	return r.db.Save(repo).Error
}

func (r *codeRepository) DeleteRepo(id uuid.UUID) error {
	return r.db.Model(&domain.CodeRepo{}).Where("id = ?", id).Update("is_active", false).Error
}

func (r *codeRepository) ListReposByAssignment(assignmentID uuid.UUID) ([]domain.CodeRepo, error) {
	var repos []domain.CodeRepo
	if err := r.db.Where("assignment_id = ? AND is_active = ?", assignmentID, true).Find(&repos).Error; err != nil {
		return nil, err
	}
	return repos, nil
}

func (r *codeRepository) CreateVersion(version *domain.CodeVersion) error {
	return r.db.Create(version).Error
}

func (r *codeRepository) GetVersion(id uuid.UUID) (*domain.CodeVersion, error) {
	var version domain.CodeVersion
	if err := r.db.First(&version, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &version, nil
}

func (r *codeRepository) GetVersionsByRepo(repoID uuid.UUID) ([]domain.CodeVersion, error) {
	var versions []domain.CodeVersion
	if err := r.db.Where("code_repo_id = ?", repoID).Order("version DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *codeRepository) GetVersionsByAssignmentAndUser(assignmentID, userID uuid.UUID) ([]domain.CodeVersion, error) {
	var versions []domain.CodeVersion
	if err := r.db.Where("assignment_id = ? AND user_id = ?", assignmentID, userID).Order("version DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *codeRepository) GetLatestVersion(userID, assignmentID uuid.UUID) (*domain.CodeVersion, error) {
	var version domain.CodeVersion
	if err := r.db.Where("assignment_id = ? AND user_id = ?", assignmentID, userID).Order("version DESC").First(&version).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &version, nil
}

func (r *codeRepository) GetVersionsByCommitSHA(assignmentID uuid.UUID, commitSHA string) ([]domain.CodeVersion, error) {
	var versions []domain.CodeVersion
	if err := r.db.Where("assignment_id = ? AND commit_sha = ?", assignmentID, commitSHA).Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func (r *codeRepository) UpdateVersion(version *domain.CodeVersion) error {
	return r.db.Save(version).Error
}

func (r *codeRepository) GetAssignmentCodeConfig(assignmentID uuid.UUID) (*domain.AssignmentCodeConfig, error) {
	var config domain.AssignmentCodeConfig
	if err := r.db.First(&config, "assignment_id = ?", assignmentID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &config, nil
}

func (r *codeRepository) CreateAssignmentCodeConfig(config *domain.AssignmentCodeConfig) error {
	return r.db.Create(config).Error
}

func (r *codeRepository) UpdateAssignmentCodeConfig(config *domain.AssignmentCodeConfig) error {
	return r.db.Save(config).Error
}
