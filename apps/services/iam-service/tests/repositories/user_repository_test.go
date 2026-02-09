package repositories_test

import (
	"testing"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Student{},
		&models.Employee{},
		&models.Role{},
		&models.Permission{},
		&models.AuditLog{},
	)
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	return db
}

func TestUserRepository_CreateUser(t *testing.T) {
	db := setupTestDB(t)
	repo := repositories.NewUserRepository(db)

	t.Run("Create Student", func(t *testing.T) {
		user := &models.User{
			Email:    "student@test.com",
			FullName: "Student User",
			UserType: models.UserTypeStudent,
		}
		student := &models.Student{
			StudentRegNo:   "S123",
			EnrollmentDate: time.Now(),
		}

		err := repo.CreateUser(user, student, nil)
		assert.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, user.ID)
		assert.Equal(t, user.ID, student.ID)

		var savedStudent models.Student
		err = db.First(&savedStudent, "id = ?", user.ID).Error
		assert.NoError(t, err)
		assert.Equal(t, "S123", savedStudent.StudentRegNo)
	})

	t.Run("Create Employee", func(t *testing.T) {
		user := &models.User{
			Email:    "employee@test.com",
			FullName: "Employee User",
			UserType: models.UserTypeEmployee,
		}
		employee := &models.Employee{
			EmployeeID:   "E123",
			Designation:  "Manager",
			EmployeeType: "Full-time",
		}

		err := repo.CreateUser(user, nil, employee)
		assert.NoError(t, err)

		var savedEmployee models.Employee
		err = db.First(&savedEmployee, "id = ?", user.ID).Error
		assert.NoError(t, err)
		assert.Equal(t, "E123", savedEmployee.EmployeeID)
	})
}

func TestUserRepository_GetUser(t *testing.T) {
	db := setupTestDB(t)
	repo := repositories.NewUserRepository(db)

	user := &models.User{Email: "get@test.com", UserType: models.UserTypeStudent, FullName: "Get User"}
	student := &models.Student{StudentRegNo: "GET123"}
	repo.CreateUser(user, student, nil)

	t.Run("Get Existing User", func(t *testing.T) {
		fetched, err := repo.GetUser(user.ID, false)
		assert.NoError(t, err)
		assert.NotNil(t, fetched.Student)
		assert.Equal(t, "GET123", fetched.Student.StudentRegNo)
	})

	t.Run("Get Non-existent User", func(t *testing.T) {
		_, err := repo.GetUser(uuid.New(), false)
		assert.Error(t, err)
		assert.Equal(t, gorm.ErrRecordNotFound, err)
	})
}

func TestUserRepository_UpdateUser(t *testing.T) {
	db := setupTestDB(t)
	repo := repositories.NewUserRepository(db)

	user := &models.User{Email: "upd@test.com", UserType: models.UserTypeStudent, FullName: "Original"}
	student := &models.Student{StudentRegNo: "S_OLD"}
	repo.CreateUser(user, student, nil)

	t.Run("Update Base and Subtype", func(t *testing.T) {
		user.FullName = "Updated"
		student.StudentRegNo = "S_NEW"

		err := repo.UpdateUser(user, student, nil)
		assert.NoError(t, err)

		fetched, _ := repo.GetUser(user.ID, false)
		assert.Equal(t, "Updated", fetched.FullName)
		assert.Equal(t, "S_NEW", fetched.Student.StudentRegNo)
	})

	t.Run("Prevent Type Change", func(t *testing.T) {
		user.UserType = models.UserTypeEmployee
		err := repo.UpdateUser(user, nil, nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "changing user type is not allowed")
	})
}

func TestUserRepository_DeleteUser(t *testing.T) {
	db := setupTestDB(t)
	repo := repositories.NewUserRepository(db)

	user := &models.User{Email: "del@test.com", UserType: models.UserTypeStudent, FullName: "Del User"}
	repo.CreateUser(user, &models.Student{StudentRegNo: "DEL123"}, nil)

	t.Run("Soft Delete", func(t *testing.T) {
		err := repo.DeleteUser(user.ID)
		assert.NoError(t, err)

		_, err = repo.GetUser(user.ID, false)
		assert.Error(t, err) // Should be not found by default

		fetched, err := repo.GetUser(user.ID, true)
		assert.NoError(t, err)
		assert.NotNil(t, fetched)
	})
}
