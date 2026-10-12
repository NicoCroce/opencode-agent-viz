#!/usr/bin/env bash
# scope-check.sh — Verifica que una tanda solo tocó los archivos declarados (`writes`).
#
# Uso:
#   scope-check.sh snapshot <baseline.tsv>
#   scope-check.sh check <baseline.tsv> <unit.md> [<unit.md> ...]
#   scope-check.sh check <baseline.tsv> --paths <ruta|prefijo/|glob> [...]
#
# `snapshot` guarda el estado actual del árbol (hash por archivo modificado o sin rastrear)
# ANTES de lanzar la tanda. `check` compara contra ese estado y lista solo lo cambiado
# fuera de los `writes`. Los `writes` salen de la sección `## writes` de cada unit.md
# (generados por schedule.mjs) o de `--paths`.
#
# Un `writes` que termina en `/` autoriza todo lo que cuelga de ese directorio.
# Exit 0 si todo está dentro del alcance; 1 si hay archivos fuera; 2 por uso incorrecto.

set -uo pipefail

snapshot_to() {
    git ls-files -m -o -d --exclude-standard | sort -u | while IFS= read -r f; do
        if [[ -e "$f" ]]; then h=$(git hash-object -- "$f" 2>/dev/null || echo unreadable); else h=deleted; fi
        printf '%s\t%s\n' "$h" "$f"
    done
}

cmd="${1:-}"
case "$cmd" in
    snapshot)
        out="${2:-}"; [[ -n "$out" ]] || { echo "Uso: $0 snapshot <baseline.tsv>" >&2; exit 2; }
        mkdir -p "$(dirname "$out")"
        snapshot_to >"$out"
        echo "baseline guardado: $(wc -l <"$out" | tr -d ' ') archivos con cambios previos"
        ;;
    check)
        base="${2:-}"; shift 2 2>/dev/null || true
        [[ -n "$base" && -f "$base" && $# -ge 1 ]] || { echo "Uso: $0 check <baseline.tsv> <unit.md...> | --paths <...>" >&2; exit 2; }
        allowed=()
        if [[ "$1" == "--paths" ]]; then
            shift
            allowed=("$@")
        else
            for u in "$@"; do
                [[ -f "$u" ]] || { echo "No existe: $u" >&2; exit 2; }
                while IFS= read -r p; do allowed+=("$p"); done < <(
                    awk '/^## writes/{f=1;next} /^## /{f=0} f && /^- /{sub(/^- /,"");print}' "$u"
                )
            done
        fi
        cur=$(mktemp); trap 'rm -f "$cur"' EXIT
        snapshot_to >"$cur"
        changed=$(comm -13 <(sort "$base") <(sort "$cur") | cut -f2- | sort -u)
        out=""; total=0
        while IFS= read -r f; do
            [[ -z "$f" ]] && continue
            total=$((total + 1))
            ok=0
            for p in "${allowed[@]}"; do
                if [[ "$f" == "$p" ]]; then ok=1; break; fi
                if [[ "$p" == */ && "$f" == "$p"* ]]; then ok=1; break; fi
                # shellcheck disable=SC2053
                if [[ "$p" == *'*'* && "$f" == $p ]]; then ok=1; break; fi
            done
            [[ $ok -eq 1 ]] || out="$out  $f"$'\n'
        done <<<"$changed"
        if [[ -z "$out" ]]; then
            echo "OK: $total archivos cambiados, todos dentro de los writes"
            exit 0
        fi
        echo "FUERA DE ALCANCE (de $total cambiados):"
        printf '%s' "$out"
        exit 1
        ;;
    *)
        echo "Uso: $0 snapshot <baseline.tsv> | check <baseline.tsv> <unit.md...|--paths ...>" >&2
        exit 2
        ;;
esac
