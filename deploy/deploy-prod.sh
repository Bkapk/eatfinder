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

if [ ! -L "${PROD_DIR}/public/uploads" ]; then
  rm -rf "${PROD_DIR}/public/uploads"
  ln -s "${PROD_DATA}/uploads" "${PROD_DIR}/public/uploads"
fi

npm run build

pm2 restart "${APP_NAME}" --update-env
echo "==> ${APP_NAME} deployed: https://${PROD_DOMAIN}"
