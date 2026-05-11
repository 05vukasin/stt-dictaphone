#!/bin/sh
set -e

echo "[entrypoint] running migrations..."
node_modules/.bin/tsx scripts/migrate.ts

# seed-admin imports the auth server module, which pulls in `server-only`.
# That package only exports a no-op under the `react-server` import
# condition; otherwise it throws at import time. We are calling the module
# from a trusted server script, so flip the condition for this one process.
echo "[entrypoint] seeding admin (idempotent)..."
NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx scripts/seed-admin.ts \
  || echo "[entrypoint] seed-admin warned (continuing)"

# Encrypts any plaintext API keys still in settings_group (e.g. from
# pre-encryption deployments). Idempotent: already-encrypted values and
# empty values are skipped. The crypto module is server-only, hence the
# react-server import condition.
echo "[entrypoint] encrypting any plaintext secrets (idempotent)..."
NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx scripts/encrypt-secrets.ts \
  || echo "[entrypoint] encrypt-secrets warned (continuing)"

echo "[entrypoint] starting next..."
exec "$@"
