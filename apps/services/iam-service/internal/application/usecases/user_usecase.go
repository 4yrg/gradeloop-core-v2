package usecases

import (
	"context"
	"errors"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/utils"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserUsecase struct {
	repo      ports.UserRepository
	auditRepo ports.AuditRepository
}

func NewUserUsecase(repo ports.UserRepository, auditRepo ports.AuditRepository) *UserUsecase {
	return &UserUsecase{repo: repo, auditRepo: auditRepo}
}

func (uc *UserUsecase) RegisterUser(user *models.User, student *models.Student, employee *models.Employee, password string) (*models.User, error) {
	if user.Email == "" || user.FullName == "" || user.UserType == "" {
		return nil, errors.New("missing required base user fields")
	}

	if len(password) < 8 {
		return nil, errors.New("password must be at least 8 characters long")
	}

	if user.UserType == models.UserTypeStudent && (student == nil || student.StudentRegNo == "") {
		return nil, errors.New("student registration number is required for students")
	}

	if user.UserType == models.UserTypeEmployee && (employee == nil || employee.EmployeeID == "") {
		return nil, errors.New("employee ID is required for employees")
	}

	// Validation: EnrollmentDate <= today
	if user.UserType == models.UserTypeStudent && student != nil {
		if student.EnrollmentDate.After(time.Now()) {
			return nil, errors.New("enrollment date cannot be in the future")
		}
	}

	// Password Hashing
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}
	user.PasswordHash = string(hash)

	if err := uc.repo.CreateUser(user, student, employee); err != nil {
		return nil, err
	}

	uc.logAudit(context.Background(), "create", "user", user.ID.String(), nil, user)

	return uc.repo.GetUser(user.ID, false)
}

func (uc *UserUsecase) GetUser(id uuid.UUID, includeDeleted bool) (*models.User, error) {
	return uc.repo.GetUser(id, includeDeleted)
}

func (uc *UserUsecase) ListUsers(page, limit int, includeDeleted bool) ([]models.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	return uc.repo.ListUsers(page, limit, includeDeleted)
}

func (uc *UserUsecase) UpdateUser(user *models.User, student *models.Student, employee *models.Employee) (*models.User, error) {
	oldUser, _ := uc.repo.GetUser(user.ID, false)
	if err := uc.repo.UpdateUser(user, student, employee); err != nil {
		return nil, err
	}
	uc.logAudit(context.Background(), "update", "user", user.ID.String(), oldUser, user)
	return uc.repo.GetUser(user.ID, false)
}

func (uc *UserUsecase) DeleteUser(id uuid.UUID) error {
	if err := uc.repo.DeleteUser(id); err != nil {
		return err
	}
	uc.logAudit(context.Background(), "delete", "user", id.String(), nil, nil)
	return nil
}

func (uc *UserUsecase) RestoreUser(id uuid.UUID) error {
	if err := uc.repo.RestoreUser(id); err != nil {
		return err
	}
	uc.logAudit(context.Background(), "restore", "user", id.String(), nil, nil)
	return nil
}

func (uc *UserUsecase) logAudit(ctx context.Context, action, entity, entityID string, oldValue, newValue interface{}) {
	auditLog := utils.PrepareAuditLog(ctx, action, entity, entityID, oldValue, newValue)
	_ = uc.auditRepo.CreateAuditLog(ctx, auditLog)
}
