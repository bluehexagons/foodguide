#!/usr/bin/env bash
#
# deploy.sh — Triggered by webhook to deploy latest foodguide to the server.
#
# This script:
#   1. Pulls the latest code from the main branch
#   2. Installs the locked dependencies and generates sprite assets
#   3. Syncs the html/ directory to the nginx serving path
#
# Use a dedicated deployment checkout: local changes are discarded on deployment.
# Configuration can be overridden through the webhook service's environment.
REPO_DIR="${REPO_DIR:-/opt/foodguide/repo}"
SERVE_DIR="${SERVE_DIR:-/var/www/foodguide}"

set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting deployment..."

# Serialize webhook invocations so builds and rsync cannot overlap.
GIT_DIR="$(git -C "$REPO_DIR" rev-parse --absolute-git-dir)"
exec 9>"$GIT_DIR/foodguide-deploy.lock"
flock 9

# Pull latest changes
log "Pulling latest from origin/main..."
git -C "$REPO_DIR" fetch origin main
git -C "$REPO_DIR" reset --hard origin/main

# Generated assets are ignored by Git and must be built before publishing.
log "Installing dependencies and generating sprites..."
npm --prefix "$REPO_DIR" ci --ignore-scripts
npm --prefix "$REPO_DIR" run build
npm --prefix "$REPO_DIR" run generate-sprites

# Sync html/ to serving directory
log "Syncing files to $SERVE_DIR..."
rsync -a --delete "$REPO_DIR/html/" "$SERVE_DIR/"

log "Deployment complete."
