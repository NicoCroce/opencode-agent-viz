#!/usr/bin/env sh
# R1 — Graba eventos SSE reales de OpenCode para fixtures y tests.
# Uso: sh scripts/capture-fixture.sh [salida]
# Requiere un servidor OpenCode en http://127.0.0.1:4096 durante una
# ejecución multi-agente (develop -> implement, con al menos un subagente).
set -e

OUT="${1:-src/Domains/Graph/lib/__fixtures__/run.ndjson}"
mkdir -p "$(dirname "$OUT")"
echo "Grabando eventos en $OUT (Ctrl+C para detener)..."
curl -N http://127.0.0.1:4096/event > "$OUT"
