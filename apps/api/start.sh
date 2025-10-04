#!/usr/bin/env bash
set -euo pipefail

export API_PORT=${API_PORT:-8080}

echo "Starting API on port ${API_PORT}"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT}" --log-level info

