#!/usr/bin/env bash
set -euo pipefail

echo "=== Access Concierge Setup ==="

# Generate self-signed TLS cert for nginx (replace with real cert in production)
mkdir -p infra/nginx/ssl
if [ ! -f infra/nginx/ssl/server.crt ]; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout infra/nginx/ssl/server.key \
    -out infra/nginx/ssl/server.crt \
    -subj "/CN=access-concierge/O=TenantFlow" 2>/dev/null
  echo "✓ Generated self-signed TLS certificate (replace with CA-signed cert for production)"
fi

# Generate Entra app certificate (certificate-based auth, no client secrets)
mkdir -p infra/certs
if [ ! -f infra/certs/entra.pem ]; then
  openssl req -x509 -nodes -days 730 -newkey rsa:4096 \
    -keyout infra/certs/entra.key \
    -out infra/certs/entra.crt \
    -subj "/CN=access-concierge-app" 2>/dev/null
  cat infra/certs/entra.crt infra/certs/entra.key > infra/certs/entra.pem
  THUMBPRINT=$(openssl x509 -in infra/certs/entra.crt -fingerprint -sha1 -noout | sed 's/SHA1 Fingerprint=//' | tr -d ':')
  echo "✓ Generated Entra app certificate"
  echo "  Thumbprint: ${THUMBPRINT}"
  echo "  Upload infra/certs/entra.crt to your Entra ID App Registration → Certificates & secrets"
fi

# Generate random secrets if .env doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  JWT_SECRET=$(openssl rand -hex 32)
  SESSION_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)

  sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/" .env
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
  sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" >> .env
  echo "✓ Generated .env with random secrets — edit with your Entra/AD credentials"
fi

echo ""
echo "Next steps:"
echo "  1. Edit .env with your Entra tenant/client IDs"
echo "  2. Upload infra/certs/entra.crt to your Entra App Registration"
echo "  3. Run: docker compose up -d"
echo "  4. Access the portal at https://localhost"
