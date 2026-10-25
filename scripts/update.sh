#!/bin/sh
# Runs before each fetch on the VPS. Pulls the latest code, and reinstalls
# dependencies only when the lockfile changed: `npm ci` removes node_modules
# first, so running it every time would break the page during a registry outage.
# The lockfile copy is saved only after a successful install, so a failed
# install retries on the next run.
set -eu
cd "$(dirname "$0")/.."

git pull --ff-only --quiet
if ! cmp -s package-lock.json node_modules/.installed-lock; then
  npm ci --omit=dev
  cp package-lock.json node_modules/.installed-lock
fi
