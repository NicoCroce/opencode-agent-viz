# OpenCode Agent Viz — Documentación

> Observabilidad en tiempo real para ejecuciones multi-agente de OpenCode, y la
> metodología **SDD · SddOrch** con la que se construye. Este README es el
> **índice maestro** de toda la documentación del repositorio y su **glosario**.

**English:** [README.en.md](README.en.md)

## Empezar rápido

Requisitos: **Node 22+**, **pnpm 9+**, **OpenCode 2.0.22+**.

```bash
pnpm install
opencode service status   # el background service debe estar corriendo
pnpm start                # descubre URL + password y levanta el visor
```

Guía completa en [Producto → Visión general](docs/es/product/01-overview.md) y
[Cómo funciona](docs/es/product/05-how-it-works.md).

---

## Mapa de la documentación

### 1. Documentación de producto (el visor)

| Doc | Qué encontrarás |
|---|---|
| [Visión general](docs/es/product/01-overview.md) | Qué es, para quién, beneficios clave y quickstart |
| [Propuesta de valor](docs/es/product/02-value-proposition.md) | Problema, solución, diferenciadores y audiencias |
| [Bondades y beneficios](docs/es/product/03-benefits.md) | Cada bondad en formato qué es → por qué sirve → qué evita |
| [Casos de uso](docs/es/product/04-use-cases.md) | Siete escenarios reales de uso |
| [Cómo funciona](docs/es/product/05-how-it-works.md) | Arquitectura, conexión, flujo de datos, stack y comandos |
| [FAQ](docs/es/product/06-faq.md) | Dudas y objeciones frecuentes |

### 2. Metodología SDD · SddOrch

| Doc | Qué encontrarás |
|---|---|
| [Visión general](docs/es/sdd/01-overview.md) | El modelo, las tres rutas, los modos Plan/Auto y las ventajas |
| [Fases y compuertas](docs/es/sdd/02-phases.md) | Descubrimiento, cada fase, dónde corre y qué compuerta la protege |
| [Descubrimiento: researchers y writer](docs/es/sdd/03-discovery.md) | Roles, investigadores, PRD/RFC y sus ventajas |
| [Subagentes y contrato](docs/es/sdd/04-subagents.md) | Catálogo, permisos de mínimo privilegio y contrato de retorno |
| [Planificación de tandas](docs/es/sdd/05-scheduling.md) | Tandas, `[P]`, archivos compartidos y verificación de alcance |
| [Auto-aprendizaje](docs/es/sdd/06-auto-learning.md) | Señales de harness: el ciclo de mejora continua |
| [Memoria y reanudación](docs/es/sdd/07-memory.md) | Claves de Engram, punteros y cómo se reanuda un flujo |
| [Catálogo de skills](docs/es/sdd/08-skills.md) | Skills propias y de terceros: propósito, origen y licencias |
| [Roles del descubrimiento](docs/es/sdd/09-roles.md) | Las seis disciplinas: propósito, agente y skills |
| [FAQ](docs/es/sdd/10-faq.md) | Dudas frecuentes del modelo |

**English mirror:** [docs/en/](docs/en/) — [product](docs/en/product/01-overview.md) · [sdd](docs/en/sdd/01-overview.md).

### 3. Referencia técnica y del harness

| Recurso | Qué contiene |
|---|---|
| [AGENTS.md](AGENTS.md) | Convenciones y flujo de desarrollo del proyecto |
| [.opencode/README.md](.opencode/README.md) | Índice de la configuración del harness (agentes, skills, scripts) |
| [app.instructions.md](.opencode/instructions/app.instructions.md) | Convenciones de frontend por dominios (se aplica a `src/Domains/**`) |
| [memory.instructions.md](.opencode/instructions/memory.instructions.md) | Reglas de memoria de SddOrch en Engram |
| [sddorch-contract.md](.opencode/instructions/sddorch-contract.md) | Contrato de retorno de los subagentes |
| Agentes: [sddorch](.opencode/agents/sddorch.md) · [researcher-code](.opencode/agents/sddorch-researcher-code.md) · [researcher-market](.opencode/agents/sddorch-researcher-market.md) · [writer](.opencode/agents/sddorch-writer.md) · [implementer](.opencode/agents/sddorch-implementer.md) · [reviewer](.opencode/agents/sddorch-reviewer.md) · [tester](.opencode/agents/sddorch-tester.md) · [release](.opencode/agents/sddorch-release.md) | Definición de cada agente y sus permisos |
| Roles: [`.opencode/roles/`](.opencode/roles/) | Perfiles de disciplina (product, ux, security, performance, quality, accessibility) |
| Templates: [`.opencode/templates/discovery/`](.opencode/templates/discovery/) | Plantillas de PRD y RFC |
| [Skills](.opencode/skills/README.md) | Propias: [front-ddd-generator](.opencode/skills/front-ddd-generator/SKILL.md) · [test-generator](.opencode/skills/test-generator/SKILL.md) · [code-reviewer](.opencode/skills/code-reviewer/SKILL.md) · [commit-conventions](.opencode/skills/commit-conventions/SKILL.md) · [pr-detail](.opencode/skills/pr-detail/SKILL.md) · [progress-tracker](.opencode/skills/progress-tracker/SKILL.md). De terceros: `vercel-react-best-practices`, `owasp-security-check`, `test-driven-development`, `a11y-*`, `pm-*` (ver índice) | Guías reutilizables del harness |
| `.opencode/commands/speckit.*` | Comandos de Spec-Kit (analyze, checklist, clarify, constitution, converge, implement, plan, specify, tasks, taskstoissues) |
| [.specify/memory/constitution.md](.specify/memory/constitution.md) | Principios innegociables I–VIII del proyecto |

### 4. Especificaciones por feature

Artefactos Spec-Kit (`spec.md`, `plan.md`, `tasks.md`, `research.md`,
`data-model.md`, `contracts/`) por feature:

| Feature | Título |
|---|---|
| [001-agent-viz-observability](specs/001-agent-viz-observability/spec.md) | Observabilidad multi-agente |
| [002-viz-ux-refinements](specs/002-viz-ux-refinements/spec.md) | Refinamientos de experiencia del visor |
| [003-execution-detail-views](specs/003-execution-detail-views/spec.md) | Detalle de ejecución de agentes |
| [004-inspector-panel-layout](specs/004-inspector-panel-layout/spec.md) | Reordenar y agrupar el panel de detalles |
| [005-session-filters](specs/005-session-filters/spec.md) | Filtros de proyecto y recencia en sesiones |
| [006-graph-render-performance](specs/006-graph-render-performance/spec.md) | Rendimiento del visualizador de grafo |
| [007-fix-parallel-lanes-live](specs/007-fix-parallel-lanes-live/spec.md) | Filas paralelas correctas en el grafo en vivo |
| [008-node-effort-inspector-ux](specs/008-node-effort-inspector-ux/spec.md) | Live node feedback, effort levels y UX del panel |

### 5. Documentación interna / histórica

Notas de trabajo y análisis que no forman parte de la doc pública:
[docs/internal/](docs/internal/) — plan técnico original, propuestas de refactor
y captura de datos del SDK.

---

## Glosario / diccionario

| Término | Definición | Dónde se profundiza |
|---|---|---|
| **SSE** | *Server-Sent Events*: stream `GET /event` de OpenCode que alimenta el visor en vivo. | [Cómo funciona](docs/es/product/05-how-it-works.md) |
| **Read-only** | Que el visor nunca escribe: no envía prompts, no aborta sesiones, no responde permisos. | [Propuesta de valor](docs/es/product/02-value-proposition.md) |
| **Dominio** | Módulo funcional en `src/Domains/` (Connection, Sessions, Graph, Inspector) con entity, service, routes, Components, Hooks y Pages. | [AGENTS.md](AGENTS.md) |
| **Tipo `T*`** | Tipo derivado del SDK de OpenCode (p. ej. `TSession`); prohíbe redefinir interfaces que el SDK ya exporta. | [app.instructions.md](.opencode/instructions/app.instructions.md) |
| **Query key** | Clave centralizada de TanStack Query que identifica cada caché de datos. | [AGENTS.md](AGENTS.md) |
| **SDD** | *Spec-Driven Development*: método donde el contrato (spec, plan, tasks) se escribe antes que el código. | [SDD → Visión general](docs/es/sdd/01-overview.md) |
| **Spec-Kit** | Conjunto de comandos, plantillas y scripts (`speckit.*`, `.specify/`) que SddOrch conduce sin modificar. | [Fases](docs/es/sdd/02-phases.md) |
| **SddOrch** | Agente orquestador que encadena las fases, delega en subagentes y guarda memoria. | [SDD → Visión general](docs/es/sdd/01-overview.md) |
| **Fase** | Cada paso del pipeline (`specify`, `plan`, `implement`…). | [Fases y compuertas](docs/es/sdd/02-phases.md) |
| **Compuerta** | Punto fijo de validación contra la constitución (`plan-check`, `code-review`) que puede devolver a la fase anterior. | [Fases y compuertas](docs/es/sdd/02-phases.md) |
| **Modo Plan** | Ejecución con compuertas al usuario tras `specify`, `clarify` y `plan`. | [SDD → Visión general](docs/es/sdd/01-overview.md) |
| **Modo Auto** | Ejecución sin compuertas; solo frena ante un bloqueo real. | [SDD → Visión general](docs/es/sdd/01-overview.md) |
| **Descubrimiento** | Etapa previa a Spec-Kit: researchers por rol + writer producen el PRD y el RFC. | [Descubrimiento](docs/es/sdd/03-discovery.md) |
| **Rol** | Disciplina del descubrimiento: product, ux, security, performance, quality, accessibility. | [Roles](docs/es/sdd/09-roles.md) |
| **`sddorch-researcher-code`** | Subagente de solo lectura que investiga un rol técnico con acceso al repo. | [Descubrimiento](docs/es/sdd/03-discovery.md) |
| **`sddorch-researcher-market`** | Subagente que investiga producto con web y sin acceso al código. | [Descubrimiento](docs/es/sdd/03-discovery.md) |
| **`sddorch-writer`** | Subagente que redacta el PRD y el RFC desde los informes en Engram. | [Descubrimiento](docs/es/sdd/03-discovery.md) |
| **Norte** | Documento de 5-8 líneas (problema, objetivo, no-objetivos, restricciones) que reciben todos los agentes. | [Descubrimiento](docs/es/sdd/03-discovery.md) |
| **Run (`<run>`)** | Identificador `<AAAAMMDD>-<slug>` de la ejecución en memoria; antecede a la feature. | [Memoria](docs/es/sdd/07-memory.md) |
| **PRD** | Documento de descubrimiento (qué y por qué), entrada de `specify`. | [Descubrimiento](docs/es/sdd/03-discovery.md) |
| **RFC** | Documento de descubrimiento (cómo y alternativas), entrada de `plan`. | [Descubrimiento](docs/es/sdd/03-discovery.md) |
| **Ruta rápida / nivel 1 / nivel 2** | Las tres rutas de ejecución según tamaño y riesgo. | [Visión general](docs/es/sdd/01-overview.md) |
| **Tanda** | Grupo de tareas que se ejecutan en paralelo sin escribir los mismos archivos. | [Planificación de tandas](docs/es/sdd/05-scheduling.md) |
| **`[P]`** | Marca de tarea paralelizable en `tasks.md`. | [Planificación de tandas](docs/es/sdd/05-scheduling.md) |
| **`SHARED_FILES`** | Archivos de conflicto (barrels, `queryKeys.ts`, lockfiles…) que van en una tanda de integración con un solo agente. | [Planificación de tandas](docs/es/sdd/05-scheduling.md) |
| **Verificación de alcance** | Comprobar con `git status` que un subagente escribió solo en sus `writes`. | [Planificación de tandas](docs/es/sdd/05-scheduling.md) |
| **`harness_signal`** | Reporte de una fricción del harness (faltó skill, instrucción, script…) que el orquestador acumula. | [Auto-aprendizaje](docs/es/sdd/06-auto-learning.md) |
| **Harness** | Conjunto de piezas que dan capacidades al agente: skills, instrucciones, subagentes, scripts y hooks. | [Auto-aprendizaje](docs/es/sdd/06-auto-learning.md) |
| **Engram** | Sistema de memoria persistente donde vive el estado de los flujos SDD. | [Memoria](docs/es/sdd/07-memory.md) |
| **`topic_key`** | Clave estable de memoria (`north`, `state`, `findings/<rol>`, `decision/<slug>`, `prd`, `rfc`, `run`, `harness-signal`) que actualiza en vez de duplicar. | [Memoria](docs/es/sdd/07-memory.md) |
| **Constitución** | Documento con los principios innegociables I–VIII del proyecto. | [constitution.md](.specify/memory/constitution.md) |
| **`plan-check`** | Compuerta que valida `plan.md` contra la constitución (flujo complejo). | [Fases y compuertas](docs/es/sdd/02-phases.md) |
| **`code-review`** | Compuerta que valida el código tras `converge`. | [Fases y compuertas](docs/es/sdd/02-phases.md) |
| **`verify`** | Fase que ejecuta `VERIFY_COMMANDS` (`lint`, `tsc`, `test`, `build`). | [Fases y compuertas](docs/es/sdd/02-phases.md) |
| **`release`** | Fase de cierre: commits, `pr-detail` y apertura del PR con confirmación. | [Fases y compuertas](docs/es/sdd/02-phases.md) |
| **Skill** | Guía reutilizable del harness (por ejemplo `test-generator`, `commit-conventions`). | [.opencode/skills/](.opencode/skills/) |

---

## Fuente de verdad

| Tema | Archivo que manda |
|---|---|
| Convenciones y flujo de desarrollo | [AGENTS.md](AGENTS.md) |
| Principios innegociables | [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| Convenciones de frontend | [app.instructions.md](.opencode/instructions/app.instructions.md) |
| Contrato de subagentes | [sddorch-contract.md](.opencode/instructions/sddorch-contract.md) |
| Reglas de memoria | [memory.instructions.md](.opencode/instructions/memory.instructions.md) |
| Definición de cada agente | [.opencode/agents/](.opencode/agents/) |

> **No se edita:** `.opencode/commands/speckit.*`, `.specify/scripts/`,
> `.specify/templates/` ni `.specify/memory/constitution.md`. Para cambiar la
> constitución se usa `/speckit.constitution`.

---

## Estado del proyecto

| Feature | Título | Carpeta |
|---|---|---|
| 001 | Observabilidad multi-agente | [specs/001-agent-viz-observability](specs/001-agent-viz-observability/) |
| 002 | Refinamientos de experiencia del visor | [specs/002-viz-ux-refinements](specs/002-viz-ux-refinements/) |
| 003 | Detalle de ejecución de agentes | [specs/003-execution-detail-views](specs/003-execution-detail-views/) |
| 004 | Reordenar y agrupar el panel de detalles | [specs/004-inspector-panel-layout](specs/004-inspector-panel-layout/) |
| 005 | Filtros de proyecto y recencia en sesiones | [specs/005-session-filters](specs/005-session-filters/) |
| 006 | Rendimiento del visualizador de grafo | [specs/006-graph-render-performance](specs/006-graph-render-performance/) |
| 007 | Filas paralelas correctas en el grafo en vivo | [specs/007-fix-parallel-lanes-live](specs/007-fix-parallel-lanes-live/) |
| 008 | Live node feedback, effort levels y UX del panel | [specs/008-node-effort-inspector-ux](specs/008-node-effort-inspector-ux/) |
