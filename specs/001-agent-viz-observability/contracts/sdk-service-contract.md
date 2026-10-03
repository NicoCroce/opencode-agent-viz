# Contract — SDK Service (`Infrastructure/Services/opencodeClient.ts`)

Único punto de acceso al SDK. Los componentes/páginas **no** importan `@opencode-ai/sdk` directamente (Constitución III).

## Client

```ts
import { createOpencodeClient } from '@opencode-ai/sdk';

export const opencodeClient = createOpencodeClient({ baseUrl: '/oc' });
// Vite proxy: /oc → http://127.0.0.1:4096 (vite.config.ts)
```

## Métodos permitidos (solo lectura)

| Wrapper | SDK | Devuelve |
|---------|-----|----------|
| `listSessions()` | `client.session.list()` | `TSession[]` |
| `getSessionStatus()` | `client.session.status()` | `Record<string, TSessionStatus>` |
| `getSession(id)` | `client.session.get({ path: { id } })` | `TSession` |
| `getSessionChildren(id)` | `client.session.children({ path: { id } })` | `TSession[]` |
| `getSessionMessages(id)` | `client.session.messages({ path: { id } })` | `{ info: TMessage; parts: TPart[] }[]` |
| `getSessionTodos(id)` | `client.session.todo({ path: { id } })` | `TTodo[]` |
| `listAgents()` | `client.app.agents()` | `TAgent[]` |
| `getMcpStatus()` | `client.mcp.status()` | `TMcpStatusMap` |
| `getConfig()` | `client.config.get()` | `TConfig` |
| `subscribeEvents()` | `client.event.subscribe()` | `AsyncIterable<TEvent>` |

**Prohibido** (solo lectura, Principio I): `session.prompt`, `session.abort`, `session.command`, `session.shell`, post de permisos, `mcp.add/connect/disconnect`, `config.update`.

Todos los wrappers propagan errores del SDK sin capturarlos (la UI decide el estado de error vía TanStack Query).

## Query keys (`src/Domains/queryKeys.ts`)

```ts
export const queryKeys = {
  sessions: {
    all: ['sessions'],
    list: () => [...queryKeys.sessions.all, 'list'],
    detail: (id: string) => [...queryKeys.sessions.all, 'detail', id],
    status: () => [...queryKeys.sessions.all, 'status'],
    messages: (id: string) => [...queryKeys.sessions.all, 'messages', id],
    todos: (id: string) => [...queryKeys.sessions.all, 'todos', id],
  },
  agents: { all: ['agents'], list: () => [...queryKeys.agents.all, 'list'] },
  mcp: { all: ['mcp'], status: () => [...queryKeys.mcp.all, 'status'] },
  config: { all: ['config'], detail: () => [...queryKeys.config.all, 'detail'] },
  graph: { all: ['graph'], for: (sessionId: string) => [...queryKeys.graph.all, sessionId] },
  metrics: { all: ['metrics'], for: (sessionId: string) => [...queryKeys.metrics.all, sessionId] },
  connection: { state: ['connection', 'state'] as const },
};
```

## Hooks de datos (firmas)

```ts
// Sessions/Sessions.service.ts
useGetSessions(): UseQueryResult<TSession[]>
useGetSessionStatus(): UseQueryResult<Record<string, TSessionStatus>>
useGetAgents(): UseQueryResult<TAgent[]>

// Graph/Graph.service.ts
useGetGraph(sessionId: string | null): UseQueryResult<TGraphModel>

// Inspector/Inspector.service.ts
useGetNodeDetail(sessionId: string | null): UseQueryResult<TNodeDetail>
useGetSessionSummary(rootSessionId: string | null): UseQueryResult<TSessionSummary>

// Connection/Connection.service.ts
useConnectionStatus(): { state: TConnectionState }
```

Reglas:
- Toda query con datos iniciales usa `staleTime: Infinity` (ya configurado en `queryClient.ts`); la actualización en vivo llega por SSE vía `setQueryData`.
- `retry: 0` (ya configurado). Los errores se muestran con `EmptyScreenError`.
- `enabled: Boolean(sessionId)` en queries dependientes de selección.
