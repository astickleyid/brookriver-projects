#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
port="${BROOKRIVER_PORT:-8080}"
if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:$port/"; then
  exit 0
fi
npm run dev -- --port "$port" >>"${BROOKRIVER_LOG:-/tmp/brookriver-startup.log}" 2>&1 &
