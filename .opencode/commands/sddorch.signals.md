---
description: Backlog de señales de harness de SddOrch pendientes (sin APLICADO) y propuesta de cierre.
agent: general
---

Revisa el backlog de señales de harness de SddOrch. Solo lectura sobre el repo; no modifiques archivos.

1. Con `engram_mem_search` busca `harness signal` en el proyecto `opencode-agent-viz` (límite alto) y quédate con las observaciones cuyo título empiece por `Harness signal:` o `Senal de harness:`.
2. Para cada una, `engram_mem_get_observation`; descarta las que contengan `APLICADO` en el contenido.
3. Agrupa las pendientes por tipo (`agent`, `tool`, `script`, `skill`, `doc`) y ordénalas por `repeticiones` (las que causaron fallo primero).
4. Devuelve una tabla corta: `#id · slug · repeticiones · causó fallo · propuesta de pieza`, y como máximo 5 líneas de recomendación.
5. Si `mem_save` devolvió antes conflictos sin resolver (`judgment_required`), lístalos aparte con el `#id` de ambas observaciones; no los resuelvas sin el usuario.

$ARGUMENTS
