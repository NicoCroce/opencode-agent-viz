---
name: pr-detail
description: Genera `pr-detail.md` (título + cuerpo del PR) comparando `main` con la rama actual. Lo usa @blendverse-implement antes de `open-pr.sh`.
---

# Skill: pr-detail

1. Insumos: `git log --oneline main..HEAD` y `git diff --stat main...HEAD`. Mirar el contenido de un archivo (`git diff main...HEAD -- <archivo>`) solo si hace falta para describirlo. Si existe `spec.md` de la feature, usar su resumen.
2. Escribir `pr-detail.md` en la raíz, máximo ~40 líneas:

```markdown
# PR: <título descriptivo, formato Conventional Commits>

## Resumen
<2-3 oraciones: qué cambia para el usuario/negocio y por qué. Es lo que más se lee.>

## Cambios principales
- <cambio funcional, menos de 15 palabras>

## Archivos modificados
- `<ruta>` — <menos de 5 palabras>

## Notas adicionales
- <migraciones, variables de entorno, riesgos; omitir la sección si no hay>
```

Reglas: solo archivos que están en el diff real; sin issues, tickets, usuarios, firmas ni metadatos de IA; sin secciones vacías.
