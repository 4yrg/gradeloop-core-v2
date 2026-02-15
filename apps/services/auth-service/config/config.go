package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// Config func to get env value
func Config(key string) string {
	// Try to load .env from current directory first.
	if err := godotenv.Load(".env"); err == nil {
		return os.Getenv(key)
	}

	// If not found, walk up parent directories looking for a .env file.
	cwd, err := os.Getwd()
	if err != nil {
		// If we can't determine the working directory, fall back to attempting a default load.
		if err := godotenv.Load(); err != nil {
			fmt.Print("Error loading .env file and unable to determine working directory")
		}
		return os.Getenv(key)
	}

	dir := cwd
	for {
		envPath := filepath.Join(dir, ".env")
		if _, statErr := os.Stat(envPath); statErr == nil {
			// Found a .env in this parent directory — attempt to load it.
			if loadErr := godotenv.Load(envPath); loadErr != nil {
				fmt.Printf("Error loading .env file at %s: %v", envPath, loadErr)
			}
			return os.Getenv(key)
		}

		parent := filepath.Dir(dir)
		// Reached filesystem root (parent == dir) — stop searching.
		if parent == dir {
			break
		}
		dir = parent
	}

	// No .env file found in current or parent directories. Try a default load (will look in current dir).
	if err := godotenv.Load(); err != nil {
		fmt.Print("No .env file found in current or parent directories")
	}
	return os.Getenv(key)
}
