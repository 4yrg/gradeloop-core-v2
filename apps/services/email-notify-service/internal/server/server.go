package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"email-notify-service/internal/core/domain"
	httphandler "email-notify-service/internal/handlers/http"

	"github.com/gin-gonic/gin"
)

type Server struct {
	router     *gin.Engine
	httpServer *http.Server
	config     *domain.Config
}

func NewServer(config *domain.Config, emailHandler *httphandler.EmailHandler) *Server {
	// Set Gin mode based on environment
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()

	// Add middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())
	router.Use(requestIDMiddleware())

	// Setup routes
	setupRoutes(router, emailHandler)

	// Create HTTP server
	addr := fmt.Sprintf("%s:%d", config.Server.Host, config.Server.Port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	return &Server{
		router:     router,
		httpServer: httpServer,
		config:     config,
	}
}

func setupRoutes(router *gin.Engine, emailHandler *httphandler.EmailHandler) {
	// Health check endpoint
	router.GET("/health", emailHandler.HealthCheck)
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "email-notify-service",
			"version": "1.0.0",
			"status":  "running",
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		email := v1.Group("/email")
		{
			email.POST("/send", emailHandler.SendEmail)
			email.POST("/test-template", emailHandler.TestTemplate)
		}
	}
}

func (s *Server) Start() error {
	log.Printf("[Server] Starting HTTP server on %s", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	log.Printf("[Server] Shutting down HTTP server...")
	return s.httpServer.Shutdown(ctx)
}

// Middleware functions

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			// Generate a simple request ID (in production, use a proper UUID)
			requestID = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		c.Header("X-Request-ID", requestID)
		c.Set("request_id", requestID)
		c.Next()
	}
}
