#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
npm ci --prefix client --include=dev
# A combined deployment always calls its own API, even if old hosting settings remain.
VITE_API_BASE_URL=/api/v1 npm run build --prefix client
npm ci --prefix server --include=dev
npm run build --prefix server
