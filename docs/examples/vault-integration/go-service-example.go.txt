// Example: Integrating Vault secrets into a Go service
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gradeloop/gradeloop-core-v2/shared/libs/go/secrets"
	_ "github.com/lib/pq"
)

// App holds application dependencies
type App struct {
	DB            *sql.DB
	SecretsClient secrets.Client
	JWTSecret     string
}

func main() {
	ctx := context.Background()

	// Initialize secrets client
	log.Println("Initializing secrets client...")
	secretsClient, err := secrets.NewClient(nil)
	if err != nil {
		log.Fatalf("Failed to initialize secrets client: %v", err)
	}
	defer secretsClient.Close()

	// Get database configuration from Vault
	log.Println("Retrieving database configuration from Vault...")
	dbConfig, err := secretsClient.GetDatabaseConfig(ctx)
	if err != nil {
		log.Fatalf("Failed to get database config: %v", err)
	}

	// Connect to database
	log.Println("Connecting to database...")
	db, err := sql.Open("postgres", dbConfig.ConnectionString())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("✅ Database connection established")

	// Get JWT configuration
	log.Println("Retrieving JWT configuration from Vault...")
	jwtConfig, err := secretsClient.GetJWTConfig(ctx)
	if err != nil {
		log.Fatalf("Failed to get JWT config: %v", err)
	}
	log.Printf("✅ JWT configuration loaded (algorithm: %s)", jwtConfig.Algorithm)

	// Get service-specific configuration
	log.Println("Retrieving service configuration from Vault...")
	serviceName := getEnv("SERVICE_NAME", "assignment")
	serviceConfig, err := secretsClient.GetSecretMap(ctx, fmt.Sprintf("services/%s", serviceName))
	if err != nil {
		log.Printf("Warning: Failed to get service config: %v", err)
	} else {
		log.Printf("✅ Service configuration loaded: %+v", serviceConfig)
	}

	// Initialize application
	app := &App{
		DB:            db,
		SecretsClient: secretsClient,
		JWTSecret:     jwtConfig.Secret,
	}

	// Start HTTP server
	port := getEnv("PORT", "8080")
	log.Printf("Starting server on port %s...", port)

	http.HandleFunc("/health", app.healthHandler)
	http.HandleFunc("/api/assignments", app.assignmentsHandler)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func (app *App) healthHandler(w http.ResponseWriter, r *http.Request) {
	// Check database connection
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := app.DB.PingContext(ctx); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		fmt.Fprintf(w, `{"status":"unhealthy","error":"%s"}`, err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"status":"healthy"}`)
}

func (app *App) assignmentsHandler(w http.ResponseWriter, r *http.Request) {
	// Example: Query database
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := app.DB.QueryContext(ctx, "SELECT id, title FROM assignments LIMIT 10")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, `{"error":"%s"}`, err.Error())
		return
	}
	defer rows.Close()

	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"assignments":[]}`)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
