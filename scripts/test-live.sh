#!/usr/bin/env sh
# Corre el test de integración contra el background service de OpenCode.
# Uso: pnpm test:live [ruta-vitest...]
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/lib/opencode-service.sh"

opencode_service_resolve

if [ -z "$OPENCODE_URL" ]; then
  echo "El background service de OpenCode no responde (\`opencode service status\`)." >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- src/Domains/Graph/lib/specs/live.integration.spec.ts
fi

printf 'Test de integración contra %s\n' "$OPENCODE_URL"
VIZ_API_URL="$OPENCODE_URL" ./node_modules/.bin/vitest run "$@"
