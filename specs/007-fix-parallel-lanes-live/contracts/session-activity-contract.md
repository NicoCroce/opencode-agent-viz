# Contrato — Marca de actividad en vivo

**Feature**: `007-fix-parallel-lanes-live`
**Cubre**: FR-009 · SC-002, SC-005
**Implementa**: `Domains/queryKeys.ts`, `Domains/Graph/Graph.entity.ts`,
`Domains/Graph/lib/eventReduce/activity.ts`, `Domains/Graph/lib/eventReduce/cache.ts`,
`Domains/Graph/lib/graphBuild/toGraphNode.ts`, `Domains/Graph/lib/buildGraph.ts`,
`Domains/Graph/lib/buildStructuralModel.ts`, `Infrastructure/lib/applyReducedEvent.ts`.

---

## 1. Mapa de actividad

```ts
// Graph.entity.ts
export type TActivityMap = Record<string, number>;

// queryKeys.ts
sessions.activity: () => ['sessions', 'activity'];
```

- Estado de vista en caché (TanStack Query), hermana de `sessions.status()`.
- `[sessionID]` = último instante de actividad observado (ms). No se persiste ni se envía al servidor.

## 2. Escritura (pura)

```ts
// lib/eventReduce/cache.ts
export const setActivity = (
  prev: TActivityMap,
  sessionID: string,
  at: number,
): TActivityMap; // { ...prev, [sessionID]: Math.max(prev[sessionID] ?? 0, at) }

// lib/eventReduce/activity.ts
export const reduceActivity = (event: TReducibleEvent): TQueryUpdate | null;
```

- `reduceActivity` devuelve `set(queryKeys.sessions.activity(), prev => setActivity(prev, sessionID, event.created))` para todo evento con `sessionID`; `null` para eventos sin sesión (`server.connected`).
- **Cobertura** (todos con `event.created`): mensajes (`session.step.started/ended/failed`, `session.text.ended`, `session.reasoning.ended`, `session.message.content.updated`, `session.tool.*`), ejecución/señales (`session.execution.*`, `session.retry.scheduled`, `session.compaction.*`), ciclo de vida/estado (`session.status`, `session.idle`, `session.created/renamed/...`), permisos (`permission.asked/replied`), inbox/forms (`session.inbox.*`, `form.*`) y **también los deltas** (`session.text.delta`, `session.reasoning.delta`, `session.tool.input.delta`, `session.tool.progress`, `session.compaction.delta`), que traen `sessionID`/`event.created` aunque su contenido se ignore.
- **Deltas**: aportan solo su marca temporal de actividad; **no** se procesa ni se persiste su contenido (el contrato de `reduceEvent` los sigue ignorando). Incluirlos maximiza la frescura de FR-009 al menor costo (un `max` por lote).
- **Monotonía**: `max` acumulado; la marca nunca retrocede ni se adelanta al evento.

## 3. Aplicación sin red

```ts
// Infrastructure/lib/applyReducedEvent.ts
const activity = reduceActivity(event);
if (activity) applyUpdate(activity, queryClient); // setQueryData
const updates = reduceEvent(event);                // contrato sin cambios
```

- Se ejecuta dentro del **batching existente** de `EventStreamProvider` (flush ~100 ms). **Sin peticiones de red adicionales.**
- `reduceEvent` conserva exactamente su contrato y sus specs.

## 4. Lectura y uso

- `graphBuild/toGraphNode.ts`: `updatedAt = max(session.time.idle ?? session.time.updated ?? 0, activity[session.id] ?? 0)`; `null` si el máximo es `0`.
- `buildGraph`/`buildStructuralModel` aceptan `activity?: TActivityMap` (opcional, compatibilidad total con consumidores previos).
- `useGraphStructure` lee `queryKeys.sessions.activity()` y lo propaga al modelo estructural.

## 5. Frescura y paridad

- **Presupuesto**: el desfase de la marca es el del flush de eventos (≤ 1 s), igual que el resto del estado en vivo (FR-009).
- **Paridad** (SC-002/SC-005): al reabrir, `SessionInfo.time.idle`/`time.updated` del servidor coinciden con la última actividad; con la marca, el nodo terminado conserva el mismo fin en vivo y tras refresco.
- **Reconexión** (edge case): la invalidación de listas al reconectar (`handleReconnected`) recupera la marca base desde el servidor; opcionalmente `useActiveSessionsSeed` puede sembrar `activity[id] = now` para las activas del snapshot (R6 de [research.md](../research.md)).

## 6. Criterios de aceptación del contrato

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| A1 | `reduceActivity` cubre todos los eventos con `sessionID` y devuelve `null` sin sesión | spec puro `eventReducer.spec.ts` (extendido) |
| A2 | `setActivity` es monótono (`max`) y no muta la entrada | spec puro |
| A3 | `applyReducedEvent` aplica la actividad y mantiene intacto `reduceEvent` | spec de `applyReducedEvent` |
| A4 | `updatedAt = max(lista, actividad)` en el nodo | spec puro `buildGraph.spec.ts` |
| A5 | La disposición en vivo coincide con la reconstruida al reabrir (marca fresca) | spec de hook `useGraphModel.spec.tsx` |
