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
- **scripts/bash/** — `open-pr.sh` (push + PR) y `run-timeout.sh`

## Configuración

`opencode.json` (raíz) carga `app.instructions.md` y `memory.instructions.md`. Los agentes llevan sus permisos en el propio frontmatter.

## Reglas

- No editar `commands/speckit.*`, `.specify/scripts/`, `.specify/templates/` ni `.specify/memory/constitution.md`.
- No existe carpeta `memory/`: el estado de los flujos vive en Engram.
