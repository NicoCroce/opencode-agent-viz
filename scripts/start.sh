#!/usr/bin/env sh
# Levanta SOLO Vite, apuntando el proxy /oc al background service de OpenCode.
#
# OpenCode moderno (1.18.34+) corre un "background service" al que se conecta el
# TUI por defecto. La visualización DEBE observar ese mismo servidor: si se
# levanta un `opencode serve` aparte, comparte la SQLite pero NO el bus de
# eventos en memoria, así que los eventos SSE de tus sesiones nunca llegan al
# browser (se ven recién al refrescar, que es una lectura de la DB).
#
# Endurecimiento (FR-018 · Principio I):
#   - La app tiene escritura siempre activa: acceder al dev server equivale a
#     ejecutar en esta máquina. Por eso Vite bindea SÓLO loopback (127.0.0.1).
#   - El proxy /oc inyecta las credenciales Basic (`opencode:<pass>`) server-side.
#     Un `OPENCODE_URL` remoto filtraría esas credenciales y expondría la
#     escritura fuera de la máquina, así que NO se soporta: sólo se acepta una
#     URL loopback (127.0.0.1 / localhost / ::1).
#   - Consecuencia aceptada: no se puede usar la web desde otra máquina de la LAN.
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/lib/opencode-service.sh"

# Sólo loopback: el proxy inyecta las creds Basic, un host remoto las filtraría.
is_loopback_url() {
  case "$1" in
    http://127.0.0.1 | http://127.0.0.1:* | http://127.0.0.1/* \
    | https://127.0.0.1 | https://127.0.0.1:* | https://127.0.0.1/* \
    | http://localhost | http://localhost:* | http://localhost/* \
    | https://localhost | https://localhost:* | https://localhost/* \
    | http://\[::1\] | http://\[::1\]:* | http://\[::1\]/* \
    | https://\[::1\] | https://\[::1\]:* | https://\[::1\]/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

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
  printf 'Verificá con `opencode service status`.\n' >&2
  exit 1
fi

if ! is_loopback_url "$OPENCODE_URL"; then
  printf 'OPENCODE_URL debe ser loopback (http://127.0.0.1:... o http://localhost:...).\n' >&2
  printf 'Se rechazó "%s": un host remoto filtraría las credenciales Basic del proxy /oc (FR-018).\n' "$OPENCODE_URL" >&2
  exit 1
fi

if [ -z "$OPENCODE_PASSWORD" ]; then
  printf 'Aviso: no se encontró la password del service (%s).\n' "$OPCODE_SERVICE_JSON" >&2
  printf 'El proxy /oc probablemente responda 401; pasá OPENCODE_PASSWORD manualmente.\n' >&2
fi

printf 'OpenCode service: %s\n' "$OPENCODE_URL"
printf 'Levantando Vite en 127.0.0.1 (proxy /oc -> %s) ...\n' "$OPENCODE_URL"

# El background service es compartido con el TUI y otras sesiones: no lo
# detenemos al salir. Ctrl+C sólo baja Vite.
# `--host 127.0.0.1` refuerza el bind loopback definido en vite.config.ts.
./node_modules/.bin/vite --host 127.0.0.1
