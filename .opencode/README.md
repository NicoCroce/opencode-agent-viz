# OpenCode Configuration — opencode-agent-viz

Configuración para OpenCode V2 (`https://opencode.ai/v2/docs/`).

> Documentación legible del método (SddOrch, descubrimiento, subagentes, auto-aprendizaje):
> [docs/es/sdd/](../docs/es/sdd/01-overview.md) · [`docs/es/sdd/`](../docs/es/sdd/) · [`docs/en/sdd/`](../docs/en/sdd/).
> Índice general del repositorio: [README.md](../README.md).

## Estructura

- **agents/** — Agentes en Markdown (frontmatter V2: `mode`, `permissions`, `steps`)
  - `sddorch.md` — Orquestador Spec-Kit (primary)
  - `sddorch-researcher-code`, `-researcher-market`, `-writer` — Descubrimiento (investigan por rol y redactan PRD y RFC)
  - `sddorch-implementer`, `-reviewer`, `-tester`, `-release` — Implementación, revisión, tests y cierre
- **commands/** — Comandos `speckit.*` (instalados por Spec-Kit, no editar)
- **instructions/**
  - `app.instructions.md` — Convenciones del frontend (dominios, componentes, hooks, tipos)
  - `memory.instructions.md` — Reglas de memoria en Engram
  - `sddorch-contract.md` — Contrato de retorno de los subagentes
- **roles/** — Perfil de cada rol de investigación (producto, ux, seguridad, rendimiento, calidad, accesibilidad)
- **templates/discovery/** — Plantillas de PRD y RFC
- **skills/** — Propias y de terceros; ver `skills/README.md` (procedencia y licencias)
- **scripts/bash/** — `open-pr.sh` (push + PR), `run-timeout.sh`, y los de SddOrch: `schedule.mjs` (olas), `mark-tasks.sh`, `scope-check.sh`, `verify.sh` (lint/tsc/test/build en paralelo; `--changed` para correr solo los specs afectados; `VERIFY_TEST_WORKERS` para el tope de workers de Vitest, 4 por defecto; ver `docs/es/sdd/12-optimizacion-verificacion.md`). El área de trabajo de cada ejecución es `runs/` (ignorada por git)

## Configuración

En V2 el campo `instructions` de `opencode.json` no se resuelve, así que los archivos de `instructions/` **no se cargan automáticamente**. Lo único que se carga una vez es `AGENTS.md` (las reglas esenciales del frontend están en su sección 11). `app.instructions.md` queda como referencia extendida con ejemplos; `memory.instructions.md` y `sddorch-contract.md` los leen explícitamente los agentes que los necesitan. Los agentes llevan sus permisos en el propio frontmatter.

## Reglas

- No editar `commands/speckit.*`, `.specify/scripts/`, `.specify/templates/` ni `.specify/memory/constitution.md`.
- No existe carpeta `memory/`: el estado de los flujos vive en Engram.
