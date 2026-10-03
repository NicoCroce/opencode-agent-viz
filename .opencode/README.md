# OpenCode Configuration — opencode-agent-viz

## Estructura

- **instructions/** — Normas de arquitectura y convenciones aplicadas automáticamente en tareas
  - `app.instructions.md` — Convenciones del frontend (dominios, componentes, hooks, tipos)
  - `memory.instructions.md` — Reglas de persistencia en Engram
- **skills/** — Skills locales del proyecto (heredadas de gestDoc)
  - front-ddd-generator, code-reviewer, dev-logger, etc.
- **templates/speckit/** — Plantillas para Spec-kit (specify, plan, tasks)
- **plugins/** — Plugins locales (se cargan automáticamente)
  - `selectable-questions.ts` — Fuerza el uso del tool `question` en vez de menús de texto plano
- **scripts/bash/** — Scripts de utilidad (timeout, etc.)

## Configuración

Ver `opencode.json`:
- Instructions cargadas automáticamente
- Temperaturas por agente (specify/tasks = 0.1, plan = 0.3)
- Plugins: `plugins/` se cargan automáticamente; sus tipos vienen de `@opencode/plugin` (ver `.opencode/package.json`)

## Uso

Los archivos en `instructions/` se cargan automáticamente cuando ejecutas cualquier tarea. Las convenciones se aplican a:

- `app.instructions.md` → sobre `src/Domains/**` (tareas de frontend)
- `memory.instructions.md` → sobre persistencia en todas las tareas

Modify instruction files directly; no need to restart OpenCode.
