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

# public/uploads is gitignored, so a fresh clone has no directory at all. Link it
# to the persistent volume rather than copying, so a redeploy cannot orphan
# files. Harmless when R2 is configured — nothing writes there.
if [ ! -L "${DEV_DIR}/public/uploads" ]; then
  rm -rf "${DEV_DIR}/public/uploads"
  ln -s "${DEV_DATA}/uploads" "${DEV_DIR}/public/uploads"
fi

npm run build

pm2 restart "${APP_NAME}-dev" --update-env
echo "==> ${APP_NAME}-dev deployed: https://dev.${APP_DOMAIN}"
