#!/usr/bin/env sh
# Levanta SOLO Vite, apuntando el proxy /oc al background service de OpenCode.
#
# OpenCode moderno (1.18.34+) corre un "background service" al que se conecta el
# TUI por defecto. La visualización DEBE observar ese mismo servidor: si se
# levanta un `opencode serve` aparte, comparte la SQLite pero NO el bus de
# eventos en memoria, así que los eventos SSE de tus sesiones nunca llegan al
# browser (se ven recién al refrescar, que es una lectura de la DB).
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/lib/opencode-service.sh"

opencode_service_resolve

if [ -z "$OPENCODE_URL" ]; then
  printf 'El background service de OpenCode no está corriendo; iniciándolo...\n'
  opencode service start >/dev/null 2>&1 || true
  i=0
  while [ "$i" -lt 20 ]; do
    OPENCODE_URL="$(opencode_service_url)"
    if [ -n "$OPENCODE_URL" ]; then
      break
    fi
    i=$((i + 1))
    sleep 0.5
  done
  export OPENCODE_URL
fi

if [ -z "$OPENCODE_URL" ]; then
  printf 'No se pudo determinar la URL del background service de OpenCode.\n' >&2
  printf 'Verificá con `opencode service status` o pasá OPENCODE_URL manualmente.\n' >&2
  exit 1
fi

if [ -z "$OPENCODE_PASSWORD" ]; then
  printf 'Aviso: no se encontró la password del service (%s).\n' "$OPCODE_SERVICE_JSON" >&2
  printf 'El proxy /oc probablemente responda 401; pasá OPENCODE_PASSWORD manualmente.\n' >&2
fi

printf 'OpenCode service: %s\n' "$OPENCODE_URL"
printf 'Levantando Vite (proxy /oc -> %s) ...\n' "$OPENCODE_URL"

# El background service es compartido con el TUI y otras sesiones: no lo
# detenemos al salir. Ctrl+C sólo baja Vite.
./node_modules/.bin/vite
