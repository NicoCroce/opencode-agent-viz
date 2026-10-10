# Plan — OpenCode Agent Viz

## Entrada de Spec-kit

**Stack:** React 19, Vite 8, TypeScript strict, TanStack Query 5, React Router 7, Tailwind 4, shadcn/ui (Radix), lucide-react, sonner, @xyflow/react + dagre, @opencode-ai/sdk, Vitest.

**Estructura:**
```
src/
  Infrastructure/       opencodeClient.ts, EventStreamProvider.tsx, Routes.tsx
  Application/          Components (ui, Molecules, Layout, Organisms), Hooks, Helpers, queryClient.ts
  Domains/Connection | Sessions | Graph | Inspector  (entity.ts, service.ts, routes.ts, router.tsx, Components/, Hooks/, Pages/, index.ts)
```

## Flujo de Datos

### Cliente

```typescript
// Infrastructure/Services/opencodeClient.ts
const client = createOpencodeClient({ baseUrl: '/oc' });
// Proxy Vite: /oc → http://127.0.0.1:4096
// O: opencode --cors http://localhost:5173
```

### Carga Inicial (useQuery)

Query keys centralizados en `queryKeys.ts`:
- `queries.sessions.list` → lista de sesiones
- `queries.sessions.status` → mapa de { sessionId → status }
- `queries.agents.list` → lista de agentes disponibles
- `queries.sessions.messages` → herramientas de la sesión
- `queries.sessions.todos` → progression de fases

### Tiempo Real (SSE)

**EventStreamProvider** — una sola suscripción a `/event`:

```typescript
// Router: GET /oc/event (enruta a OpenCode localhost:4096)
// Eventos:
//   session.created / updated / deleted → queryClient.setQueryData(queryKeys.sessions.list, ...)
//   session.status / idle / error → queryClient.setQueryData(queryKeys.sessions.status(id), ...)
//   message.part.updated (tool) → queryClient.setQueryData(queryKeys.sessions.messages(id), ...)
//   todo.updated → queryClient.setQueryData(queryKeys.sessions.todos(id), ...)
//   permission.asked / replied → queryClient.setQueryData(permisos, ...)
//   texto / razonamiento → ignorar
```

**Batches:** buffer de eventos con flush cada ~100ms o `requestAnimationFrame`. Despacho atomico a queryClient.

**Reconexión:** backoff exponencial. Al reconectar, `queryClient.invalidateQueries()` global para resincronizar.

### Grafo

Función pura memoizada:

```typescript
buildGraph(sessions, statuses, agents, permissions) → { nodes, edges }
// Entrada pura, sin React
// Salida: array de nodes con id, data (agente, status, duración)
//         array de edges con source → target
// Layout: dagre top→bottom con posiciones estables
// Cambio topología = relayout; status changes = solo actualizacion de datos
```

## Convenciones

### Tipos

- Prefijo `T` derivado del SDK.
- Hooks: `useGet[X]`, `useSubscribe[X]`.
- Rutas: constantes en `*.routes.ts`, JSX en `*.router.tsx`.

### Lógica de Negocio

- Páginas: envueltas en `<Page>`.
- Layout: `<Container>`, no `<div>` con flex.
- Componentes shared: `@app/Application/Components` antes que `ui/` crudo.
- Nada de lógica en componentes; todo en hooks y funciones puras.

### Estados de Pantalla

```tsx
if (isError) return <EmptyScreenError message={error?.message} />;
if (isLoading) return <Skeleton />;
if (!data?.length) return <EmptyScreenFilter />;
return <Content data={data} />;
```

### Tests

- Carpeta `specs/` junto al código.
- Unitarios: reductor de eventos, `buildGraph()`.
- Hooks: `renderWithProviders`.
- Fixtures: eventos reales en `__fixtures__/run.ndjson`.

## Research (ANTES de diseñar el modelo de datos)

R1. Grabar eventos reales: `curl -N http://127.0.0.1:4096/event > fixtures/run.ndjson` durante una ejecución de `develop → implement`.

R2. Confirmar de qué campo sale el agente de cada sesión:
   - ¿Del primer mensaje assistant con campo `agent`?
   - ¿Del `subagent_type` del tool `task` del padre?

R3. Confirmar cómo se vincula task → sesión hija:
   - ¿Metadata.sessionId?
   - ¿Otro campo?

R4. SSE por proxy de Vite sin buffering:
   - Probar streaming en vivo.
   - Alternativa: `opencode --cors`.

R5. Frecuencia de `message.part.updated`:
   - Medir durante texto streaming.
   - Calibrar throttle/batch.

R6. Diferencia `/event` vs `/global/event`:
   - `/event`: solo proyecto actual.
   - `/global/event`: todos los proyectos.
   - Parámetro `directory`?

## User Stories (MVP)

**US1 (P1):** Conectarme a OpenCode y ver estado de conexión (conectado, reconectando, desconectado).

**US2 (P1):** Ver lista de sesiones raíz, con agente, título, estado, hora. Elegir una. Por defecto, activa.

**US3 (P1):** Ver grafo jerárquico: nodos por agente, padre→hijo, estado en vivo (curso, permiso, ok, error).

**US4 (P2):** Seleccionar nodo → detalles: agente, modelo, duración, herramienta actual, historial, todos, errores.

**US5 (P2):** Modo "seguir ejecución" (auto-center en nodo activo, desactivable).

**US6 (P3):** Destacar nodos esperando permiso del usuario.

## Criterios de Éxito

- Subagente nuevo en grafo < 1s.
- UI fluida con 50 nodos + 1000 tools.
- Tras reconexión, grafo = estado servidor.

## Fuera de Alcance (v1)

- Controlar ejecuciones (prompts, abort, permisos).
- Historial persistente.
- Multi-proyecto.
- Despliegue remoto.

---

Ready for Spec-kit phases: specify → clarify → plan → tasks → analyze → implement.
