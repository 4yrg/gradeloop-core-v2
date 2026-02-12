package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

type CourseRepository interface {
	CreateCourse(ctx context.Context, course *models.Course) (*models.Course, error)
	GetCourseByID(ctx context.Context, id uuid.UUID) (*models.Course, error)
	ListCourses(ctx context.Context) ([]models.Course, error)
}

type SemesterRepository interface {
	CreateSemester(ctx context.Context, semester *models.Semester) (*models.Semester, error)
	GetSemesterByID(ctx context.Context, id uuid.UUID) (*models.Semester, error)
	ListSemesters(ctx context.Context, includeInactive bool) ([]models.Semester, error)
}
