#!/usr/bin/env bash
#
# deploy.sh — Triggered by webhook to deploy latest foodguide to the server.
#
# This script:
#   1. Pulls the latest code from the main branch
#   2. Syncs the html/ directory to the nginx serving path
#
# Configuration (edit these):
REPO_DIR="/opt/foodguide/repo"
SERVE_DIR="/var/www/foodguide"   # <-- Change to your nginx root

set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting deployment..."

# Pull latest changes
log "Pulling latest from origin/main..."
git -C "$REPO_DIR" fetch origin main
git -C "$REPO_DIR" reset --hard origin/main

# Sync html/ to serving directory
log "Syncing files to $SERVE_DIR..."
rsync -a --delete "$REPO_DIR/html/" "$SERVE_DIR/"

log "Deployment complete."
