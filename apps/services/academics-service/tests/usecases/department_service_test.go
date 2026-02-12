package usecases_test

import (
	"context"
	"errors"
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestDepartmentService_CreateDepartment(t *testing.T) {
	mockDeptRepo := new(MockDepartmentRepository)
	mockFacultyRepo := new(MockFacultyRepository)
	mockAuditRepo := new(MockAuditRepository)
	service := usecases.NewDepartmentService(mockDeptRepo, mockFacultyRepo, mockAuditRepo)

	facultyID := uuid.New()
	userID := uuid.New()
	userFacultyID := facultyID

	req := dto.CreateDepartmentRequest{
		Name: "Dept. of AI",
		Code: "DAI",
	}

	t.Run("Success - Super Admin", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(&models.Faculty{ID: facultyID, IsActive: true}, nil).Once()
		mockDeptRepo.On("CreateDepartment", ctx, mock.AnythingOfType("*models.Department")).Return(&models.Department{ID: uuid.New()}, nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.NoError(t, err)
		mockFacultyRepo.AssertExpectations(t)
		mockDeptRepo.AssertExpectations(t)
		mockAuditRepo.AssertExpectations(t)
	})

	t.Run("Success - Faculty Admin", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"faculty_admin"})
		ctx = context.WithValue(ctx, "faculty_id", userFacultyID.String())

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(&models.Faculty{ID: facultyID, IsActive: true}, nil).Once()
		mockDeptRepo.On("CreateDepartment", ctx, mock.AnythingOfType("*models.Department")).Return(&models.Department{ID: uuid.New()}, nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.AnythingOfType("*models.AuditLog")).Return(nil).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.NoError(t, err)
		mockFacultyRepo.AssertExpectations(t)
		mockDeptRepo.AssertExpectations(t)
		mockAuditRepo.AssertExpectations(t)
	})

	t.Run("Fail - Unauthorized", func(t *testing.T) {
		otherFacultyID := uuid.New()
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"faculty_admin"})
		ctx = context.WithValue(ctx, "faculty_id", otherFacultyID.String()) // Belongs to another faculty

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(&models.Faculty{ID: facultyID, IsActive: true}, nil).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Forbidden")
		mockFacultyRepo.AssertExpectations(t)
	})

	t.Run("Fail - Inactive Faculty", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

		mockFacultyRepo.On("GetFacultyByID", ctx, facultyID, false).Return(nil, errors.New("not found")).Once()

		_, err := service.CreateDepartment(ctx, facultyID, req)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Active faculty not found")
		mockFacultyRepo.AssertExpectations(t)
	})
}

func TestDepartmentService_GetDepartment(t *testing.T) {
	mockDeptRepo := new(MockDepartmentRepository)
	mockFacultyRepo := new(MockFacultyRepository)
	mockAuditRepo := new(MockAuditRepository)
	service := usecases.NewDepartmentService(mockDeptRepo, mockFacultyRepo, mockAuditRepo)

	id := uuid.New()
	dept := &models.Department{ID: id, Name: "AI"}

	t.Run("Success", func(t *testing.T) {
		mockDeptRepo.On("GetDepartmentByID", mock.Anything, id, false).Return(dept, nil).Once()
		res, err := service.GetDepartment(context.Background(), id, false)
		assert.NoError(t, err)
		assert.Equal(t, dept, res)
	})

	t.Run("NotFound", func(t *testing.T) {
		mockDeptRepo.On("GetDepartmentByID", mock.Anything, id, false).Return(nil, errors.New("not found")).Once()
		_, err := service.GetDepartment(context.Background(), id, false)
		assert.Error(t, err)
	})
}

func TestDepartmentService_ListDepartmentsByFaculty(t *testing.T) {
	mockDeptRepo := new(MockDepartmentRepository)
	mockFacultyRepo := new(MockFacultyRepository)
	mockAuditRepo := new(MockAuditRepository)
	service := usecases.NewDepartmentService(mockDeptRepo, mockFacultyRepo, mockAuditRepo)

	facultyID := uuid.New()
	depts := []models.Department{{ID: uuid.New(), Name: "AI"}}

	t.Run("Success", func(t *testing.T) {
		mockFacultyRepo.On("GetFacultyByID", mock.Anything, facultyID, true).Return(&models.Faculty{ID: facultyID}, nil).Once()
		mockDeptRepo.On("ListDepartmentsByFaculty", mock.Anything, facultyID, false).Return(depts, nil).Once()

		res, err := service.ListDepartmentsByFaculty(context.Background(), facultyID, false)
		assert.NoError(t, err)
		assert.Equal(t, depts, res)
	})

	t.Run("FacultyNotFound", func(t *testing.T) {
		mockFacultyRepo.On("GetFacultyByID", mock.Anything, facultyID, true).Return(nil, errors.New("not found")).Once()
		_, err := service.ListDepartmentsByFaculty(context.Background(), facultyID, false)
		assert.Error(t, err)
	})
}

func TestDepartmentService_UpdateDepartment(t *testing.T) {
	mockDeptRepo := new(MockDepartmentRepository)
	mockFacultyRepo := new(MockFacultyRepository)
	mockAuditRepo := new(MockAuditRepository)
	service := usecases.NewDepartmentService(mockDeptRepo, mockFacultyRepo, mockAuditRepo)

	id := uuid.New()
	facultyID := uuid.New()
	userID := uuid.New()
	oldDept := &models.Department{ID: id, FacultyID: facultyID, Name: "Old"}
	newName := "New"
	req := dto.UpdateDepartmentRequest{Name: &newName}

	t.Run("Success - Super Admin", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

		mockDeptRepo.On("GetDepartmentByID", ctx, id, true).Return(oldDept, nil).Once()
		mockDeptRepo.On("UpdateDepartment", ctx, mock.AnythingOfType("*models.Department")).Return(&models.Department{ID: id, Name: newName}, nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil).Once()

		res, err := service.UpdateDepartment(ctx, id, req)
		assert.NoError(t, err)
		assert.Equal(t, newName, res.Name)
	})

	t.Run("Fail - Unauthorized", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"faculty_admin"})
		otherFacultyID := uuid.New()
		ctx = context.WithValue(ctx, "faculty_id", otherFacultyID.String())

		mockDeptRepo.On("GetDepartmentByID", ctx, id, true).Return(oldDept, nil).Once()

		_, err := service.UpdateDepartment(ctx, id, req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Forbidden")
	})
}

func TestDepartmentService_DeleteDepartment(t *testing.T) {
	mockDeptRepo := new(MockDepartmentRepository)
	mockFacultyRepo := new(MockFacultyRepository)
	mockAuditRepo := new(MockAuditRepository)
	service := usecases.NewDepartmentService(mockDeptRepo, mockFacultyRepo, mockAuditRepo)

	id := uuid.New()
	facultyID := uuid.New()
	userID := uuid.New()
	dept := &models.Department{ID: id, FacultyID: facultyID}

	t.Run("Success - Super Admin", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"super_admin"})

		mockDeptRepo.On("GetDepartmentByID", ctx, id, true).Return(dept, nil).Once()
		mockDeptRepo.On("DeleteDepartment", ctx, id).Return(nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil).Once()

		err := service.DeleteDepartment(ctx, id)
		assert.NoError(t, err)
	})

	t.Run("Fail - Unauthorized", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), "user_id", userID.String())
		ctx = context.WithValue(ctx, "roles", []string{"faculty_admin"})
		otherFacultyID := uuid.New()
		ctx = context.WithValue(ctx, "faculty_id", otherFacultyID.String())

		mockDeptRepo.On("GetDepartmentByID", ctx, id, true).Return(dept, nil).Once()

		err := service.DeleteDepartment(ctx, id)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Forbidden")
	})
}
