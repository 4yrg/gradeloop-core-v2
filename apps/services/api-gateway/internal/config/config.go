package config

import (
	"os"

	"github.com/golang-jwt/jwt/v5"
	"gopkg.in/yaml.v3"
)

type AccessTokenClaims struct {
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

type RouteConfig struct {
	Path       string `yaml:"path"`
	Method     string `yaml:"method"`
	Permission string `yaml:"permission"`
	Service    string `yaml:"service"`
}

type Config struct {
	Routes    []RouteConfig     `yaml:"routes"`
	Upstream  map[string]string `yaml:"upstream"`
	JWTSecret string
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	cfg.JWTSecret = os.Getenv("JWT_SECRET")
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = "your-secret-key" // Default for dev, should be injected via env
	}

	return &cfg, nil
}
