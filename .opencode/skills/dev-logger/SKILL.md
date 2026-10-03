---
name: dev-logger
description: Cierre de sesión de @blendverse-back y @blendverse-front. Escribe memory/{task_id}/02_dev_log.md, cuyo affected_files usan la QA, el tester y el reviewer.
---

# Skill: dev-logger

Último paso de cada sesión de coder, después de que `tsc` del paquete quede limpio.

1. Frontmatter (calcula `attempts` y `date`; no editarlos a mano):

   ```bash
   .opencode/scripts/bash/memory-log-scaffold.sh frontmatter dev_log {task_id} Back_Agent|Front_Agent IMPLEMENTED
   ```

2. Agregar dentro del frontmatter `affected_files:` con **todos** los archivos creados o modificados (rutas desde la raíz, `packages/server/...` o `packages/app/...`). La QA valida exactamente esa lista: un archivo omitido no se valida.
   - Si `02_dev_log.md` ya existe con archivos de otro coder (full-stack) o de una iteración previa, conservarlos y agregar los nuevos.
3. Cuerpo, breve:

```markdown
# Log de Desarrollo — <título>

## Cambios
- `<ruta>` — <qué y por qué, una línea>

## Decisiones técnicas
- <solo las no obvias>

## Deuda técnica
- <o "Sin deuda técnica registrada.">
```
