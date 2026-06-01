#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="${CERT_DIR:-infra/certs}"
DAYS="${DAYS:-730}"

echo "=== TenantFloe — Certificate Rotation ==="

# Generate new certificate
NEW_KEY="${CERT_DIR}/entra_new.key"
NEW_CRT="${CERT_DIR}/entra_new.crt"

openssl req -x509 -nodes -days "${DAYS}" -newkey rsa:4096 \
  -keyout "${NEW_KEY}" \
  -out "${NEW_CRT}" \
  -subj "/CN=tenantfloe-app" 2>/dev/null

THUMBPRINT=$(openssl x509 -in "${NEW_CRT}" -fingerprint -sha1 -noout \
  | sed 's/SHA1 Fingerprint=//' | tr -d ':')

echo "✓ New certificate generated"
echo "  Thumbprint: ${THUMBPRINT}"
echo ""
echo "IMPORTANT: Before switching over —"
echo "  1. Upload ${NEW_CRT} to Entra ID App Registration → Certificates & secrets"
echo "  2. Wait for propagation (a few minutes)"
echo "  3. Run this script again with --apply to switch the active cert"

if [[ "${1:-}" == "--apply" ]]; then
  # Archive old cert
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  mkdir -p "${CERT_DIR}/archive"
  if [ -f "${CERT_DIR}/entra.pem" ]; then
    cp "${CERT_DIR}/entra.pem" "${CERT_DIR}/archive/entra_${TIMESTAMP}.pem"
  fi

  # Activate new cert
  cat "${NEW_CRT}" "${NEW_KEY}" > "${CERT_DIR}/entra.pem"
  cp "${NEW_CRT}" "${CERT_DIR}/entra.crt"
  cp "${NEW_KEY}" "${CERT_DIR}/entra.key"
  rm -f "${NEW_KEY}" "${NEW_CRT}"

  echo "✓ Certificate rotated — entra.pem updated"
  echo "✓ Old cert archived to ${CERT_DIR}/archive/entra_${TIMESTAMP}.pem"
  echo ""
  echo "Restart the API service to pick up the new certificate:"
  echo "  docker compose restart api bot"
fi
