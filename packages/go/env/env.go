package env

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// Load finds the project root and loads the appropriate .env file.
// It searches for .env.production or .env.development based on APP_ENV.
// It falls back to .env if APP_ENV is not set.
func Load() {
	root, err := FindRoot()
	if err != nil {
		log.Printf("Warning: Could not find project root: %v", err)
		return
	}

	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}

	// Try loading .env.production or .env.development
	envFile := filepath.Join(root, ".env."+appEnv)
	if err := godotenv.Load(envFile); err != nil {
		log.Printf("Info: Could not load %s, falling back to default .env", envFile)
		_ = godotenv.Load(filepath.Join(root, ".env"))
	}
}

// FindRoot searches upwards for a marker file (e.g., turbo.json or .git) to find the project root.
func FindRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		// Marker files for the project root
		markers := []string{"turbo.json", "package.json", ".git"}
		for _, marker := range markers {
			if _, err := os.Stat(filepath.Join(dir, marker)); err == nil {
				return dir, nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", os.ErrNotExist
}
