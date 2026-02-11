package repositories

import (
	"context"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GormFacultyRepository struct {
	db *gorm.DB
}

func NewGormFacultyRepository(db *gorm.DB) ports.FacultyRepository {
	return &GormFacultyRepository{db: db}
}

// CreateFaculty creates a new faculty and its leadership in a single transaction.
func (r *GormFacultyRepository) CreateFaculty(ctx context.Context, faculty *models.Faculty, leaders []models.FacultyLeadership) (*models.Faculty, error) {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create the faculty record
		if err := tx.Create(faculty).Error; err != nil {
			return err
		}

		// Create the leadership records
		if len(leaders) > 0 {
			for i := range leaders {
				leaders[i].FacultyID = faculty.ID
			}
			if err := tx.Create(&leaders).Error; err != nil {
				return err
			}
		} else {
			// This case should be prevented by the service layer, but as a safeguard:
			return errors.New("a faculty must have at least one leader")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Reload the faculty with its leaders to return the full object
	return r.GetFacultyByID(ctx, faculty.ID, false)
}

// GetFacultyByID retrieves a single faculty by its ID.
func (r *GormFacultyRepository) GetFacultyByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Faculty, error) {
	var faculty models.Faculty
	query := r.db.WithContext(ctx)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Preload("Leaders").First(&faculty, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &faculty, nil
}

// ListFaculties retrieves a list of all faculties.
func (r *GormFacultyRepository) ListFaculties(ctx context.Context, includeInactive bool) ([]models.Faculty, error) {
	var faculties []models.Faculty
	query := r.db.WithContext(ctx)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Preload("Leaders").Find(&faculties).Error
	return faculties, err
}

// UpdateFaculty updates an existing faculty's metadata.
func (r *GormFacultyRepository) UpdateFaculty(ctx context.Context, faculty *models.Faculty) (*models.Faculty, error) {
	// We only want to update specific fields, not overwrite the whole record.
	// Omit associations and key fields from the update.
	err := r.db.WithContext(ctx).Model(faculty).Omit("ID", "CreatedAt", "Leaders", "DeletedAt").Updates(faculty).Error
	if err != nil {
		return nil, err
	}
	return r.GetFacultyByID(ctx, faculty.ID, true)
}

// DeleteFaculty soft-deletes a faculty by setting `is_active` to false.
func (r *GormFacultyRepository) DeleteFaculty(ctx context.Context, id uuid.UUID) error {
	err := r.db.WithContext(ctx).Model(&models.Faculty{}).Where("id = ?", id).Update("is_active", false).Error
	return err
}

// GetFacultyLeaders retrieves the leadership panel for a specific faculty.
func (r *GormFacultyRepository) GetFacultyLeaders(ctx context.Context, facultyID uuid.UUID) ([]models.FacultyLeadership, error) {
	var leaders []models.FacultyLeadership
	err := r.db.WithContext(ctx).Where("faculty_id = ?", facultyID).Find(&leaders).Error
	return leaders, err
}
