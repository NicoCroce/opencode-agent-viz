#!/usr/bin/env bash
# open-pr.sh — Consolida el flujo mecánico de commit/PR del agente `sdd`:
# fetch + push + gh pr create (o fallback a URL de compare si gh no está
# disponible o falla) + limpieza del artefacto derivado pr-detail.md.
#
# NO genera el contenido del PR — eso lo hace el subagente `pr-detail` (skill
# `pr-detail`), que sí requiere razonamiento sobre el diff. Este script solo
# ejecuta la parte 100% mecánica una vez que el título y el body ya existen.
#
# Uso:
#   open-pr.sh <title> <body_file> [base_branch]
#     title: título del PR (string, ya generado por pr-detail.md → # PR: ...)
#     body_file: ruta al archivo pr-detail.md (se usa como --body-file y se
#       borra al final, sea cual sea el resultado)
#     base_branch: default "main"
#
# Salida: JSON {method: "gh"|"manual"|"push_failed", pr_url: "..."|null, compare_url: "...", error?}
#   push_failed: el push falló (credenciales, rechazo, timeout); pr-detail.md se conserva.
#
# Requiere: git. `gh` es opcional (fallback automático si falta o falla).

set -uo pipefail

SCRIPT_DIR="$(CDPATH="" cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH="" cd -- "$SCRIPT_DIR/../../.." && pwd)"

usage() {
    echo "Uso: $0 <title> <body_file> [base_branch]" >&2
    exit 1
}

require_jq() {
    if ! command -v jq >/dev/null 2>&1; then
        echo "ERROR: jq no está disponible." >&2
        exit 1
    fi
}

TITLE="${1:-}"
BODY_FILE="${2:-}"
BASE_BRANCH="${3:-main}"
[[ -n "$TITLE" && -n "$BODY_FILE" ]] || usage
require_jq

cd "$REPO_ROOT"

if [[ "$(git rev-parse --show-toplevel 2>/dev/null)" != "$(pwd -P)" ]]; then
    echo "ERROR: $REPO_ROOT no es la raíz de un repo git; se aborta para no operar sobre otro repo." >&2
    exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
    echo "ERROR: no se pudo determinar la rama actual (HEAD detached?)." >&2
    exit 1
fi

# --- owner/repo desde el remoto "origin", soportando SSH y HTTPS ---
remote_url="$(git remote get-url origin 2>/dev/null || true)"
owner_repo=""
if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    owner_repo="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
fi

compare_url=""
if [[ -n "$owner_repo" ]]; then
    compare_url="https://github.com/${owner_repo}/compare/${BASE_BRANCH}...${CURRENT_BRANCH}?expand=1"
fi

# Sin prompts interactivos: un pedido de credenciales o passphrase colgaría al agente
# sin que nadie lo vea. Falla rápido y se informa.
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh} -o BatchMode=yes -o ConnectTimeout=15"
export GH_PROMPT_DISABLED=1
RUN_TIMEOUT="$SCRIPT_DIR/run-timeout.sh"

# --- fetch + push (mecánico, sin generar contenido) ---
"$RUN_TIMEOUT" 60 git fetch origin "$BASE_BRANCH" >&2
if ! push_err="$("$RUN_TIMEOUT" 90 git push -u origin "$CURRENT_BRANCH" 2>&1)"; then
    echo "$push_err" >&2
    jq -n --arg compare_url "$compare_url" --arg error "$(tail -n 5 <<<"$push_err")" \
        '{method: "push_failed", pr_url: null, compare_url: $compare_url, error: $error}'
    exit 0
fi

pr_url=""
method="manual"

if command -v gh >/dev/null 2>&1; then
    if pr_url="$("$RUN_TIMEOUT" 60 gh pr create --base "$BASE_BRANCH" --head "$CURRENT_BRANCH" --title "$TITLE" --body-file "$BODY_FILE")"; then
        method="gh"
    else
        pr_url=""
        method="manual"
    fi
fi

# Limpieza del artefacto derivado, pase lo que pase.
rm -f "$BODY_FILE"

if [[ "$method" == "gh" ]]; then
    jq -n --arg method "$method" --arg pr_url "$pr_url" --arg compare_url "$compare_url" \
        '{method: $method, pr_url: $pr_url, compare_url: $compare_url}'
else
    jq -n --arg method "$method" --arg compare_url "$compare_url" \
        '{method: $method, pr_url: null, compare_url: $compare_url}'
fi
