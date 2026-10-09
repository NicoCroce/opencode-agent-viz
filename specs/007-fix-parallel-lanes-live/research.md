# Research — Filas paralelas correctas en el grafo en vivo

**Feature**: `007-fix-parallel-lanes-live`
**Date**: 2026-10-08
**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

La spec está cerrada con clarificaciones (checklist de requisitos al 100 %): **no quedan `NEEDS CLARIFICATION`**. Este documento resuelve las decisiones técnicas de implementación apoyándose en código existente del dominio `Graph`. **No se añaden dependencias**, **no se añade red** y **no cambia el contrato del SDK**.

---

## Diagnóstico verificado (base de las decisiones)

1. **Marca de actividad congelada en vivo** — `graphBuild/toGraphNode.ts:82` fija `updatedAt = session.time.idle ?? session.time.updated` leyendo `queryKeys.sessions.list(directory)`. `eventReduce/slices/sessionLifecycle.ts` y `slices/execution.ts` parchean `sessions.status()` y `sessions.execution(id)` para `session.status`/`session.idle`/actividad, pero **no** la lista de sesiones; solo `session.created`/`renamed`/… la invalidan (`invalidateSessionLists`). En vivo `updatedAt` queda junto a la creación.
2. **Solape con intervalos puntuales** — `parallelism.ts` (`overlaps`) y `execution/nodeInterval.ts` comparan `[createdAt, updatedAt]`. Dos hermanos creados con segundos de diferencia y con `updatedAt ≈ createdAt` son intervalos puntuales disjuntos → filas distintas. Al refrescar, `time.updated`/`time.idle` reales → solapan → misma fila.
3. **Reloj estructural congelado** — `useGraphStructure.ts:73` captura `now` al montar; el layout (`deriveExecutionLevels`) y el paralelismo (`deriveParallelGroups`) lo usan como fallback de fin ausente. Aunque el estado activo debería ser "abierto hasta ahora", el `now` observado no avanza.
4. **Lógica de intervalos duplicada** — `parallelism.ts` define su propio `intervalOf` (inicio con fallback `now`), divergente de `execution/nodeInterval.ts` (inicio con fallback `0`, clamp `Math.max`). Filas y badge pueden no coincidir (FR-010).
5. **Memo del layout solo por topología** — `useGraphStructure.ts:90-102` memoiza `executionPlan`/`positions` por `topologySignature` (ids+aristas). Un cambio del conjunto en curso o de los bordes de intervalo no recalcula las filas (FR-003).

---

## R1. Intervalo abierto para estados activos (FR-002, FR-011, FR-010)

**Decision**: Unificar la semántica de intervalo en `execution/nodeInterval.ts` y usarla desde `parallelism.ts`:

- `startOf(node)` — sin cambios: `createdAt ?? metrics.startedAt ?? 0`.
- `endOf(node, now)` — **activo → `now`**; terminado → `updatedAt ?? metrics.endedAt ?? now`. "Activo" es `isActiveStatus(node.data.status)` (`running`/`retrying`/`compacting`/`waiting-permission`/`waiting-input`); la apertura **nunca** se infiere de datos ausentes (FR-011).
- `executionInterval(node)` (para **solape**) — inicio `startOf`; fin `+∞` si activo, `endOf(node, now)` si terminado; clamp `Math.max(inicio, fin)`.
- `parallelism.ts` elimina su `intervalOf` privado y consume `executionInterval`/`nodeInterval` (fin del fallback divergente de inicio).

**Rationale**:
- Tratar el activo como **abierto hasta el presente** es lo que pide el clarify. Para el **solape**, modelar la cota superior como `+∞` es equivalente a evaluar en cualquier `now ≥ max(inicio)`: un nodo terminado solapa a un activo si y solo si su fin es posterior al inicio del activo, que es exactamente la condición con `now` real. Esta equivalencia **elimina el reloj del agrupamiento** (Principio V) y, con él, la sensibilidad al `now` congelado del punto 3.
- Dos hermanos activos siempre solapan (ambos terminan en `+∞`) → misma fila, sin depender de cuándo se creó cada uno ni de si la marca se refrescó.
- Un solo intervalo compartido garantiza que el badge (`deriveParallelGroups`) y las filas (`deriveSiblingBatches`) sean consistentes (FR-010).

**Alternatives considered**:
- **Pasar un `now` vivo y usarlo como cota**: descartado; reintroduce dependencia del reloj en el agrupamiento y obliga a recalcular por tick para no quedar desfasado.
- **Inferir "abierto" cuando falta `updatedAt`/`endedAt`**: descartado; viola FR-011 (no inferir de datos ausentes) y confunde terminado-sin-marca con activo.
- **Heurística de "casi al mismo tiempo" (umbral de ms)**: descartada por la spec (Edge Cases: debe usarse el solape real).

---

## R2. Frescura de la marca de actividad (FR-009, SC-002, SC-005)

**Decision**: Mantener fresca la última actividad con un **mapa global** análogo al de estados:

- Nueva clave `queryKeys.sessions.activity(): ['sessions','activity']` → `TActivityMap = Record<string, number>`.
- Función pura `setActivity(prev, sessionID, at)` que toma el **máximo** (`Math.max(prev[id] ?? 0, at)`) para nunca retroceder.
- Función pura `reduceActivity(event)` que devuelve un `TQueryUpdate` (`set` sobre `activity`) con `event.created` para todo evento con `sessionID` (mensajes, ejecución/retry/compaction, ciclo de vida/status/idle, permisos, inbox/forms **y deltas** de texto/reasoning/tool/compaction, de los que solo se toma la marca temporal); `null` para eventos sin sesión (`server.connected`).
- `Infrastructure/lib/applyReducedEvent.ts` aplica `reduceActivity` **antes** de `reduceEvent` (mismo `setQueryData`, mismo batching de `EventStreamProvider`, **sin red**).
- `graphBuild/toGraphNode.ts` calcula `updatedAt = max(session.time.idle ?? session.time.updated ?? 0, activity[session.id] ?? 0)` (`null` si queda `0`). `buildGraph`/`buildStructuralModel` reciben `activity?` (opcional, compatibilidad).

**Rationale**:
- Es la lectura literal del clarify: "parchear la marca de última actividad en la caché de sesiones con los eventos, aprovechando el batching existente (sin red adicional)".
- Un mapa global por `sessionID` es el patrón ya usado por `sessions.status()`; los eventos de V2 **no traen `directory`**, y la lista está indexada por directorio (`sessions.list(directory)`), por lo que no se puede parchear la lista sin conocer el directorio. El mapa evita recorrer todas las listas y es honesto respecto de la información disponible.
- Al pasar por `applyReducedEvent` y no por `reduceEvent`, se preserva el contrato de `reduceEvent` (sus specs no cambian) y se centraliza la cobertura de eventos en una sola función pura testeable.
- Con la marca fresca, un nodo terminado durante el vivo conserva un **fin real** que coincide con `time.idle`/`time.updated` que reporta el servidor al reabrir → paridad (SC-002/SC-005).

**Alternatives considered**:
- **Invalidar/refetch la lista de sesiones por cada evento**: descartado; contradice "sin red adicional" y provocaría refetch por evento.
- **Nuevo `TQueryUpdate` de prefijo (`setQueriesData`) sobre todas las listas**: descartado; cambia el contrato de `TQueryUpdate`/`applyReducedEvent` y sigue sin poder asignar el directorio correcto desde el evento.
- **Derivar el fin solo de `metrics.endedAt` del enriquecimiento**: descartado como fuente principal; el enriquecimiento es progresivo y `endedAt` (máximo `time.completed` de mensajes assistant) no siempre coincide con la actividad de estado/tool. Se conserva como fallback.

---

## R3. Recálculo por clave de ejecución (FR-003, FR-007, SC-004)

**Decision**: Sustituir la clave de memo `topologySignature` por una **clave de ejecución** que captura todo lo que afecta al agrupamiento:

```ts
// lib/execution/executionKey.ts (puro)
deriveExecutionKey(model): string
// = topología (ids+aristas) + por nodo: `${id}:${startOf(n)}:${activo ? 'open' : finSinReloj(n)}`
```

- `finSinReloj(n) = updatedAt ?? metrics.endedAt ?? 0` para nodos terminados (determinístico).
- El plan (`deriveExecutionLevels`), las posiciones (`layoutExecution`) y los grupos (`deriveParallelGroups` → `toParallelByNode`) se memoizan sobre `deriveExecutionKey(model)`.

**Rationale**:
- El agrupamiento ahora depende solo de topología + clase de intervalo + bordes reales; la clave cambia **exactamente** cuando eso cambia (un hermano aparece, uno pasa de activo a terminado, o cambia el fin real de un terminado) → FR-003.
- Eventos de contenido/estado no estructurales no alteran la clave → 0 saltos de fila (FR-007/SC-004). El tick de 1 s no altera la clave → sin re-layout por tick.
- Es una función pura y determinista (sin `Date.now()`), testeable con fixtures.

**Alternatives considered**:
- **Recalcular por `now` (deps `[model, now]`)**: descartado; relayout por tick.
- **Incluir `now` en la clave**: descartado por lo mismo.
- **Mantener `topologySignature`**: descartado; no reacciona a la transición activo→terminado (FR-003).

---

## R4. Plan autoritativo desde el modelo enriquecido (FR-011, FR-010)

**Decision**: Extraer una función pura y componerla donde estén los **estados finales**:

- `lib/execution/deriveExecutionLayout.ts` (puro): `deriveExecutionLayout(model, now) → { graph, plan, parallelGroups, parallelByNode }`, reutilizando `deriveExecutionLevels` + `layoutExecution` + `assembleStructuralGraph` + `deriveParallelGroups` + `toParallelByNode`.
- `useGraphStructure` sigue devolviendo su plan estructural (compatibilidad de su API interna y primera pintura), calculado con la misma lógica (intervalo abierto + clave de ejecución).
- `useGraphModel` recalcula el plan/paralelismo autoritativo sobre el modelo **enriquecido** (`enriched`, que ya incluye `compacting`/esperas como estados activos definitivos), memoizado por `deriveExecutionKey(enriched)`, y usa `now` vivo (`useNow({ enabled: hasActiveNode })`) leído vía ref para las ventanas de tiempo. Devuelve ese `executionPlan`/`parallelGroups`.

**Rationale**:
- La fase estructural solo conoce `SessionStatus` (`running`/`retrying`/`created`); `compacting`/esperas se fijan en el enriquecimiento (006, data-model §2.2). Para respetar "activo = running/retrying/compacting/esperas" (clarify) el agrupamiento debe ver los estados finales.
- Mantener el plan estructural evita cambiar la firma interna de `useGraphStructure` y preserva el primer pintado; el plan enriquecido es el que se observa (mismo commit tras el primer lote).
- Filas y badge salen del mismo `deriveExecutionLayout` → FR-010.

**Alternatives considered**:
- **Mover todo el layout a `useGraphModel` y vaciar `useGraphStructure`**: descartado; cambia su contrato interno y añade churn a specs por un beneficio nulo (el plan estructural es barato y puro).
- **Que `useGraphStructure` lea señales/formularios/permisos de la caché**: descartado; rompe la garantía L4 de 006 (la estructura no consulta contenido) y no sería reactivo.

---

## R5. Alcance y no-cambios (Principios I/III/VII)

**Decision**: La feature **no** toca: `Infrastructure/Services/opencodeClient.ts` (firma de `OpenCodeService`), `EventStreamProvider` (batching, reconexión, poll de activas), `reduceEvent` (contrato y sus specs), `layoutGraph.topologySignature`, `buildViewNodes`, `AgentNode`/`AgentHeader`/`ExecutionLanes`/`GutterNode` (markup), `SessionSummaryBar`, `History`/`Inspector`, ni el modelo visual del nodo. Tampoco migra el render ni añade dependencias.

**Rationale**: La spec acota el arreglo a filas + badge de paralelismo; mantener intactos los contratos de datos, de eventos y de render protege la paridad y minimiza el riesgo de regresión.

**Alternatives considered**:
- **Cambiar el batching o reconectar el stream**: descartado; fuera de alcance y ya resuelto en 006.
- **Refrescar la lista de sesiones con un poll**: descartado; red adicional y contradice el clarify.

---

## R6. Seed de la marca de actividad al (re)conectar (edge case de reconexión)

**Decision**: Opcional (no bloqueante): al conectar/reconectar, además de invalidar las listas (`handleReconnected`) y sembrar estados (`useActiveSessionsSeed`), sembrar `activity[id] = now` para las sesiones activas del snapshot. Con eso, una sesión activa que no haya emitido actividad desde la conexión igual se considera abierta (por estado) y su marca no queda atrás.

**Rationale**: Refuerza el edge case "Reconexión del stream: la disposición no debe degradarse respecto de antes de la desconexión". El agrupamiento de activos ya es independiente del reloj, así que esto solo mejora las ventanas/labels y la paridad de terminados.

**Alternatives considered**:
- **Depender solo de la invalidación de listas al reconectar**: aceptable; la marca se recupera del refetch. Se deja como opción para no ampliar el alcance si no aporta.

---

## Resumen de decisiones

| # | Decisión | FR / SC |
|---|----------|---------|
| R1 | Intervalo abierto (`+∞` para activos) y una sola lógica de intervalos compartida | FR-002, FR-010, FR-011 |
| R2 | Mapa global `sessions.activity()` parcheado con `event.created` vía `applyReducedEvent`; `updatedAt = max(lista, actividad)` | FR-009, SC-002, SC-005 |
| R3 | Memo del plan por `deriveExecutionKey` (topología + clase de intervalo) | FR-003, FR-007, SC-004 |
| R4 | Plan autoritativo desde el modelo enriquecido en `useGraphModel`; estructural como primera pintura | FR-010, FR-011 |
| R5 | Sin tocar SDK/SSE/`reduceEvent`/render/dominios | FR-007, Principios I/III/VII |
| R6 | (Opcional) sembrar actividad de activas al reconectar | SC-002 |

**Trazabilidad sin decisión propia**: FR-001 (agrupar por solape) se resuelve con R1; FR-004 (paridad en vivo/refresco) con R1+R2; FR-005 (no solape → filas distintas) con R1; FR-006 (orden determinista de columnas) se preserva por R3 (mismo `deriveExecutionLevels`); FR-008 (función pura) con R1/R3/R4.
