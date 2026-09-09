#!/usr/bin/env bash
# Deploys the dev branch to dev.<domain>. Run by the webhook listener on push,
# or by hand:  bash deploy/deploy-dev.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

echo "==> Deploying ${APP_NAME}-dev to ${DEV_DIR}"
cd "${DEV_DIR}"

# The database and uploads live outside the checkout, so create them before
# anything else touches them.
mkdir -p "${DEV_DATA}/uploads"

git fetch origin
git checkout dev
git reset --hard origin/dev   # a hand-edit on the server must never block a deploy

npm ci

# package.json's build script already runs `prisma generate`, but migrate deploy
# is never automatic and must be explicit. It only applies pending migrations —
# it never resets and never prompts, which is why it is the deploy-safe verb.
npx prisma migrate deploy

# Turbopack refuses to build when public/ holds a symlink pointing out of the
# project root, so the old public/uploads -> ${DEV_DATA}/uploads link is removed
# here and never recreated. nginx serves /uploads/ from the volume directly;
# the app writes there via UPLOAD_DIR, set below.
if [ -L "${DEV_DIR}/public/uploads" ]; then
  rm -f "${DEV_DIR}/public/uploads"
fi

# Self-healing: without this the app would silently write uploads back into the
# checkout, where the next deploy's `git reset --hard` cannot be trusted to keep them.
if ! grep -q '^UPLOAD_DIR=' .env 2>/dev/null; then
  echo "UPLOAD_DIR=\"${DEV_DATA}/uploads\"" >> .env
fi

npm run build

pm2 restart "${APP_NAME}-dev" --update-env

# `next start` boots happily against a missing or half-written .next and then
# 500s on every request, which is how this site once sat dead for a day with a
# green-looking deploy. Fail the deploy loudly instead.
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${DEV_PORT}/" || true)
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "==> DEPLOY FAILED: ${APP_NAME}-dev answers HTTP ${code:-000}, not 200" >&2
  pm2 logs "${APP_NAME}-dev" --lines 40 --nostream >&2 || true
  exit 1
fi

echo "==> ${APP_NAME}-dev deployed: https://${DEV_DOMAIN}"
