#!/usr/bin/env bash
# run-timeout.sh — Ejecuta un comando con límite de tiempo (macOS no trae `timeout`).
#
# Uso:
#   run-timeout.sh <segundos> <comando> [args...]
#
# Si el comando termina a tiempo, devuelve su salida y su exit code tal cual.
# Si vence el límite, mata el comando y todos sus hijos (process group), imprime
# `TIMEOUT: <comando> superó <n>s` por stderr y sale con 124 (igual que GNU timeout).

set -uo pipefail
set -m

SECS="${1:-}"
[[ "$SECS" =~ ^[0-9]+$ && $# -ge 2 ]] || { echo "Uso: $0 <segundos> <comando> [args...]" >&2; exit 2; }
shift

"$@" &
pid=$!

flag="$(mktemp)"
rm -f "$flag"
(
    sleep "$SECS"
    if kill -0 "$pid" 2>/dev/null; then
        touch "$flag"
        kill -TERM -- "-$pid" 2>/dev/null
        sleep 3
        kill -KILL -- "-$pid" 2>/dev/null
    fi
) >/dev/null 2>&1 &
watchdog=$!

wait "$pid"
code=$?
kill -- "-$watchdog" 2>/dev/null

if [[ -f "$flag" ]]; then
    rm -f "$flag"
    echo "TIMEOUT: $* superó ${SECS}s" >&2
    exit 124
fi
exit "$code"
