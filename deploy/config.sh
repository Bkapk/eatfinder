#!/usr/bin/env bash
# Shared deploy configuration. Sourced by deploy-dev.sh and deploy-prod.sh.
#
# FILL THESE IN before the first deploy. They are the only values that differ
# between one Virtualmin box and another, which is why they live here rather
# than being scattered across five scripts.

# The Linux user that owns the Virtualmin virtual server.
VM_USER="CHANGEME"

# Bare apex domain, no scheme, no www.
APP_DOMAIN="CHANGEME.com"

# PM2 app name and the base for the dev one (<APP_NAME>-dev).
APP_NAME="eatfinder"

# Ports must be unique across every app on this box. Check what is already
# taken with: pm2 list  (and: ss -ltnp | grep -E ':30[0-9][0-9]')
PROD_PORT=3005
DEV_PORT=3006

# --- Derived. Virtualmin fixes this layout; do not fight it. ---
PROD_DIR="/home/${VM_USER}/public_html"
DEV_DIR="/home/${VM_USER}/domains/dev.${APP_DOMAIN}/public_html"

# SQLite lives OUTSIDE the checkout on purpose. Inside it, a stray clean or a
# reclone destroys the database, and prisma/*.db is gitignored so nothing warns
# you. Same for uploads when R2 is not configured. Back up these two paths.
PROD_DATA="/home/${VM_USER}/eatfinder-data/prod"
DEV_DATA="/home/${VM_USER}/eatfinder-data/dev"
