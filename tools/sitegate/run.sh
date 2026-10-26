#!/usr/bin/env bash
# Swagramam site gate. Run from anywhere:  bash tools/sitegate/run.sh [--mobile] [--strict] [--url https://swagramam.in]
# Checks a copy of what Cloudflare Pages serves (repo minus .git and functions/). Exit 0 = gate passed.
set -euo pipefail
cd "$(dirname "$0")/../.."
node tools/sitegate/make-menu.mjs
OUT="$(mktemp -d)/site"
mkdir -p "$OUT"
tar --exclude=./.git --exclude=./functions --exclude=./node_modules --exclude=./mobile_shots -cf - . | tar -xf - -C "$OUT"
python3 tools/sitegate/sitegate.py check "$OUT" --config tools/sitegate/sitegate.config.json "$@"
