#!/usr/bin/env bash
# mark-tasks.sh — Marca `[X]` en tasks.md para los IDs indicados. Una sola llamada por tanda.
#
# Uso:
#   mark-tasks.sh <tasks.md> <T001> [T002 ...]
#
# Salida (corta): marcadas / ya estaban / no encontradas.
# Exit 0 si todas quedaron marcadas (o ya lo estaban); 1 si algún ID no existe; 2 por uso incorrecto.

set -uo pipefail

FILE="${1:-}"
[[ -n "$FILE" && $# -ge 2 ]] || { echo "Uso: $0 <tasks.md> <ID> [ID...]" >&2; exit 2; }
[[ -f "$FILE" ]] || { echo "No existe: $FILE" >&2; exit 2; }
shift

marked=""
already=""
missing=""

for id in "$@"; do
    [[ "$id" =~ ^T[0-9]+$ ]] || { echo "ID inválido: $id" >&2; exit 2; }
    if grep -Eq "^[[:space:]]*- \[[xX]\] ${id}([[:space:]]|$)" "$FILE"; then
        already="$already $id"
    elif grep -Eq "^[[:space:]]*- \[ \] ${id}([[:space:]]|$)" "$FILE"; then
        perl -i -pe "s/^(\s*- )\[ \](\s+${id}(?:\s|\$))/\$1\[X\]\$2/" "$FILE"
        marked="$marked $id"
    else
        missing="$missing $id"
    fi
done

echo "marcadas:${marked:- ninguna}"
[[ -n "$already" ]] && echo "ya estaban:$already"
if [[ -n "$missing" ]]; then
    echo "no encontradas:$missing"
    exit 1
fi
exit 0
