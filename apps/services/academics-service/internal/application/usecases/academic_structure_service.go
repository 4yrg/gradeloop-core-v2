package usecases

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
)

type AcademicStructureService struct {
	courseRepo   ports.CourseRepository
	semesterRepo ports.SemesterRepository
	auditRepo    ports.AuditRepository
}

func NewAcademicStructureService(
	courseRepo ports.CourseRepository,
	semesterRepo ports.SemesterRepository,
	auditRepo ports.AuditRepository,
) *AcademicStructureService {
	return &AcademicStructureService{
		courseRepo:   courseRepo,
		semesterRepo: semesterRepo,
		auditRepo:    auditRepo,
	}
}

func (s *AcademicStructureService) CreateCourse(ctx context.Context, req dto.CreateCourseRequest) (*models.Course, error) {
	course := &models.Course{
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
		Credits:     req.Credits,
	}
	created, err := s.courseRepo.CreateCourse(ctx, course)
	if err != nil {
		return nil, err
	}
	auditLog := utils.PrepareAuditLog(ctx, "course.create", "course", created.ID.String(), nil, created)
	s.auditRepo.CreateAuditLog(ctx, auditLog)
	return created, nil
}

func (s *AcademicStructureService) ListCourses(ctx context.Context) ([]models.Course, error) {
	return s.courseRepo.ListCourses(ctx)
}

func (s *AcademicStructureService) CreateSemester(ctx context.Context, req dto.CreateSemesterRequest) (*models.Semester, error) {
	semester := &models.Semester{
		Name:      req.Name,
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
		IsActive:  true,
	}
	created, err := s.semesterRepo.CreateSemester(ctx, semester)
	if err != nil {
		return nil, err
	}
	auditLog := utils.PrepareAuditLog(ctx, "semester.create", "semester", created.ID.String(), nil, created)
	s.auditRepo.CreateAuditLog(ctx, auditLog)
	return created, nil
}

func (s *AcademicStructureService) ListSemesters(ctx context.Context, includeInactive bool) ([]models.Semester, error) {
	return s.semesterRepo.ListSemesters(ctx, includeInactive)
}
