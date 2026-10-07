#!/usr/bin/env sh
# R1 — Graba eventos SSE reales de OpenCode para fixtures y tests.
# Uso: sh scripts/capture-fixture.sh [salida]
#
# Requiere el background service de OpenCode arriba: es el mismo servidor al que
# se conecta el TUI, o sea el único que emite los eventos de tus sesiones.
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/lib/opencode-service.sh"

OUT="${1:-src/Domains/Graph/lib/__fixtures__/run.ndjson}"

opencode_service_resolve

if [ -z "$OPENCODE_URL" ]; then
  echo "El background service de OpenCode no responde (\`opencode service status\`)." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
echo "Grabando eventos de $OPENCODE_URL en $OUT (Ctrl+C para detener)..."
if [ -n "$OPENCODE_PASSWORD" ]; then
  curl -N -u "opencode:${OPENCODE_PASSWORD}" "$OPENCODE_URL/api/event" > "$OUT"
else
  curl -N "$OPENCODE_URL/api/event" > "$OUT"
fi
