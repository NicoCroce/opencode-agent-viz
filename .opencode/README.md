# OpenCode Configuration — opencode-agent-viz

Configuración para OpenCode V2 (`https://opencode.ai/v2/docs/`).

## Estructura

- **agents/** — Agentes en Markdown (frontmatter V2: `mode`, `permissions`, `steps`)
  - `sddorch.md` — Orquestador Spec-Kit (primary)
  - `sddorch-recon`, `-implementer`, `-reviewer`, `-tester`, `-release` — Subagentes
- **commands/** — Comandos `speckit.*` (instalados por Spec-Kit, no editar)
- **instructions/**
  - `app.instructions.md` — Convenciones del frontend (dominios, componentes, hooks, tipos)
  - `memory.instructions.md` — Reglas de memoria en Engram
  - `sddorch-contract.md` — Contrato de retorno de los subagentes
- **skills/** — `front-ddd-generator`, `code-reviewer`, `test-generator`, `commit-conventions`, `pr-detail`, `progress-tracker`
- **scripts/bash/** — `open-pr.sh` (push + PR) y `run-timeout.sh`

## Configuración

`opencode.json` (raíz) carga `app.instructions.md` y `memory.instructions.md`. Los agentes llevan sus permisos en el propio frontmatter.

## Reglas

- No editar `commands/speckit.*`, `.specify/scripts/`, `.specify/templates/` ni `.specify/memory/constitution.md`.
- No existe carpeta `memory/`: el estado de los flujos vive en Engram.
