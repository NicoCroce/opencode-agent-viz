#!/usr/bin/env sh
# Levanta OpenCode (puerto 4096) + Vite en un solo comando.
# Al salir (Ctrl+C) detiene ambos procesos que arrancó este script.
set -eu

OPENCODE_PORT="${OPENCODE_PORT:-4096}"

# La API V2 de OpenCode exige HTTP Basic (usuario `opencode`). Generamos una
# password por arranque y la exportamos: `opencode serve` la toma de
# OPENCODE_PASSWORD y Vite la hereda para inyectarla en el proxy `/oc`, así el
# browser nunca ve ni maneja credenciales. Si ya viene seteada, se respeta.
OPENCODE_PASSWORD="${OPENCODE_PASSWORD:-$(openssl rand -hex 32)}"
export OPENCODE_PASSWORD

OC_PID=""
VITE_PID=""

cleanup() {
  if [ -n "$VITE_PID" ] && kill -0 "$VITE_PID" 2>/dev/null; then
    kill "$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
  fi
  if [ -n "$OC_PID" ] && kill -0 "$OC_PID" 2>/dev/null; then
    printf '\nDeteniendo OpenCode (PID %s)...\n' "$OC_PID"
    kill "$OC_PID" 2>/dev/null || true
    wait "$OC_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if lsof -nP -iTCP:"$OPENCODE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'El puerto %s ya está en uso. Detené ese proceso o usá OPENCODE_PORT=<otro>.\n' "$OPENCODE_PORT" >&2
  exit 1
fi

printf 'Levantando OpenCode en http://127.0.0.1:%s (auth habilitada)...\n' "$OPENCODE_PORT"
opencode serve --port "$OPENCODE_PORT" &
OC_PID=$!

i=0
while [ "$i" -lt 30 ]; do
  if lsof -nP -iTCP:"$OPENCODE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$OC_PID" 2>/dev/null; then
    printf 'OpenCode terminó antes de escuchar en el puerto %s.\n' "$OPENCODE_PORT" >&2
    exit 1
  fi
  i=$((i + 1))
  sleep 0.5
done

if ! lsof -nP -iTCP:"$OPENCODE_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'OpenCode no respondió en el puerto %s a tiempo.\n' "$OPENCODE_PORT" >&2
  exit 1
fi

printf 'OpenCode listo. Levantando Vite ...\n'
./node_modules/.bin/vite &
VITE_PID=$!

wait "$VITE_PID"
