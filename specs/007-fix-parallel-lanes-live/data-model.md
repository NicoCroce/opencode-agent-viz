# Data Model — Filas paralelas correctas en el grafo en vivo

**Feature**: `007-fix-parallel-lanes-live`
**Date**: 2026-10-08
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)

Este documento describe las entidades de vista que intervienen en el agrupamiento de filas y el badge de paralelismo. **No hay entidades de servidor nuevas** (regla de solo lectura, Principio I). Los datos crudos siguen siendo tipos del SDK (`SessionInfo`, `SessionStatus`, `V2Event`) y **no se redefinen** (Principio IV). Convención de nombres: `T` para tipos de vista (`AGENTS.md`, `Graph.entity.ts`).

---

## 1. Entidades de dominio (ya existen; se precisan)

### 1.1 Nodo de agente (`TGraphNodeData`) — sin cambios de forma
Campos relevantes para el agrupamiento (sin cambio de significado):
| Campo | Tipo | Origen |
|-------|------|--------|
| `createdAt` | `number \| null` | `SessionInfo.time.created` |
| `updatedAt` | `number \| null` | **`max(SessionInfo.time.idle ?? time.updated ?? 0, activity[sessionId] ?? 0)`** (antes solo la lista) |
| `status` | `TNodeStatus` | `toNodeStatus(...)`; activo = `isActiveStatus` |
| `metrics.endedAt` | `number \| null` | fin real derivado de mensajes (fallback de `updatedAt`) |
| `parallel` | `TNodeParallelism \| null` | badge; se recalcula con los mismos grupos que las filas |

**Cambio**: solo el **valor** de `updatedAt` (fuente ampliada con la marca de actividad). La forma de `TGraphNodeData` no cambia.

### 1.2 Sesión (`SessionInfo`) — reutilizada
Fuente: `queryKeys.sessions.roots(directory)` (listado) y `queryKeys.sessions.children(parentID)` / subárbol bajo demanda (grafo). *(Actualización 011: antes `queryKeys.sessions.list(directory)`.)* Aporta `time.created`, `time.updated`, `time.idle`, `parentID`, `location.directory`. Sin cambios de forma.

### 1.3 Grupo de paralelismo (`TParallelGroup`) — sin cambios de forma
`{ id, parentId, nodeIds, startedAt, endedAt }`. Se genera con `deriveInvocationBatches` (unidad = **invocación**) y, en respaldo estructural, con `deriveSiblingBatches` sobre el **intervalo de ejecución** (abierto para activos). El badge usa `TNodeParallelism = { groupId, size }`. *(Actualización 011: la unidad de agrupamiento pasa de sesión a invocación.)*

---

## 2. Entidades nuevas / precisadas

### 2.1 Marca de actividad (`TActivityMap`)
| Campo | Tipo | Regla |
|-------|------|-------|
| `[sessionID]` | `number` | Última actividad observada (ms), `max` acumulado; nunca retrocede. |

- **Clave**: `queryKeys.sessions.activity(): ['sessions','activity']`.
- **Fuente**: `event.created` de todo evento con `sessionID`, aplicado por `reduceActivity(event)` desde `applyReducedEvent`.
- **Relación**: `updatedAt` del nodo = `max(lista, marca de actividad)`.
- **Estado de vista**: no se envía al servidor ni se persiste; se pierde al recargar (la lista lo reconstruye).

### 2.2 Intervalo de ejecución (precisado)
Definido en `lib/execution/nodeInterval.ts`:
| Función | Firma | Regla |
|---------|-------|-------|
| `startOf` | `(node) => number` | `createdAt ?? metrics.startedAt ?? 0` |
| `endOf` | `(node, now) => number` | activo → `now`; terminado → `updatedAt ?? metrics.endedAt ?? now` |
| `nodeInterval` | `(node, now) => [number, number]` | `[startOf, max(startOf, endOf)]` (clamp) |
| `executionInterval` | `(node) => [number, number]` | **solape**: inicio `startOf`; fin `+∞` si activo, `endOf(node, 0)` si terminado; clamp |

**"Activo"** = `isActiveStatus(node.data.status)` ∈ {`running`, `retrying`, `compacting`, `waiting-permission`, `waiting-input`}. La apertura **nunca** se infiere de datos ausentes (FR-011).

### 2.3 Clave de ejecución (`TExecutionKey` = `string`)
Salida pura de `deriveExecutionKey(model, batches?)`:
```
topologySignature(model) + '|' + nodos.map(n => `${n.id}:${startOf(n)}:${isActiveStatus(n.status) ? 'open' : (n.updatedAt ?? n.metrics.endedAt ?? 0)}`).sort().join('|') + '|' + firmaDeLotes(batches)
```
- `firmaDeLotes` = `stepId:parentId:miembro+miembro` por lote, ordenada: distingue lotes aunque cambien solo los miembros (R8). *(Actualización 011: sin ella, al llegar los mensajes del padre el memo no se invalidaría y las filas no cambiarían.)*
- Cambia **solo** cuando cambia la topología, la clase/borde de intervalo de algún nodo o la **firma de lotes**.
- Es la clave de memo del plan de filas/columnas y del paralelismo (FR-003, FR-007).
- Determinística y sin reloj.

### 2.4 Plan de ejecución (`TExecutionPlan`) — sin cambios de forma
`{ levels, levelByNode, columnByNode, width }` (006). `levels[].parallel` es `true` si el nivel sale de un lote **paralelo** (2+ miembros de `deriveExecutionBatches`: mismo paso del padre, o 2+ hermanos solapados en el respaldo) —el mismo predicado que el badge, luego la paridad fila ↔ badge es estructural—. Se calcula con `deriveExecutionLevels(model, now, batches?)`; tras R1 el **agrupamiento** ya no depende de `now` (solo las ventanas `startedAt`/`endedAt` mostradas). *(Actualización 011.)*

### 2.5 Layout de ejecución (`TExecutionLayout`)
Salida pura de `deriveExecutionLayout(model, now, batches?)`:
| Campo | Tipo | Regla |
|-------|------|-------|
| `plan` | `TExecutionPlan` | niveles/columnas del modelo (lotes de invocación o respaldo) |
| `positions` | `Record<string, {x,y}>` | `layoutExecution(model, plan)` indexado |
| `parallelGroups` | `TParallelGroup[]` | `deriveParallelGroups(model, now, batches)` |
| `parallelByNode` | `Record<string, TNodeParallelism>` | `toParallelByNode(parallelGroups)` |
| `graph` | `TGraphModel` | modelo con posiciones y `data.parallel` aplicados (`assembleStructuralGraph`) |

---

## 3. Relaciones

```text
V2Event (SSE, batching)
  └── reduceActivity(event) ──► sessions.activity() [TActivityMap]   (max por sessionID)
                                        │
SessionInfo (lista cacheada) ───────────┤
  └── toGraphNode: updatedAt = max(time.idle ?? time.updated, activity[id])
        └── buildStructuralModel ──► TGraphModel (estructura, EMPTY_METRICS)
              ├── useGraphStructure: plan estructural (clave de ejecución)      [primera pintura]
              └── useGraphEnrichment ──► TGraphModel enriquecido (estados finales)
                    └── useInvocationBatches ──► TInvocationBatch[] (mensajes del padre en caché, sin consultas nuevas)
                    └── useGraphModel
                          ├── deriveExecutionKey(enriched, batches) ──► memo del plan
                          ├── deriveExecutionLayout(enriched, now, batches)
                          │     ├── deriveExecutionLevels (lotes de invocación; respaldo por executionInterval)
                          │     ├── layoutExecution (posiciones)
                          │     └── deriveParallelGroups → toParallelByNode (badge)
                          └── tick de 1 s (durationMs) sobre el grafo posicionado
```

---

## 4. Reglas de validación / invariantes

1. **Rango dentro de un paso (FR-001)**: dos invocaciones comparten lote si pertenecen al mismo paso del padre (`stepId`); en respaldo estructural, dos hermanos comparten grupo si sus `executionInterval` solapan (solape transitivo por union-find). Activo → `+∞`. *(Actualización 011: unidad = invocación.)*
2. **Apertura explícita (FR-002, FR-011)**: el fin abierto aplica **solo** a `isActiveStatus`; un terminado usa `updatedAt ?? metrics.endedAt`; nunca se infiere apertura de datos ausentes.
3. **Recálculo (FR-003)**: el plan se recalcula cuando cambia `deriveExecutionKey` (topología o clase/borde de intervalo), no por tick ni por eventos no estructurales (FR-007, SC-004).
4. **Paridad en vivo/refresco (FR-004, SC-002, SC-005)**: con la marca de actividad, los terminados conservan el mismo fin que reporta el servidor al reabrir; los activos son abiertos en ambos casos → misma disposición.
5. **Filas distintas para no solapados (FR-005)**: intervalos disjuntos → grupos distintos; el orden temporal (antes arriba) lo fija `deriveExecutionLevels` (orden por inicio). La unidad es la **invocación**: dos pasos secuenciales de un mismo padre no se fusionan. *(Actualización 011.)*
6. **Orden determinista (FR-006)**: columnas dentro de un nivel por `startOf`; desempate por `id`; niveles por inicio. Sin `Date.now()`.
7. **Badge = fila (FR-010)**: `data.parallel` se deriva de los mismos lotes que asignan los niveles (invocación si existe, solape de sesión si no); la barra del nodo no se unifica con la ventana de la invocación. *(Actualización 011.)*
8. **Frescura (FR-009)**: `reduceActivity` toma el `max` y se aplica por lotes; la marca nunca retrocede ni adelanta respecto del evento.
9. **Puro/testeable (FR-008)**: `startOf`, `endOf`, `executionInterval`, `deriveExecutionKey`, `deriveExecutionLayout`, `reduceActivity`, `setActivity` son puras, sin React y sin reloj implícito en el agrupamiento.

---

## 5. Qué NO cambia (fronteras del modelo)

- `TNodeStatus`, `TTokenUsage`, `TNodeMetrics`, `TExecutionSignal`, `TParallelGroup`, `TNodeSizeOverride`, `TGraphModel`, `TGraphNodeData`: **sin cambios de forma** (solo el valor de `updatedAt`).
- Contrato de `reduceEvent`: **sin cambios** (la actividad se compone aparte en `applyReducedEvent`).
- Tipos crudos del SDK: sin cambios ni redefiniciones (Principio IV).
- Claves de consulta existentes: sin cambios; solo se **añade** `sessions.activity()`.
- Modelo de datos del servidor y UI visual: fuera de alcance.
