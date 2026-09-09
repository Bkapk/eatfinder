#!/usr/bin/env bash
# Production deploy. Deliberately manual — the webhook has main disabled, so
# nothing reaches production without a person running this:
#   ssh <user>@server "cd /home/<user>/public_html && bash deploy/deploy-prod.sh"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.sh"

echo "==> Deploying ${APP_NAME} to ${PROD_DIR}"
cd "${PROD_DIR}"

mkdir -p "${PROD_DATA}/uploads"

# Back up the database before migrating. SQLite is one file, so this costs
# nothing and is the only thing standing between a bad migration and the data.
if [ -f "${PROD_DATA}/eatfinder.db" ]; then
  cp "${PROD_DATA}/eatfinder.db" "${PROD_DATA}/eatfinder.db.$(date +%Y%m%d-%H%M%S).bak"
  ls -1t "${PROD_DATA}"/eatfinder.db.*.bak | tail -n +11 | xargs -r rm  # keep 10
fi

git fetch origin
git checkout main
git reset --hard origin/main

npm ci
npx prisma migrate deploy

# Turbopack refuses to build when public/ holds a symlink pointing out of the
# project root, so the old public/uploads -> ${PROD_DATA}/uploads link is removed
# here and never recreated. nginx serves /uploads/ from the volume directly;
# the app writes there via UPLOAD_DIR, set below.
if [ -L "${PROD_DIR}/public/uploads" ]; then
  rm -f "${PROD_DIR}/public/uploads"
fi

# Self-healing: without this the app would silently write uploads back into the
# checkout, where the next deploy's `git reset --hard` cannot be trusted to keep them.
if ! grep -q '^UPLOAD_DIR=' .env 2>/dev/null; then
  echo "UPLOAD_DIR=\"${PROD_DATA}/uploads\"" >> .env
fi

npm run build

pm2 restart "${APP_NAME}" --update-env

# `next start` boots happily against a missing or half-written .next and then
# 500s on every request, which is how this site once sat dead for a day with a
# green-looking deploy. Fail the deploy loudly instead.
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PROD_PORT}/" || true)
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "==> DEPLOY FAILED: ${APP_NAME} answers HTTP ${code:-000}, not 200" >&2
  pm2 logs "${APP_NAME}" --lines 40 --nostream >&2 || true
  exit 1
fi

echo "==> ${APP_NAME} deployed: https://${PROD_DOMAIN}"
