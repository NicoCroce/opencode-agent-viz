# Data Model — Rendimiento del visualizador de grafo

**Feature**: `006-graph-render-performance`
**Date**: 2026-10-08
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)

Este documento describe las entidades de vista que intervienen en la optimización. **No hay entidades de servidor nuevas** (regla de solo lectura, Principio I; la spec excluye cambios en el modelo de datos de OpenCode). Las entidades de datos crudos siguen siendo tipos del SDK (`SessionInfo`, `SessionStatus`, `AgentInfo`, `SessionLogItem`, `FormInfo`/`FormDetail`, `PermissionRequest`, `SessionInboxInfo`) y **no se redefinen** (Principio IV).

Convención de nombres: `T` para tipos de vista (ver `AGENTS.md` y `Graph.entity.ts`).

---

## 1. Entidades de dominio (ya existen; se extienden)

### 1.1 Sesión (raíz)
- **Fuente**: `SessionInfo` (`@opencode/client`), ya cacheada en `queryKeys.sessions.list(directory)`.
- **Rol**: unidad que el usuario selecciona; origen del subárbol.
- **Campos relevantes**: `id`, `parentID`, `time.created`, `time.updated`, `time.idle`, `agent`, `title`, `location.directory`.
- **Cambios**: ninguno. La optimización **reutiliza** esta entidad ya cacheada para construir la estructura sin red adicional.

### 1.2 Subárbol de agentes
- **Tipo**: `SessionInfo[]` (salida de `filterSubtree`).
- **Regla**: BFS desde el id raíz siguiendo `parentID`; deduplicado por `seen`.
- **Cambio**: construcción con índice `byId: Map<string, SessionInfo>` en lugar de `sessions.find` dentro del bucle (R4) → de O(n²) a O(n).

### 1.3 Nodo de agente (`TGraphNodeData`) — **extendido**
Campos existentes (sin cambios de significado): `sessionId`, `title`, `createdAt`, `updatedAt`, `agentName`, `directory`, `model`, `status`, `retry`, `interruptReason`, `metrics`, `isRoot`, `currentTool`, `parallel`.

Nuevo campo:
| Campo | Tipo | Regla |
|-------|------|-------|
| `enrichment` | `TEnrichmentState` | Estado de carga del detalle (métricas/señales/permisos/formularios). `'pending'` al construir la estructura; `'ready'` cuando el enriquecimiento fusionó el resultado del lote. Nunca vuelve de `'ready'` a `'pending'` dentro de una misma visita (evita parpadeo); un refetch de datos por evento no lo degrada. |

**Invariante de paridad (FR-007)**: con `enrichment === 'ready'` para todos los nodos, `TGraphNodeData` es **campo a campo** igual al que produce hoy `buildGraph`. `enrichment` es el único campo añadido y es de estado de vista (no rompe la paridad visual: no se renderiza como dato de negocio).

### 1.4 Arista de invocación (`TGraphEdge`)
- Sin cambios: `id = "${parentID}->${childId}"`, `source`, `target`, `type: 'agent'`.
- **Regla de estabilidad**: el array de aristas se reutiliza mientras `topologySignature(model)` no cambie (R4).

### 1.5 Vista de grafo (`TGraphModel`)
- `{ nodes: TGraphNode[], edges: TGraphEdge[] }`.
- **Regla**: `reconcileGraphModel(prev, next)` preserva la identidad de nodos/aristas sin cambios para que `ReactFlow` y los componentes `memo` no re-rendericen de más.

### 1.6 Vista de nodo para React Flow (`TGraphViewNode`)
- Ya existe (`buildViewNodes.ts`): `Node<TGraphNodeData, 'agent'>` con `selected`, `width`, `height` y posición (override o layout).
- **Cambio**: `buildViewNodes` **ya** devuelve `height` calculado; el cambio es que `AgentGraph` reutiliza ese `node.height` (o el override) en vez de volver a llamar `cardHeight` (R4). La firma de `buildViewNodes` no cambia. El contenido visual no cambia.

---

## 2. Entidades nuevas (internas de la optimización)

### 2.1 Base de métricas (`TMetricBase`)
Resultado **independiente del reloj** de `deriveMetricBase`, memoizado por identidad de `messages`.

| Campo | Tipo | Origen |
|-------|------|--------|
| `startedAt` | `number \| null` | mínimo de `time.created` de mensajes assistant |
| `endedAt` | `number \| null` | máximo de `time.completed` de mensajes assistant |
| `cost` | `number \| null` | suma de `cost` (null si nunca se reportó) |
| `tokens` | `TTokenUsage \| null` | acumulado de `tokens`, con la misma regla `seen` actual |
| `retryCount` | `number` | mensajes con `retry` |
| `hasLoop` | `boolean` | `retryCount > 0` |
| `loopEvidence` | `string[]` | mensajes de error de retry |
| `model` | `ModelRef \| null` | primera respuesta assistant |
| `currentTool` | `TCurrentTool \| null` | último tool de la sesión |
| `lastAssistantErrored` | `boolean` | última respuesta assistant con error/tool fallido |

**Relación**: `resolveMetrics(base, status, now, subtaskInvocations) → TNodeMetrics` añade `durationMs` y el `retryCount` del `status` de retry. `TNodeMetrics` no cambia de forma.

**Firma y consumidores (sin romper interfaces)**:
- `deriveMetricBase(messages: TSessionMessageLike[]): TMetricBase` es posicional y **expone también** `model`, `currentTool` y `lastAssistantErrored` (los consume `buildGraph` para `data.model`, `data.currentTool` y el cálculo de `hasError` → `lastAssistantErrored`); **no** forman parte de `TNodeMetrics`.
- `resolveMetrics(base: TMetricBase, status: SessionStatus | undefined, now: number, subtaskInvocations: number): TNodeMetrics` es posicional.
- `deriveMetrics(input: DeriveMetricsInput)` se conserva como **envoltorio de objeto equivalente** `{ messages, status, subtaskInvocations, now }` (la firma que ya usa `buildGraph`), que internamente compone `deriveMetricBase` + `resolveMetrics`. Así ningún consumidor cambia y la paridad se preserva.

### 2.2 Estado de enriquecimiento (`TEnrichmentState`)
- Valores: `'pending' | 'ready'`.
- **Transición**: `pending → ready` cuando el lote que contiene el id termina de fusionar sus fuentes. No hay `error` propio: un fallo de red deja el nodo en `pending` y el estado de error de pantalla lo gobierna `sessionsQuery` (FR-008), igual que hoy.
- **Estados durante la fase de estructura (`enrichment: 'pending'`)**: `useGraphStructure` solo dispone de `SessionStatus`, por lo que solo son **definitivos** los estados derivables de él en `toNodeStatus`: `running` (`status.type === 'busy'`), `retrying` (`status.type === 'retry'`) y `created` (sin actividad conocida). Los estados `compacting`, `waiting-permission`, `waiting-input`, `succeeded`, `failed` e `interrupted` requieren `compaction`/`outcome` (señal derivada de `session.log`), formularios, permisos o `hasActivity` (mensajes), que llegan con el enriquecimiento; hasta entonces son **provisionales** (se pinta el mejor estado derivable y se fija al pasar a `'ready'`). Por eso el spec de paridad (T034) contrasta **solo** nodos con `enrichment === 'ready'`.

### 2.3 Plan de carga (`TLoadPlan`)
Salida pura de `orderSubtreeForLoad` / `chunkLoadPlan`.

| Campo | Tipo | Regla |
|-------|------|-------|
| `orderedIds` | `string[]` | ids del subárbol ordenados por prioridad (raíz → ancestros del nodo activo/seleccionado → BFS por nivel de ejecución → resto por `time.created`) |
| `skippedIds` | `string[]` | ids ya `enrichment === 'ready'` (no se vuelven a cargar, SC-008) |

**Relación**: `TLoadPlan` es la salida de `orderSubtreeForLoad(subtree, options)`. El troceado en lotes **no** forma parte de `TLoadPlan`: lo produce `chunkLoadPlan(orderedIds, size)` (contrato de carga §2.2), que devuelve `string[][]`. Se mantiene así para que `TLoadPlan` coincida exactamente con el contrato (`{ orderedIds, skippedIds }`).

**Determinismo**: la función no usa `Date.now()` ni aleatoriedad; el orden depende solo de la topología, los tiempos de sesión y `activeIds`/`selectedId` recibidos. Testeable con fixtures.

### 2.4 Medición de rendimiento (`TGraphPerfMeasure`)
| Campo | Tipo | Regla |
|-------|------|-------|
| `name` | `'graph.session.open' \| 'graph.session.revisit' \| 'graph.interaction'` | constante de `PERF_METRIC` |
| `durationMs` | `number` | duración medida por la Performance API |
| `detail` | `Record<string, unknown> \| undefined` | p. ej. `{ nodeCount, enrichment }` (nunca contenido de mensajes) |

**Privacidad/paridad**: la medición no altera el render ni envía datos al server.

---

## 3. Relaciones

```text
SessionInfo (raíz, cacheada)
  └── filtroSubtree (BFS + índice) ──► SessionInfo[] (subárbol)
        ├── useGraphStructure ──► TGraphModel (estructura, EMPTY_METRICS, enrichment='pending')
        │      ├── topologySignature ──► memo del layout (deriveExecutionLevels/layoutExecution)   [sin cambios]
        │      └── reconcileGraphModel ──► identidad estable de nodos/aristas                       [nuevo]
        └── useGraphEnrichment
              ├── orderSubtreeForLoad + chunkLoadPlan ──► TLoadPlan
              ├── por id y por lote: messages/permissions/log/execution/forms/inbox (caché existente)
              ├── deriveMetricBase(messages) ──► TMetricBase (memo por identidad)
              └── resolveMetrics(base, status, now, subtaskInvocations) ──► TNodeMetrics + enrichment='ready'
```

---

## 4. Reglas de validación / invariantes

1. **Paridad (FR-007, SC-006)**: si todos los nodos están `ready`, el `TGraphModel` resultante es igual (campo a campo, con `enrichment` excluido) al del comportamiento actual. Se verifica con un spec de paridad sobre la fixture `run.ndjson`.
2. **Determinismo (FR-011, SC-001/SC-003)**: `orderSubtreeForLoad`, `chunkLoadPlan`, `deriveMetricBase`, `resolveMetrics`, `reconcileGraphModel` son puras y sin reloj implícito (el `now` se inyecta).
3. **Sin trabajo repetido (SC-008)**: un id con `enrichment === 'ready'` entra en `skippedIds` y no se vuelve a pedir en la misma visita.
4. **Frescura (FR-009)**: el enriquecimiento escribe en las **mismas claves** que parchea `eventReducer`; los eventos en vivo siguen ganando y el desfase se mantiene ≤ 1 s. Se verifica con un spec dedicado (mismas claves de `eventReducer`, FR-009 / criterio L9). El tick se desactiva cuando no hay ningún nodo activo **en ambos consumidores** —el `useNow` del modelo y el `useNow` del resumen de `WorkspacePage` (FR-024 de 003-execution-detail-views)—, lo que no cambia el dato mostrado.
5. **Identidad estable (FR-005, SC-004)**: `reconcileGraphModel` solo reutiliza un nodo si `id`, `position` y `data` (comparados campo a campo) no cambiaron; hover y selección **no** forman parte de `data` (van por `NodeFocusContext`), por lo que no provocan rebuild.
6. **Sin contenido no mostrado (SC-008)**: el enriquecimiento no descarga el histórico completo de cada agente; el histórico sigue cargándose bajo demanda en `History` (`useHistoryMessages`).
7. **Estados de pantalla (FR-008)**: `enrichment` no introduce un cuarto estado de pantalla; error/carga/vacío/datos siguen gobernados por `sessionsQuery`/`graph.nodes.length` en `WorkspacePage`.

---

## 5. Qué NO cambia (fronteras del modelo)

- `TNodeStatus`, `TTokenUsage`, `TNodeMetrics`, `TExecutionSignal`, `TParallelGroup`, `TNodeSizeOverride`: **sin cambios de forma**.
- Claves de consulta (`queryKeys.ts`): **sin cambios**.
- Tipos crudos del SDK: **sin cambios**; no se redefinen (Principio IV).
- Modelo de datos del servidor: fuera de alcance (spec).
