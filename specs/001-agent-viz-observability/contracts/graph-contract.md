# Contract — Graph (`Domains/Graph/lib/`)

Funciones **puras** (sin React), memoizables y testeadas con fixtures (Constitución V).

## `buildGraph()`

```ts
interface BuildGraphInput {
  sessions: TSession[];
  statuses: Record<string, TSessionStatus>;
  agents: TAgent[];
  messages: Record<string, { info: TMessage; parts: TPart[] }[]>; // por sessionId
  permissions: TPermission[];
  now: number; // inyectado para testear duración en vivo
}

function buildGraph(input: BuildGraphInput): TGraphModel;
// TGraphModel = { nodes: TGraphNode[]; edges: TGraphEdge[] }
```

Reglas:
- Un nodo por `TSession`. `edges` desde `parentID` (R3).
- `agentName`: `UserMessage.agent` → `subtask.agent` del padre → `Agent.name` → `'agent'` (R2).
- `status`: deriva de `TNodeStatus` (prioridad `waiting > error > running > done/idle`).
- `metrics`: delega en `deriveMetrics()` (ver metrics-contract).
- Determinista: el mismo input produce el mismo output (sin `Date.now()` interno; `now` es parámetro).
- Un nodo hijo sin padre presente se ubica como raíz temporal, sin duplicarse al llegar el padre.

## `layoutGraph()`

```ts
function layoutGraph(model: TGraphModel): TGraphModel; // asigna position
```

- dagre, dirección `TB` (top→bottom), `nodesep`/`ranksep` fijos, `rankdir: 'TB'`.
- **Estabilidad de topología**: las posiciones se recalculan solo cuando cambia el conjunto de `nodes`/`edges` (topología). Un cambio de `status`/`metrics` **no** dispara relayout (SC-002, Principio VII).
- El resultado de layout se cachea por una firma de topología (p. ej. hash de ids+edges).

## `useGraphModel()`

```ts
function useGraphModel(sessionId: string | null): {
  model: TGraphModel;
  nodeTypes: Record<string, ComponentType<NodeProps>>;
  onNodesChange?: OnNodesChange;
};
```

- Compone `useGetSessions`, `useGetSessionStatus`, `useGetAgents`, mensajes y permisos, llama a `buildGraph` + `layoutGraph` memoizados.
- Mantiene separadas la identidad de nodos (topología) y sus datos (`status`/`metrics`) para que React Flow actualice datos sin relayout.

## `useFollowMode()`

```ts
function useFollowMode(): { enabled: boolean; toggle(): void; activeNodeId: string | null };
```

- `activeNodeId` = nodo con `status === 'running' | 'waiting'` más reciente.
- Al activarse, el canvas hace `fitView`/`setCenter` sobre `activeNodeId`; al desactivarse, cesa el recentrado.
