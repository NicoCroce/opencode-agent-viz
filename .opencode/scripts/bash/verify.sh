#!/usr/bin/env bash
# verify.sh — Ejecuta las verificaciones del proyecto y devuelve solo un resumen.
#
# Uso:
#   verify.sh [--log-dir <dir>] [lint tsc test build]
#
# Sin argumentos corre lint, tsc y build en paralelo y luego test (VERIFY_COMMANDS de sddorch.md).
# test usa como máximo 2 workers de Vitest (VERIFY_TEST_WORKERS para cambiarlo).
# Los resultados se imprimen siempre en el orden lint, tsc, test, build.
# El log completo de cada comando queda en <log-dir>/<cmd>.log
# (por defecto .opencode/runs/_verify). En pantalla solo salen: PASS/FAIL, duración y,
# si falla, las primeras líneas de error. No se detiene en el primer fallo.
#
# Exit 0 si todo pasó; 1 si alguno falló.

set -uo pipefail

LOG_DIR=".opencode/runs/_verify"
CMDS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --log-dir) LOG_DIR="${2:?falta <dir>}"; shift 2 ;;
        lint|tsc|test|build) CMDS+=("$1"); shift ;;
        *) echo "Argumento no reconocido: $1 (válidos: lint tsc test build)" >&2; exit 2 ;;
    esac
done
[[ ${#CMDS[@]} -gt 0 ]] || CMDS=(lint tsc test build)

TEST_WORKERS="${VERIFY_TEST_WORKERS:-2}"

mkdir -p "$LOG_DIR"
failed=0

has_cmd() {
    local x
    for x in "${CMDS[@]}"; do [[ "$x" == "$1" ]] && return 0; done
    return 1
}

# `pnpm build` ya corre `tsc`; si tsc está en la lista, build solo corre vite.
run_cmd() {
    local c="$1" start=$SECONDS rc
    if [[ "$c" == "build" ]] && has_cmd tsc; then
        pnpm exec vite build >"$LOG_DIR/$c.log" 2>&1
    elif [[ "$c" == "test" ]]; then
        pnpm exec vitest run \
            --poolOptions.forks.maxForks="$TEST_WORKERS" --poolOptions.forks.minForks=1 \
            --poolOptions.threads.maxThreads="$TEST_WORKERS" --poolOptions.threads.minThreads=1 \
            >"$LOG_DIR/$c.log" 2>&1
    else
        pnpm "$c" >"$LOG_DIR/$c.log" 2>&1
    fi
    rc=$?
    echo "$rc" >"$LOG_DIR/$c.rc"
    echo "$((SECONDS - start))" >"$LOG_DIR/$c.dur"
}

# lint, tsc y build son independientes: en paralelo. test va aparte, después.
PARALLEL=()
SERIAL=()
for c in "${CMDS[@]}"; do
    if [[ "$c" == "test" ]]; then SERIAL+=("$c"); else PARALLEL+=("$c"); fi
done

if [[ ${#PARALLEL[@]} -gt 0 ]]; then
    for c in "${PARALLEL[@]}"; do run_cmd "$c" & done
    wait
fi
if [[ ${#SERIAL[@]} -gt 0 ]]; then
    for c in "${SERIAL[@]}"; do run_cmd "$c"; done
fi

for c in "${CMDS[@]}"; do
    log="$LOG_DIR/$c.log"
    rc=$(<"$LOG_DIR/$c.rc")
    dur=$(<"$LOG_DIR/$c.dur")
    rm -f "$LOG_DIR/$c.rc" "$LOG_DIR/$c.dur"
    if [[ $rc -eq 0 ]]; then
        extra=""
        if [[ "$c" == "test" ]]; then
            extra=" — $(grep -E 'Tests +[0-9]+' "$log" | tail -1 | sed 's/^[[:space:]]*//')"
        fi
        echo "PASS $c (${dur}s)${extra}"
    else
        failed=1
        echo "FAIL $c (${dur}s, exit $rc) → $log"
        n=$(grep -c -E 'error|Error|FAIL|✗|×' "$log" || true)
        grep -E 'error|Error|FAIL|✗|×' "$log" | head -n 20 | cut -c1-220 | sed 's/^/  /'
        [[ "${n:-0}" -gt 20 ]] && echo "  … $((n - 20)) líneas más en el log"
        [[ "${n:-0}" -eq 0 ]] && tail -n 10 "$log" | cut -c1-220 | sed 's/^/  /'
    fi
done

exit $failed
