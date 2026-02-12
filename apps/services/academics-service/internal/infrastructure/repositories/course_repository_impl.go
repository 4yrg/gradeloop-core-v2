package repositories

import (
	"context"
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CourseRepositoryImpl struct {
	db *gorm.DB
}

func NewCourseRepository(db *gorm.DB) ports.CourseRepository {
	return &CourseRepositoryImpl{db: db}
}

func (r *CourseRepositoryImpl) CreateCourse(ctx context.Context, course *models.Course) (*models.Course, error) {
	if err := r.db.WithContext(ctx).Create(course).Error; err != nil {
		return nil, fmt.Errorf("failed to create course: %w", err)
	}
	return course, nil
}

func (r *CourseRepositoryImpl) GetCourseByID(ctx context.Context, id uuid.UUID) (*models.Course, error) {
	var course models.Course
	if err := r.db.WithContext(ctx).First(&course, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("failed to get course: %w", err)
	}
	return &course, nil
}

func (r *CourseRepositoryImpl) ListCourses(ctx context.Context) ([]models.Course, error) {
	var courses []models.Course
	if err := r.db.WithContext(ctx).Find(&courses).Error; err != nil {
		return nil, fmt.Errorf("failed to list courses: %w", err)
	}
	return courses, nil
}

type SemesterRepositoryImpl struct {
	db *gorm.DB
}

func NewSemesterRepository(db *gorm.DB) ports.SemesterRepository {
	return &SemesterRepositoryImpl{db: db}
}

func (r *SemesterRepositoryImpl) CreateSemester(ctx context.Context, semester *models.Semester) (*models.Semester, error) {
	if err := r.db.WithContext(ctx).Create(semester).Error; err != nil {
		return nil, fmt.Errorf("failed to create semester: %w", err)
	}
	return semester, nil
}

func (r *SemesterRepositoryImpl) GetSemesterByID(ctx context.Context, id uuid.UUID) (*models.Semester, error) {
	var semester models.Semester
	if err := r.db.WithContext(ctx).First(&semester, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("failed to get semester: %w", err)
	}
	return &semester, nil
}

func (r *SemesterRepositoryImpl) ListSemesters(ctx context.Context, includeInactive bool) ([]models.Semester, error) {
	var semesters []models.Semester
	query := r.db.WithContext(ctx)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}
	if err := query.Find(&semesters).Error; err != nil {
		return nil, fmt.Errorf("failed to list semesters: %w", err)
	}
	return semesters, nil
}
