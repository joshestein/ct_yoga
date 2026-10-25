#!/bin/sh
# Runs before each fetch on the VPS. Pulls the latest code, and reinstalls
# dependencies only when the lockfile changed: `npm ci` removes node_modules
# first, so running it every time would break the page during a registry outage.
set -eu
cd "$(dirname "$0")/.."

old=$(git rev-parse HEAD)
git pull --ff-only --quiet
if ! git diff --quiet "$old" HEAD -- package-lock.json; then
  npm ci --omit=dev
fi
