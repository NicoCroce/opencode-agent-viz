---
name: pr-detail
description: Genera `pr-detail.md` (título + cuerpo del PR) comparando la rama base con la rama actual. Usar antes de `open-pr.sh`.
---

# Skill: pr-detail

1. Insumos: `git log --oneline <base>..HEAD` y `git diff --stat <base>...HEAD`. `<base>` es `main`, o la rama de la que depende la actual si el PR es apilado. Mira el contenido de un archivo (`git diff <base>...HEAD -- <archivo>`) solo si hace falta para describirlo. Si existe el `spec.md` de la feature (ruta en `.specify/feature.json` → `feature_directory`), usa su resumen.
2. Escribe `pr-detail.md` en la raíz, máximo ~40 líneas:

```markdown
# PR: <título en formato Conventional Commits, ver commit-conventions>

## Resumen
<2-3 oraciones: qué cambia para el usuario y por qué. Es lo que más se lee.>

## Cambios principales
- <cambio funcional, menos de 15 palabras>

## Archivos modificados
- `<ruta>` — <menos de 5 palabras>

## Verificación
- <comandos ejecutados y resultado: tsc, lint, test, build>

## Notas adicionales
- <dependencias, riesgos, cambios de comportamiento; omite la sección si no hay>
```

Reglas:
- Solo archivos que están en el diff real.
- Sin issues, tickets, usuarios, firmas ni metadatos de IA.
- Sin secciones vacías.
- El título cumple la validación de `commit-conventions`.
- `pr-detail.md` es un artefacto temporal: `open-pr.sh` lo borra y no se commitea.
