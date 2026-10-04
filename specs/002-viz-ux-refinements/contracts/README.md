# Contracts — Refinamientos de experiencia del visor

Esta feature es una SPA de solo lectura y **no** expone API pública. Sus contratos son las **interfaces internas estables** que fijan el comportamiento de las cinco mejoras, tanto en las funciones puras (`lib/`) como en las props de los componentes y los hooks de vista.

| Contrato | Archivo | Qué fija |
|----------|---------|----------|
| Vista del grafo | [graph-view-contract.md](./graph-view-contract.md) | `buildChain()`, `layoutChain()`, `reduceNodeOverrides()`, `useNodeResize()`, `useChainSelection()`, props de `AgentGraph`/`AgentNode` |
| Inspector | [inspector-contract.md](./inspector-contract.md) | `useToolHistory()`, límite de 10 y control de expansión de `ToolHistory` |
| Tarjeta de sesión | [session-card-contract.md](./session-card-contract.md) | orden título/agente, fallback "agente no disponible" y rango horario |
| Rango horario | [time-range-contract.md](./time-range-contract.md) | `formatTimeRange()`, reglas de "en curso" y "no disponible" |

Reglas transversales (Constitución):
- El SDK se invoca **solo** desde `*.service.ts` (III); esta feature no añade llamadas.
- Los datos crudos usan tipos `T` derivados del SDK (IV); los tipos nuevos son estado de vista.
- Las funciones de `lib/` son puras y sin React (V).
- Las vistas conservan error → loading → vacío → datos (VI) y no relayoutan el grafo por eventos de estado (VII).
- La aplicación sigue siendo de solo lectura (I, FR-019).
