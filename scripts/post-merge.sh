#!/bin/bash
set -euo pipefail
pnpm install --frozen-lockfile
uv sync --frozen
python -m backend.migrate
