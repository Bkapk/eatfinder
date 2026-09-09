#!/usr/bin/env bash
# Shared deploy configuration. Sourced by deploy-dev.sh and deploy-prod.sh.
#
# Directories are written out in full rather than derived from the domain,
# because the dev site is a Virtualmin sub-server under an unrelated apex
# (hajdehajme.bleart.dev under bleart.dev), not dev.<app-domain>. Deriving them
# would only work for one of the two layouts.

VM_USER="bleart"

# --- dev: live now ---
DEV_DOMAIN="hajdehajme.bleart.dev"
DEV_DIR="/home/bleart/domains/hajdehajme.bleart.dev/public_html"
DEV_PORT=3009   # 3000-3008 and 3100 were taken

# --- prod: no domain chosen yet ---
# When one exists: create the virtual server, set these three, and the same
# deploy-prod.sh works unchanged. Until then prod is simply never deployed.
PROD_DOMAIN=""
PROD_DIR="/home/bleart/public_html"
PROD_PORT=3010  # reserved, no prod domain yet

APP_NAME="eatfinder"

# SQLite and uploads live OUTSIDE the checkout on purpose. Inside it, a reclone
# or a clean destroys the database, and prisma/*.db is gitignored so nothing
# warns you. These two paths are the entire backup surface.
DEV_DATA="/home/${VM_USER}/eatfinder-data/dev"
PROD_DATA="/home/${VM_USER}/eatfinder-data/prod"
