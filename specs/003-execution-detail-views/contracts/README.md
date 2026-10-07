# Contracts — Detalle de ejecución de agentes

Esta feature es una SPA de **solo lectura** y no expone API pública. Sus contratos son las **interfaces internas estables** que fijan el comportamiento de las siete historias: los métodos de lectura del wrapper del SDK, las funciones puras de `lib/`, las props de los componentes y las reglas de los hooks de vista.

| Contrato | Archivo | Qué fija |
|----------|---------|----------|
| Lectura del SDK | [client-read-contract.md](./client-read-contract.md) | métodos de solo lectura de `opencodeClient.ts`, paginación por cursor y tipos normalizados |
| Estado de ejecución | [execution-state-contract.md](./execution-state-contract.md) | `TNodeStatus` (9 estados), `toNodeStatus()`, `isActiveStatus()`, señales y FR-020 |
| Histórico | [history-contract.md](./history-contract.md) | `buildHistory()`, `THistoryEntry`, paginación progresiva, linaje y ciclo del overlay |
| Texto enriquecido | [rich-text-contract.md](./rich-text-contract.md) | `RichText`, saneado y toggle de razonamiento (FR-001/002/005/006/007) |
| Detalle del agente | [inspector-detail-contract.md](./inspector-detail-contract.md) | respuestas, archivos, permisos/preguntas/cola, mediana de herramientas |
| Resumen de sesión | [session-summary-contract.md](./session-summary-contract.md) | `summarizeSession()` ampliado y `SessionSummaryBar` |

Reglas transversales (Constitución):
- El SDK se invoca **solo** desde `Infrastructure/Services/opencodeClient.ts` (III); ningún componente lo llama.
- Solo se usan endpoints de lectura; no se envían prompts, no se aborta, no se responden permisos ni formularios (I, FR-037).
- Los datos crudos usan tipos `T` derivados del SDK (IV); los view-models nuevos son estado de vista con prefijo `T`.
- Las funciones de `lib/` son puras y sin React (V).
- Las vistas conservan error → loading → vacío → datos (VI) y no relayoutan el grafo por eventos de estado (VII).
- No se procesan deltas de texto (`session.text.delta`/`reasoning.delta`/`tool.input.delta`); solo texto consolidado (VII, FR-005).
- Specs en `specs/` junto al código (VIII).
