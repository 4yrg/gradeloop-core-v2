package repositories

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"email-notify-service/internal/core/domain"
	"email-notify-service/internal/core/ports"

	vault "github.com/hashicorp/vault/api"
)

type VaultRepository struct {
	client     *vault.Client
	mountPath  string
	smtpSecret string
}

// Ensure VaultRepository implements the SecretsRepository port
var _ ports.SecretsRepository = (*VaultRepository)(nil)

func NewVaultRepository(address, token, namespace, mountPath, smtpSecretPath string) (*VaultRepository, error) {
	// Create Vault client config
	config := vault.DefaultConfig()
	config.Address = address
	config.Timeout = 10 * time.Second

	client, err := vault.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create vault client: %w", err)
	}

	// Set token and namespace
	client.SetToken(token)
	if namespace != "" {
		client.SetNamespace(namespace)
	}

	return &VaultRepository{
		client:     client,
		mountPath:  mountPath,
		smtpSecret: smtpSecretPath,
	}, nil
}

func (r *VaultRepository) GetSMTPConfig(ctx context.Context) (*domain.SMTPConfig, error) {
	secret, err := r.client.Logical().ReadWithContext(ctx, r.smtpSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to read SMTP secret from vault: %w", err)
	}

	if secret == nil || secret.Data == nil {
		return nil, fmt.Errorf("SMTP secret not found in vault at path: %s", r.smtpSecret)
	}

	// Handle KV v2 format (data wrapped in "data" field)
	data := secret.Data
	if secretData, ok := data["data"].(map[string]interface{}); ok {
		data = secretData
	}

	config := &domain.SMTPConfig{}

	// Extract SMTP configuration
	if host, ok := data["host"].(string); ok {
		config.Host = host
	} else {
		return nil, fmt.Errorf("SMTP host not found or invalid type")
	}

	if portStr, ok := data["port"].(string); ok {
		port, err := strconv.Atoi(portStr)
		if err != nil {
			return nil, fmt.Errorf("invalid SMTP port: %w", err)
		}
		config.Port = port
	} else if portFloat, ok := data["port"].(float64); ok {
		config.Port = int(portFloat)
	} else {
		return nil, fmt.Errorf("SMTP port not found or invalid type")
	}

	if username, ok := data["username"].(string); ok {
		config.Username = username
	} else {
		return nil, fmt.Errorf("SMTP username not found or invalid type")
	}

	if password, ok := data["password"].(string); ok {
		config.Password = password
	} else {
		return nil, fmt.Errorf("SMTP password not found or invalid type")
	}

	// UseTLS defaults to true for security
	config.UseTLS = true
	if useTLSStr, ok := data["use_tls"].(string); ok {
		useTLS, err := strconv.ParseBool(useTLSStr)
		if err == nil {
			config.UseTLS = useTLS
		}
	} else if useTLSBool, ok := data["use_tls"].(bool); ok {
		config.UseTLS = useTLSBool
	}

	return config, nil
}

func (r *VaultRepository) Close() error {
	// Vault client doesn't require explicit closing
	return nil
}
