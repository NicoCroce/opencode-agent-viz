# Data Model — Refinamientos de experiencia del visor

**Feature**: `002-viz-ux-refinements`
**Date**: 2026-10-03
**Input**: [spec.md](./spec.md), [research.md](./research.md)

Esta feature no introduce datos del servidor nuevos ni backend: todos los tipos nuevos son **estado de vista local**. Se mantiene la convención `T` (Principio IV): los datos crudos siguen derivándose del SDK; los view-models nuevos viven en su dominio.

---

## 1. Datos del servidor ya existentes (reutilizados, sin cambios)

| Tipo `T` | Origen SDK | Campos usados por esta feature |
|----------|-----------|--------------------------------|
| `TSession` (`SessionInfo`) | `@opencode/client` | `id`, `parentID?`, `agent?`, `title?`, `time.created`, `time.updated`, `location.directory` |
| `TSessionStatus` (`SessionStatus`) | `@opencode/client` | `{type:'idle'}` \| `{type:'busy'}` \| `{type:'retry', attempt, message, next}` |
| `TNodeMetrics` | `Domains/Graph/Graph.entity.ts` | `startedAt`, `endedAt`, `durationMs` (para el rango) |
| `TGraphNode` / `TGraphEdge` / `TGraphModel` | `Domains/Graph/Graph.entity.ts` | topología del grafo (padre→hijo) |
| `TToolHistoryEntry` | `Domains/Inspector/Inspector.entity.ts` | `name`, `status`, `startedAt?`, `endedAt?` |

---

## 2. View-models nuevos

### 2.1 `TNodeSizeOverride` (Graph)

Tamaño/posición elegidos por el usuario para un nodo, **por sesión** y sin persistencia.

| Campo | Tipo | Regla |
|-------|------|-------|
| `width` | `number` | `>= MIN_NODE_WIDTH` (180) |
| `height` | `number` | `>= MIN_NODE_HEIGHT` (72) |
| `x` | `number \| undefined` | presente solo si el resize se hizo desde arriba/izquierda |
| `y` | `number \| undefined` | idem |

Almacenamiento: `Record<nodeId, TNodeSizeOverride>` en `useNodeResize(resetKey)`. Se vacía cuando cambia `resetKey` (id de sesión raíz) y no se escribe en `TGraphNodeData` ni en el servidor.

### 2.2 Cadena de ejecución (Graph) — sin tipo nuevo

La cadena es una **proyección** del grafo, no un view-model nuevo: se materializa como `TGraphModel` (ver la nota de reconciliación en [tasks.md](./tasks.md)).

| Salida | Tipo | Regla |
|--------|------|-------|
| `nodes` | `TGraphNode[]` | ancestros + nodo seleccionado, orden raíz→nodo |
| `edges` | `TGraphEdge[]` | aristas que conectan la cadena |

`buildChain(model, nodeId): TGraphModel | null` — `null` si `nodeId` no pertenece al modelo. `layoutChain(model)` asigna `x = index*(NODE_WIDTH + CHAIN_GAP)`, `y = 0`, respetando el orden recibido. Los ids en orden son derivables con `nodes.map(n => n.id)`, así que no se agrega un tipo extra.

Estado de selección asociado (`useChainSelection`):

| Campo | Tipo | Regla |
|-------|------|-------|
| `selectedNodeId` | `string \| null` | selección **explícita** del usuario; `null` = sin modo cadena |
| `isChainMode` | `boolean` | `selectedNodeId !== null` |
| `inspectedNodeId` | `string \| null` | `selectedNodeId ?? rootId` (lo que ve el inspector) |

### 2.3 `TToolHistoryView` (Inspector)

| Campo | Tipo | Regla |
|-------|------|-------|
| `visibleTools` | `TToolHistoryEntry[]` | `tools.slice(0, 10)` o todas si `isExpanded`; mismo orden cronológico |
| `hiddenCount` | `number` | `max(tools.length - 10, 0)` |
| `canExpand` | `boolean` | `tools.length > 10` (FR-011) |
| `isExpanded` | `boolean` | estado local del panel |
| `toggle` | `() => void` | alterna `isExpanded` |

Constante: `TOOL_HISTORY_LIMIT = 10` (fija, no configurable — Assumption de la spec).

### 2.4 `TTimeRangeInput` (Application/Helpers)

| Campo | Tipo | Regla |
|-------|------|-------|
| `startedAt` | `number \| null` | `null` → inicio "no disponible" |
| `endedAt` | `number \| null` | `null` y no en curso → fin "no disponible" |
| `isRunning` | `boolean` | `true` → fin "en curso" (ignora `endedAt`) |

`formatTimeRange(input): string` → `"HH:mm – HH:mm"`, `"HH:mm – en curso"` o con `"no disponible"`.

---

## 3. Relaciones

```text
TGraphModel ──buildChain(nodeId)──> TGraphModel (solo la cadena) ──layoutChain──> TGraphModel (una fila)
TGraphModel ──useNodeResize(resetKey)──> Record<nodeId, TNodeSizeOverride> ──merge──> nodos renderizados
TToolHistoryEntry[] ──useToolHistory──> TToolHistoryView ──> ToolHistory (UI)
(TSession | TNodeMetrics) ──formatTimeRange──> string ──> SessionCard / AgentNode
```

---

## 4. Reglas de validación

- El tamaño de un nodo es **por nodo y por sesión**: nunca se filtra a otra sesión (FR-003, edge case) y nunca se persiste entre recargas (Assumption).
- El modo cadena **no** altera el modelo base: `buildChain` es una proyección; salir restaura `graph.graph` sin recalcular dagre.
- Si el `nodeId` seleccionado no existe en el modelo (p. ej. cambió la sesión o se removió el nodo), `buildChain` devuelve `null` y la vista usa el grafo completo; no se renderiza un grafo vacío (edge case, FR-017).
- El historial **no** invierte el orden: las 10 visibles son las más antiguas del orden cronológico actual (clarificación Q4).
- `canExpand` es estrictamente `tools.length > 10`; con exactamente 10 no hay control (edge case).
- Un extremo horario faltante se muestra como `"no disponible"`, nunca como `0` ni en blanco (FR-016). Mientras corre, el extremo final es `"en curso"`, nunca una hora que cambia sola (clarificación Q2).
- Los view-models nuevos **no** se validan con Zod (son estado interno tipado); Zod se reserva a datos de usuario (Principio IV).
