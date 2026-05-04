package repository

import (
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BatchMemberRepository defines all data operations for batch members.
type BatchMemberRepository interface {
	AddMember(member *domain.BatchMember) error
	AddMembers(members []domain.BatchMember) error
	GetMembers(batchID uuid.UUID) ([]domain.BatchMember, error)
	GetMember(batchID, userID uuid.UUID) (*domain.BatchMember, error)
	GetBatchesByUserID(userID uuid.UUID) ([]uuid.UUID, error)
	GetMembersByBatchID(batchID uuid.UUID) ([]uuid.UUID, error)
	RemoveMember(batchID, userID uuid.UUID) error
}

// batchMemberRepository is the concrete GORM-backed implementation.
type batchMemberRepository struct {
	db *gorm.DB
}

// NewBatchMemberRepository creates a new batchMemberRepository.
func NewBatchMemberRepository(db *gorm.DB) BatchMemberRepository {
	return &batchMemberRepository{db: db}
}

// AddMember inserts a new batch membership record.
func (r *batchMemberRepository) AddMember(member *domain.BatchMember) error {
	return r.db.Create(member).Error
}

// AddMembers inserts multiple batch membership records in one batch operation.
func (r *batchMemberRepository) AddMembers(members []domain.BatchMember) error {
	if len(members) == 0 {
		return nil
	}
	return r.db.Create(&members).Error
}

// GetMembers returns all members belonging to the given batch.
func (r *batchMemberRepository) GetMembers(batchID uuid.UUID) ([]domain.BatchMember, error) {
	var members []domain.BatchMember
	err := r.db.
		Where("batch_id = ?", batchID).
		Order("enrolled_at ASC").
		Find(&members).Error
	return members, err
}

// GetMember loads a single batch membership by composite primary key.
// Returns nil, nil when no record is found.
func (r *batchMemberRepository) GetMember(batchID, userID uuid.UUID) (*domain.BatchMember, error) {
	var member domain.BatchMember
	err := r.db.
		Where("batch_id = ? AND user_id = ?", batchID, userID).
		First(&member).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &member, nil
}

// GetBatchesByUserID returns all batch IDs that the given user belongs to.
func (r *batchMemberRepository) GetBatchesByUserID(userID uuid.UUID) ([]uuid.UUID, error) {
	var batchIDs []uuid.UUID
	err := r.db.
		Model(&domain.BatchMember{}).
		Where("user_id = ?", userID).
		Pluck("batch_id", &batchIDs).Error
	return batchIDs, err
}

// GetMembersByBatchID returns all user IDs belonging to the given batch.
func (r *batchMemberRepository) GetMembersByBatchID(batchID uuid.UUID) ([]uuid.UUID, error) {
	var userIDs []uuid.UUID
	err := r.db.
		Model(&domain.BatchMember{}).
		Where("batch_id = ?", batchID).
		Pluck("user_id", &userIDs).Error
	return userIDs, err
}

// RemoveMember hard-deletes the membership row identified by the composite key.
func (r *batchMemberRepository) RemoveMember(batchID, userID uuid.UUID) error {
	return r.db.
		Where("batch_id = ? AND user_id = ?", batchID, userID).
		Delete(&domain.BatchMember{}).Error
}
