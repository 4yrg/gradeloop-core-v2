package integration_test

import (
	"context"
	"testing"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestIntegration_UserFlow(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()

	// Start Postgres Container
	bgUser := "testuser"
	bgPassword := "testpassword"
	bgDbName := "testdb"

	pgContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("postgres:15-alpine"),
		postgres.WithDatabase(bgDbName),
		postgres.WithUsername(bgUser),
		postgres.WithPassword(bgPassword),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).WithStartupTimeout(5*time.Second),
		),
	)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := pgContainer.Terminate(ctx); err != nil {
			t.Fatalf("failed to terminate container: %s", err)
		}
	})

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err)

	// Connect GORM
	db, err := gorm.Open(gormpg.Open(connStr), &gorm.Config{})
	require.NoError(t, err)

	// Migrations
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Role{},
		&domain.Permission{},
		&domain.AuditLog{},
		&domain.PasswordResetToken{},
		&domain.RefreshToken{},
	)
	require.NoError(t, err)

	// Setup Services
	userRepo := repository.NewUserRepository(db)
	roleRepo := repository.NewRoleRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	tokenRepo := repository.NewRefreshTokenRepository(db)
	passwdRepo := repository.NewPasswordResetRepository(db)

	userService := service.NewUserService(userRepo, roleRepo, auditRepo)
	authService := service.NewAuthService(userRepo, tokenRepo, passwdRepo, auditRepo)

	// Test 1: Create User
	t.Run("CreateUser", func(t *testing.T) {
		req := dto.CreateUserRequest{
			Email:        "integration@example.com",
			FullName:     "Integration User",
			UserType:     "EMPLOYEE",
			EmployeeID:   &[]string{"INT001"}[0],
			Designation:  &[]string{"Tester"}[0],
			EmployeeType: &[]string{"Bot"}[0],
		}

		user, tempPass, err := userService.CreateUser(ctx, req)
		require.NoError(t, err)
		assert.NotEmpty(t, user.ID)
		assert.NotEmpty(t, tempPass)

		// Test 2: Login with temp pass
		t.Run("Login", func(t *testing.T) {
			loginReq := dto.LoginRequest{
				Email:    "integration@example.com",
				Password: tempPass,
			}

			res, err := authService.Login(ctx, loginReq, "127.0.0.1", "test-agent")
			require.NoError(t, err)
			assert.NotEmpty(t, res.AccessToken)
			assert.NotEmpty(t, res.RefreshToken)

			// Test 3: Request Password Reset
			t.Run("RequestReset", func(t *testing.T) {
				token, err := authService.RequestPasswordReset(ctx, "integration@example.com")
				require.NoError(t, err)
				assert.NotEmpty(t, token)
			})
		})
	})
}
