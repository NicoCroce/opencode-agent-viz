# Contract — Event Stream (`Infrastructure/EventStreamProvider.tsx`)

Una **única** suscripción SSE por aplicación. El provider es el único que escribe directamente en el `queryClient` desde eventos. La lógica de mapeo es una función pura (`Graph/lib/eventReducer.ts`) testeable con fixtures.

## Provider

```ts
type TConnectionState = 'connected' | 'reconnecting' | 'disconnected';

interface EventStreamContext {
  state: TConnectionState;
}
```

- Monta `subscribeEvents()` (async iterable) en un `useEffect` con cleanup (abort al desmontar).
- Buffer de eventos + flush cada **100ms** (o `requestAnimationFrame`); un solo `flush` atómico al `queryClient`.
- Backoff exponencial (1s, 2s, 4s… máx 30s) al reconectar.
- Al reconectar: `queryClient.invalidateQueries()` global y re-sync de sesiones/status.
- Heartbeat: si el stream se cierra, pasa a `reconnecting`; si agota reintentos → `disconnected`.
- **No** procesa `text`/`reasoning` ni sus `delta`.

## Reducer puro

```ts
type TEventUpdate =
  | { key: QueryKey; updater: (prev: unknown) => unknown }
  | { type: 'invalidate' };

function reduceEvent(event: TEvent): TEventUpdate | null;
```

## Mapeo evento → queryClient

| Evento (`TEvent.type`) | Acción |
|------------------------|--------|
| `server.connected` | `connection.state = 'connected'` |
| `session.created` | upsert en `sessions.list`; agregar nodo al grafo |
| `session.updated` | upsert en `sessions.list` y `sessions.detail(id)`; actualizar métricas del nodo |
| `session.deleted` | remove de `sessions.list`; remove nodo/edges del grafo |
| `session.status` | `sessions.status[sessionID]`; re-derivar `TNodeStatus`; si `type:'retry'` → `hasLoop` |
| `session.idle` | `sessions.status[sessionID] = {type:'idle'}`; re-derivar nodo |
| `session.error` | marcar nodo en `error` con el mensaje |
| `session.compacted` | evento informativo del historial del nodo |
| `message.updated` | upsert mensaje en `sessions.messages(id)`; recalcular `TNodeMetrics` (cost/tokens/tiempo) |
| `message.part.updated` | upsert parte (excepto `text`/`reasoning`); `tool` actualiza `currentTool` y `tool` history; `step-finish` suma cost/tokens; `retry` incrementa `retryCount`/`hasLoop`; `subtask` registra invocación |
| `message.part.removed` | remove parte |
| `message.removed` | remove mensaje |
| `permission.updated` | agregar permiso → nodo `waiting` |
| `permission.replied` | quitar permiso; recalcular estado |
| `todo.updated` | `sessions.todos(id)` |

Eventos no listados se ignoran (devuelven `null`).

## Invariantes

- El estado del grafo tras reconexión **debe** coincidir con el servidor (SC-003): la reconexión re-invalida y re-consulta la verdad (`session.list`, `session.status`, `session.messages`).
- El flush es atómico por lote: nunca se intercala render entre updaters del mismo lote.
- Un evento para una sesión/parte desconocida crea la entrada necesaria sin lanzar excepción (robustez en vivo).
