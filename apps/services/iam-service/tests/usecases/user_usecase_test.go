package usecases_test

import (
	"testing"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestRegisterUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	mockAudit := new(MockAuditRepository)
	uc := usecases.NewUserUsecase(mockRepo, mockAudit)

	t.Run("successful student registration", func(t *testing.T) {
		user := &models.User{
			ID:       uuid.New(),
			Email:    "test@student.com",
			FullName: "Test Student",
			UserType: models.UserTypeStudent,
		}
		student := &models.Student{
			StudentRegNo:   "STU001",
			EnrollmentDate: time.Now().AddDate(0, 0, -1),
		}

		mockRepo.On("CreateUser", mock.Anything, student, (*models.Employee)(nil)).Return(nil).Once()
		mockAudit.On("CreateAuditLog", mock.Anything, mock.Anything).Return(nil).Once()
		mockRepo.On("GetUser", mock.Anything, false).Return(user, nil).Once()

		result, err := uc.RegisterUser(user, student, nil, "password123")
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.NotEmpty(t, user.PasswordHash)
		mockRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)
	})

	t.Run("fail registration with short password", func(t *testing.T) {
		user := &models.User{
			Email:    "test@student.com",
			FullName: "Test Student",
			UserType: models.UserTypeStudent,
		}
		_, err := uc.RegisterUser(user, nil, nil, "short")
		assert.Error(t, err)
		assert.Equal(t, "password must be at least 8 characters long", err.Error())
	})

	t.Run("fail registration with missing fields", func(t *testing.T) {
		user := &models.User{
			Email: "",
		}
		_, err := uc.RegisterUser(user, nil, nil, "password123")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "missing required base user fields")
	})

	t.Run("fail student registration without reg no", func(t *testing.T) {
		user := &models.User{
			Email:    "test@student.com",
			FullName: "Test Student",
			UserType: models.UserTypeStudent,
		}
		student := &models.Student{}
		_, err := uc.RegisterUser(user, student, nil, "password123")
		assert.Error(t, err)
		assert.Equal(t, "student registration number is required for students", err.Error())
	})

	t.Run("fail registration with future enrollment date", func(t *testing.T) {
		user := &models.User{
			Email:    "test@student.com",
			FullName: "Test Student",
			UserType: models.UserTypeStudent,
		}
		student := &models.Student{
			StudentRegNo:   "STU001",
			EnrollmentDate: time.Now().AddDate(0, 0, 1),
		}

		_, err := uc.RegisterUser(user, student, nil, "password123")
		assert.Error(t, err)
		assert.Equal(t, "enrollment date cannot be in the future", err.Error())
	})
}

func TestGetUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	mockAudit := new(MockAuditRepository)
	uc := usecases.NewUserUsecase(mockRepo, mockAudit)
	id := uuid.New()

	t.Run("successful fetch", func(t *testing.T) {
		expectedUser := &models.User{ID: id, Email: "test@test.com"}
		mockRepo.On("GetUser", id, false).Return(expectedUser, nil).Once()

		user, err := uc.GetUser(id, false)
		assert.NoError(t, err)
		assert.Equal(t, expectedUser, user)
		mockRepo.AssertExpectations(t)
	})
}

func TestListUsers(t *testing.T) {
	mockRepo := new(MockUserRepository)
	mockAudit := new(MockAuditRepository)
	uc := usecases.NewUserUsecase(mockRepo, mockAudit)

	t.Run("pagination defaults", func(t *testing.T) {
		users := []models.User{{Email: "1@test.com"}, {Email: "2@test.com"}}
		mockRepo.On("ListUsers", 1, 10, false).Return(users, 2, nil).Once()

		result, total, err := uc.ListUsers(0, 0, false)
		assert.NoError(t, err)
		assert.Equal(t, int64(2), total)
		assert.Len(t, result, 2)
		mockRepo.AssertExpectations(t)
	})
}

func TestUpdateUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	mockAudit := new(MockAuditRepository)
	uc := usecases.NewUserUsecase(mockRepo, mockAudit)
	id := uuid.New()
	user := &models.User{ID: id}

	t.Run("successful update", func(t *testing.T) {
		mockRepo.On("UpdateUser", user, (*models.Student)(nil), (*models.Employee)(nil)).Return(nil).Once()
		mockAudit.On("CreateAuditLog", mock.Anything, mock.Anything).Return(nil).Once()
		mockRepo.On("GetUser", id, false).Return(user, nil).Once()

		result, err := uc.UpdateUser(user, nil, nil)
		assert.NoError(t, err)
		assert.NotNil(t, result)
		mockRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)
	})
}

func TestDeleteUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	mockAudit := new(MockAuditRepository)
	uc := usecases.NewUserUsecase(mockRepo, mockAudit)
	id := uuid.New()

	t.Run("successful delete", func(t *testing.T) {
		mockRepo.On("DeleteUser", id).Return(nil).Once()
		mockAudit.On("CreateAuditLog", mock.Anything, mock.Anything).Return(nil).Once()
		err := uc.DeleteUser(id)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockAudit.AssertExpectations(t)
	})
}
