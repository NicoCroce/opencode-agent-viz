#!/usr/bin/env sh
# Helper compartido: resuelve el background service de OpenCode.
#
# OpenCode moderno corre un "background service" (el servidor al que se conecta
# el TUI). La URL sale de `opencode service status` y la password de
# `~/.config/opencode/service.json`. Si `OPENCODE_URL` / `OPENCODE_PASSWORD` ya
# vienen en el entorno, se respetan.
#
# Uso:
#   . "$(dirname "$0")/lib/opencode-service.sh"
#   opencode_service_resolve
#   echo "$OPENCODE_URL"

OPCODE_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
OPCODE_SERVICE_JSON="$OPCODE_CONFIG_HOME/opencode/service.json"

opencode_service_url() {
  opencode service status 2>/dev/null | head -n1 | tr -d '\r'
}

opencode_service_password() {
  if [ -n "${OPENCODE_PASSWORD:-}" ]; then
    printf '%s' "$OPENCODE_PASSWORD"
    return
  fi
  if [ -f "$OPCODE_SERVICE_JSON" ]; then
    node -e 'const fs=require("fs");try{process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1],"utf8")).password||"")}catch{}' "$OPCODE_SERVICE_JSON"
  fi
}

# Exporta OPENCODE_URL y OPENCODE_PASSWORD. No arranca el service: si la URL
# queda vacía, el llamador decide (start.sh lo levanta; los otros, fallan).
opencode_service_resolve() {
  OPENCODE_URL="${OPENCODE_URL:-$(opencode_service_url)}"
  OPENCODE_PASSWORD="$(opencode_service_password)"
  export OPENCODE_URL OPENCODE_PASSWORD
}
