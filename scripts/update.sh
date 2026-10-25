#!/bin/sh
# Runs before each fetch on the VPS. Pulls the latest code, and reinstalls
# dependencies only when the lockfile changed: `npm ci` removes node_modules
# first, so running it every time would break the page during a registry outage.
# Compared against the copy npm writes into node_modules, so a failed install is
# retried on the next run instead of being skipped once the pull range is empty.
set -eu
cd "$(dirname "$0")/.."

git pull --ff-only --quiet
if ! cmp -s package-lock.json node_modules/.package-lock.json; then
  npm ci --omit=dev
fi
