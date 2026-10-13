#!/usr/bin/env bash
# scope-check.sh — Verifica que una tanda solo tocó los archivos declarados (`writes`).
#
# Uso:
#   scope-check.sh snapshot <baseline.tsv>
#   scope-check.sh check <baseline.tsv> <unit.md> [<unit.md> ...]
#   scope-check.sh check <baseline.tsv> --per-unit <unit.md> [<unit.md> ...]
#   scope-check.sh check <baseline.tsv> --paths <ruta|prefijo/|glob> [...]
#
# `snapshot` guarda el estado actual del árbol (hash por archivo modificado o sin rastrear)
# ANTES de lanzar la tanda. `check` compara contra ese estado y lista solo lo cambiado
# fuera de los `writes`. Los `writes` salen de la sección `## writes` de cada unit.md
# (generados por schedule.mjs) o de `--paths`.
#
# Un `writes` que termina en `/` autoriza todo lo que cuelga de ese directorio.
# `--per-unit` añade un informe por unidad: SIN CAMBIOS (unidad que no tocó nada de sus writes) y
# RECLAMADO POR n UNIDADES (archivo dentro de los writes de 2+ unidades de la ola); ambos dan exit 1.
# Exit 0 si todo está dentro del alcance; 1 si hay archivos fuera o avisos por unidad; 2 por uso incorrecto.

set -uo pipefail

snapshot_to() {
    git ls-files -m -o -d --exclude-standard | sort -u | while IFS= read -r f; do
        if [[ -e "$f" ]]; then h=$(git hash-object -- "$f" 2>/dev/null || echo unreadable); else h=deleted; fi
        printf '%s\t%s\n' "$h" "$f"
    done
}

in_scope() {
    local f="$1" p; shift
    for p in "$@"; do
        [[ "$f" == "$p" ]] && return 0
        [[ "$p" == */ && "$f" == "$p"* ]] && return 0
        # shellcheck disable=SC2053
        [[ "$p" == *'*'* && "$f" == $p ]] && return 0
    done
    return 1
}

# Reparte los archivos cambiados por unidad (no se puede atribuir un archivo a un implementador
# concreto en un árbol compartido): avisa de unidades sin cambios y de archivos reclamados por 2+.
# Devuelve 1 si hay avisos.
per_unit_report() {
    local changed="$1" i f n claim warn=0 pats
    for i in "${!unit_names[@]}"; do
        pats=(); while IFS= read -r p; do [[ -n "$p" ]] && pats+=("$p"); done <<<"${unit_writes[$i]}"
        n=0
        while IFS= read -r f; do
            [[ -z "$f" ]] && continue
            in_scope "$f" "${pats[@]}" && n=$((n + 1))
        done <<<"$changed"
        if [[ $n -eq 0 ]]; then echo "SIN CAMBIOS: ${unit_names[$i]} (ningún archivo de sus writes cambió)"; warn=1
        else echo "unidad ${unit_names[$i]}: $n archivos"; fi
    done
    while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        claim=0
        for i in "${!unit_names[@]}"; do
            pats=(); while IFS= read -r p; do [[ -n "$p" ]] && pats+=("$p"); done <<<"${unit_writes[$i]}"
            in_scope "$f" "${pats[@]}" && claim=$((claim + 1))
        done
        if [[ $claim -gt 1 ]]; then echo "RECLAMADO POR $claim UNIDADES: $f"; warn=1; fi
    done <<<"$changed"
    return $warn
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
        per_unit=0; unit_names=(); unit_writes=()
        if [[ "${1:-}" == "--per-unit" ]]; then per_unit=1; shift; fi
        if [[ "$1" == "--paths" ]]; then
            [[ $per_unit -eq 0 ]] || { echo "--per-unit solo con <unit.md>" >&2; exit 2; }
            shift
            allowed=("$@")
        else
            for u in "$@"; do
                [[ -f "$u" ]] || { echo "No existe: $u" >&2; exit 2; }
                uw=$(awk '/^## writes/{f=1;next} /^## /{f=0} f && /^- /{sub(/^- /,"");print}' "$u")
                unit_names+=("$(basename "$u" .md)"); unit_writes+=("$uw")
                while IFS= read -r p; do [[ -n "$p" ]] && allowed+=("$p"); done <<<"$uw"
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
            if [[ $per_unit -eq 1 ]]; then per_unit_report "$changed"; exit $?; fi
            exit 0
        fi
        echo "FUERA DE ALCANCE (de $total cambiados):"
        printf '%s' "$out"
        if [[ $per_unit -eq 1 ]]; then per_unit_report "$changed" || true; fi
        exit 1
        ;;
    *)
        echo "Uso: $0 snapshot <baseline.tsv> | check <baseline.tsv> <unit.md...|--paths ...>" >&2
        exit 2
        ;;
esac
