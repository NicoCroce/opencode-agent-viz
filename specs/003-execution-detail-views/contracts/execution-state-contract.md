# Contract — Estado de ejecución (`Domains/Graph/`)

Cubre US3 (FR-017..FR-023). Toda la derivación es pura (Principio V) y consistente entre nodo y detalle (FR-023).

## `TNodeStatus` — `Graph.entity.ts`

```ts
export type TNodeStatus =
  | 'created' | 'running' | 'retrying' | 'compacting'
  | 'waiting-permission' | 'waiting-input'
  | 'succeeded' | 'failed' | 'interrupted';
```

Se conserva el nombre del tipo y el campo `data.status: TNodeStatus`.

## `toNodeStatus()` — `lib/nodeStatus.ts`

```ts
interface NodeStatusInput {
  status?: SessionStatus;                 // idle | busy | retry(attempt, next)
  hasActivity: boolean;
  hasPermission: boolean;
  hasPendingForm: boolean;
  compaction: 'running' | 'completed' | 'failed' | null;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  lastAssistantErrored: boolean;
}

function toNodeStatus(input: NodeStatusInput): TNodeStatus;
```

Prioridad exacta (FR-020 incluido):

1. `status.type === 'retry'` → `retrying`
2. `compaction === 'running'` → `compacting`
3. `hasPendingForm` → `waiting-input`
4. `hasPermission` → `waiting-permission`
5. `outcome === 'interrupted'` → `interrupted`
6. `outcome === 'failed'` → `failed`
7. `outcome === 'succeeded'` → `succeeded`
8. `status.type === 'busy'` → `running` (solo si no hay `outcome`: un `busy` obsoleto nunca tapa un resultado terminal)
9. `hasActivity` → `lastAssistantErrored ? 'failed' : 'succeeded'`
10. si no → `created`

Reglas:
- **FR-020**: los pasos 1–4 (estados activos) y 5–7 (resultado terminal) ganan sobre `busy`; una ejecución activa o con outcome exitoso nunca se muestra `failed` por errores superados. `lastAssistantErrored` solo aplica cuando no hay outcome ni estado activo.
- **FR-021**: `created` (sin actividad) ≠ `succeeded` (con actividad/outcome).
- **FR-018**: `retrying` va acompañado de `data.retry = { attempt, next }`; `next` puede ser `null` (edge case).
- **FR-019**: `interrupted` se distingue de `failed`; el motivo vive en `data.interruptReason` (`null` → "no disponible").

## `isActiveStatus()` — `lib/nodeStatus.ts`

```ts
function isActiveStatus(status: TNodeStatus): boolean;
// true para running | retrying | compacting | waiting-permission | waiting-input
```

Reemplaza las comparaciones dispersas `status === 'running' || status === 'waiting'` en `AgentNode`, `AgentGraph` y `useGraphModel`.

## `TExecutionSignal` — `queryKeys.sessions.execution(id)`

```ts
interface TExecutionSignal {
  retry: { attempt: number; next: number | null } | null;
  compaction: 'running' | 'completed' | 'failed' | null;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  interruptReason: string | null;
}
```

Fuentes: `eventReducer` (puro) para eventos en vivo y `getSessionLog` para la siembra durable. `useExecutionSignals(id)` combina ambas.

Eventos mapeados:
- `session.retry.scheduled` → `retry`
- `session.status` con `type: 'retry'` → `retry`
- `session.compaction.started` → `compaction: 'running'`; `session.compaction.ended` → `'completed'`; `session.compaction.failed` → `'failed'`
- `session.execution.succeeded` → `outcome: 'succeeded'`; `session.execution.failed` → `'failed'`; `session.execution.interrupted` → `'interrupted'` + `interruptReason: data.reason`
- `session.idle` → limpia el estado activo. **El evento SSE `session.idle` NO aporta `outcome` por sí mismo**; el `outcome` proviene de `session.execution.*` (en vivo) o del **mensaje** durable `SessionMessageIdle` (vía `session.log`/histórico), que sí lo trae. No confundir el evento `session.idle` con el mensaje `SessionMessageIdle`.

## Consumo

- `useGraphModel` combina señales + `statuses` + `permissions` + `forms` + inbox y llama `toNodeStatus` por nodo.
- `AgentNode`, `NodeStatusRail`, `ExecutionLanes`, `StatusDot`, `AgentGraph.STATUS_RANK` e `InspectorPanel.STATUS_LABEL` amplían sus mapas a los 9 estados reutilizando los tokens de estado existentes.
