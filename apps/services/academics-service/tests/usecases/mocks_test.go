package usecases_test

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

// MockBatchRepository is a mock implementation of ports.BatchRepository
type MockBatchRepository struct {
	mock.Mock
}

func (m *MockBatchRepository) CreateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error) {
	args := m.Called(ctx, batch)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetBatchByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Batch, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetDirectChildren(ctx context.Context, parentID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	args := m.Called(ctx, parentID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetSubtree(ctx context.Context, rootID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	args := m.Called(ctx, rootID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Batch), args.Error(1)
}

func (m *MockBatchRepository) UpdateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error) {
	args := m.Called(ctx, batch)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Batch), args.Error(1)
}

func (m *MockBatchRepository) DeleteBatch(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockBatchRepository) HasCycle(ctx context.Context, batchID uuid.UUID, newParentID uuid.UUID) (bool, error) {
	args := m.Called(ctx, batchID, newParentID)
	return args.Bool(0), args.Error(1)
}

func (m *MockBatchRepository) GetAncestorChain(ctx context.Context, batchID uuid.UUID) ([]models.Batch, error) {
	args := m.Called(ctx, batchID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Batch), args.Error(1)
}

func (m *MockBatchRepository) GetAllDescendantIDs(ctx context.Context, rootID uuid.UUID) ([]uuid.UUID, error) {
	args := m.Called(ctx, rootID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

// MockDegreeRepository is a mock implementation of ports.DegreeRepository
type MockDegreeRepository struct {
	mock.Mock
}

func (m *MockDegreeRepository) CreateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error) {
	args := m.Called(ctx, degree)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) GetDegreeByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Degree, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) ListDegreesByDepartment(ctx context.Context, departmentID uuid.UUID, includeInactive bool) ([]models.Degree, error) {
	args := m.Called(ctx, departmentID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) UpdateDegree(ctx context.Context, degree *models.Degree) (*models.Degree, error) {
	args := m.Called(ctx, degree)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Degree), args.Error(1)
}

func (m *MockDegreeRepository) DeleteDegree(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockSpecializationRepository is a mock implementation of ports.SpecializationRepository
type MockSpecializationRepository struct {
	mock.Mock
}

func (m *MockSpecializationRepository) CreateSpecialization(ctx context.Context, spec *models.Specialization) (*models.Specialization, error) {
	args := m.Called(ctx, spec)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) GetSpecializationByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Specialization, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) ListSpecializationsByDegree(ctx context.Context, degreeID uuid.UUID, includeInactive bool) ([]models.Specialization, error) {
	args := m.Called(ctx, degreeID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) UpdateSpecialization(ctx context.Context, spec *models.Specialization) (*models.Specialization, error) {
	args := m.Called(ctx, spec)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Specialization), args.Error(1)
}

func (m *MockSpecializationRepository) DeleteSpecialization(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockDepartmentRepository is a mock implementation of ports.DepartmentRepository
type MockDepartmentRepository struct {
	mock.Mock
}

func (m *MockDepartmentRepository) CreateDepartment(ctx context.Context, dept *models.Department) (*models.Department, error) {
	args := m.Called(ctx, dept)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) GetDepartmentByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Department, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) ListDepartmentsByFaculty(ctx context.Context, facultyID uuid.UUID, includeInactive bool) ([]models.Department, error) {
	args := m.Called(ctx, facultyID, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) UpdateDepartment(ctx context.Context, dept *models.Department) (*models.Department, error) {
	args := m.Called(ctx, dept)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Department), args.Error(1)
}

func (m *MockDepartmentRepository) DeleteDepartment(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// MockFacultyRepository is a mock implementation of ports.FacultyRepository
type MockFacultyRepository struct {
	mock.Mock
}

func (m *MockFacultyRepository) CreateFaculty(ctx context.Context, faculty *models.Faculty, leaders []models.FacultyLeadership) (*models.Faculty, error) {
	args := m.Called(ctx, faculty, leaders)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) GetFacultyByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Faculty, error) {
	args := m.Called(ctx, id, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) ListFaculties(ctx context.Context, includeInactive bool) ([]models.Faculty, error) {
	args := m.Called(ctx, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) UpdateFaculty(ctx context.Context, faculty *models.Faculty) (*models.Faculty, error) {
	args := m.Called(ctx, faculty)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Faculty), args.Error(1)
}

func (m *MockFacultyRepository) DeleteFaculty(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockFacultyRepository) GetFacultyLeaders(ctx context.Context, facultyID uuid.UUID) ([]models.FacultyLeadership, error) {
	args := m.Called(ctx, facultyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.FacultyLeadership), args.Error(1)
}

// MockAuditRepository is a mock implementation of ports.AuditRepository
type MockAuditRepository struct {
	mock.Mock
}

func (m *MockAuditRepository) CreateAuditLog(ctx context.Context, log *models.AuditLog) error {
	args := m.Called(ctx, log)
	return args.Error(0)
}

// MockEnrollmentRepository is a mock implementation of ports.EnrollmentRepository
type MockEnrollmentRepository struct {
	mock.Mock
}

func (m *MockEnrollmentRepository) AddBatchMember(ctx context.Context, member *models.BatchMember) error {
	args := m.Called(ctx, member)
	return args.Error(0)
}

func (m *MockEnrollmentRepository) GetBatchMembers(ctx context.Context, batchID uuid.UUID) ([]models.BatchMember, error) {
	args := m.Called(ctx, batchID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.BatchMember), args.Error(1)
}

func (m *MockEnrollmentRepository) GetBatchMember(ctx context.Context, batchID, userID uuid.UUID) (*models.BatchMember, error) {
	args := m.Called(ctx, batchID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.BatchMember), args.Error(1)
}

func (m *MockEnrollmentRepository) UpdateBatchMember(ctx context.Context, member *models.BatchMember) error {
	args := m.Called(ctx, member)
	return args.Error(0)
}

func (m *MockEnrollmentRepository) CreateCourseInstance(ctx context.Context, instance *models.CourseInstance) (*models.CourseInstance, error) {
	args := m.Called(ctx, instance)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.CourseInstance), args.Error(1)
}

func (m *MockEnrollmentRepository) GetCourseInstanceByID(ctx context.Context, id uuid.UUID) (*models.CourseInstance, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.CourseInstance), args.Error(1)
}

func (m *MockEnrollmentRepository) UpdateCourseInstance(ctx context.Context, instance *models.CourseInstance) (*models.CourseInstance, error) {
	args := m.Called(ctx, instance)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.CourseInstance), args.Error(1)
}

func (m *MockEnrollmentRepository) ListCourseInstances(ctx context.Context, batchID *uuid.UUID, semesterID *uuid.UUID) ([]models.CourseInstance, error) {
	args := m.Called(ctx, batchID, semesterID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.CourseInstance), args.Error(1)
}

func (m *MockEnrollmentRepository) AssignInstructor(ctx context.Context, assignment *models.CourseInstructor) error {
	args := m.Called(ctx, assignment)
	return args.Error(0)
}

func (m *MockEnrollmentRepository) RemoveInstructor(ctx context.Context, courseInstanceID, userID uuid.UUID) error {
	args := m.Called(ctx, courseInstanceID, userID)
	return args.Error(0)
}

func (m *MockEnrollmentRepository) GetCourseInstructors(ctx context.Context, courseInstanceID uuid.UUID) ([]models.CourseInstructor, error) {
	args := m.Called(ctx, courseInstanceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.CourseInstructor), args.Error(1)
}

func (m *MockEnrollmentRepository) EnrollStudent(ctx context.Context, enrollment *models.CourseEnrollment) error {
	args := m.Called(ctx, enrollment)
	return args.Error(0)
}

func (m *MockEnrollmentRepository) UpdateEnrollment(ctx context.Context, enrollment *models.CourseEnrollment) error {
	args := m.Called(ctx, enrollment)
	return args.Error(0)
}

func (m *MockEnrollmentRepository) GetEnrollments(ctx context.Context, courseInstanceID uuid.UUID) ([]models.CourseEnrollment, error) {
	args := m.Called(ctx, courseInstanceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.CourseEnrollment), args.Error(1)
}

func (m *MockEnrollmentRepository) GetEnrollment(ctx context.Context, courseInstanceID, studentID uuid.UUID) (*models.CourseEnrollment, error) {
	args := m.Called(ctx, courseInstanceID, studentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.CourseEnrollment), args.Error(1)
}

// MockCourseRepository is a mock implementation of ports.CourseRepository
type MockCourseRepository struct {
	mock.Mock
}

func (m *MockCourseRepository) CreateCourse(ctx context.Context, course *models.Course) (*models.Course, error) {
	args := m.Called(ctx, course)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Course), args.Error(1)
}

func (m *MockCourseRepository) GetCourseByID(ctx context.Context, id uuid.UUID) (*models.Course, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Course), args.Error(1)
}

func (m *MockCourseRepository) ListCourses(ctx context.Context) ([]models.Course, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Course), args.Error(1)
}

// MockSemesterRepository is a mock implementation of ports.SemesterRepository
type MockSemesterRepository struct {
	mock.Mock
}

func (m *MockSemesterRepository) CreateSemester(ctx context.Context, semester *models.Semester) (*models.Semester, error) {
	args := m.Called(ctx, semester)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Semester), args.Error(1)
}

func (m *MockSemesterRepository) GetSemesterByID(ctx context.Context, id uuid.UUID) (*models.Semester, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Semester), args.Error(1)
}

func (m *MockSemesterRepository) ListSemesters(ctx context.Context, includeInactive bool) ([]models.Semester, error) {
	args := m.Called(ctx, includeInactive)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Semester), args.Error(1)
}
