#!/bin/bash

# Script to generate RSA keys for JWT signing in the IAM service
# This generates a 2048-bit RSA key pair and encodes them in Base64 for use in environment variables

set -e

echo "Generating RSA key pair for JWT signing..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Generate private key (2048 bits)
echo "Generating private key..."
openssl genrsa -out private_key.pem 2048

# Generate public key from private key
echo "Generating public key..."
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Convert to Base64 (without line breaks)
echo "Converting keys to Base64..."
PRIVATE_KEY_BASE64=$(base64 -w 0 private_key.pem)
PUBLIC_KEY_BASE64=$(base64 -w 0 public_key.pem)

# Display the keys
echo ""
echo "=== JWT RSA Keys Generated ==="
echo ""
echo "Private Key (Base64):"
echo "$PRIVATE_KEY_BASE64"
echo ""
echo "Public Key (Base64):"
echo "$PUBLIC_KEY_BASE64"
echo ""

# Update .env file
# Handle both relative paths (when run from project root) and absolute paths (when run from container)
if [ -f "../../.env" ]; then
    ENV_FILE="../../.env"
elif [ -f "/workspace/.env" ]; then
    ENV_FILE="/workspace/.env"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
else
    echo "❌ .env file not found"
    echo "Please manually add these keys to your .env file:"
    echo ""
    echo "JWT_PRIVATE_KEY_BASE64=$PRIVATE_KEY_BASE64"
    echo "JWT_PUBLIC_KEY_BASE64=$PUBLIC_KEY_BASE64"
    exit 1
fi

echo "Updating .env file with generated keys..."

# Backup original file
TIMESTAMP=$(date +%s)
cp "$ENV_FILE" "${ENV_FILE}.backup.$TIMESTAMP"

# Update the JWT key variables using sed
sed -i "s|^JWT_PRIVATE_KEY_BASE64=.*|JWT_PRIVATE_KEY_BASE64=$PRIVATE_KEY_BASE64|" "$ENV_FILE"
sed -i "s|^JWT_PUBLIC_KEY_BASE64=.*|JWT_PUBLIC_KEY_BASE64=$PUBLIC_KEY_BASE64|" "$ENV_FILE"

echo "✅ .env file updated successfully!"
echo "💡 A backup of the original .env file has been created: ${ENV_FILE}.backup.$TIMESTAMP"

# Cleanup
cd -
rm -rf "$TEMP_DIR"

echo ""
echo "✅ RSA key generation completed!"
echo "🔐 Keys are ready for use with your Spring Boot IAM service"
echo ""
echo "Next steps:"
echo "1. Start the services: docker-compose -f infra/compose/compose.dev.yaml up"
echo "2. The IAM service will automatically create an admin user on first startup"
echo "3. Test the API endpoints documented in the README"