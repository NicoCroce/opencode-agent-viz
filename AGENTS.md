# OpenCode Agent Viz — Convenciones y Flujo de Desarrollo

Proyecto: Visor web de ejecuciones multi-agente de OpenCode.

## Stack

- **Frontend:** React 19, Vite 8, TypeScript strict
- **Estado:** TanStack Query 5, React Router 7, Zustand (estado global opcional)
- **UI:** Tailwind 4, shadcn/ui (Radix), lucide-react, sonner
- **Graph:** React Flow (@xyflow/react) con dagre para layout
- **SDK:** @opencode-ai/sdk para consumir eventos de OpenCode
- **Testing:** Vitest + Testing Library + jsdom

## Arquitectura

```
src/
  main.tsx
  App.tsx
  index.css
  queryClient.ts
  Infrastructure/
    Routes.tsx              # React Router setup
    Services/               # SDK client y providers
  Application/
    Components/             # ui (shadcn), Molecules, Layout, Organisms
    Helpers/
    Hooks/
    lib/
    index.ts
  Domains/
    Connection/             # Gestiona la conexión con OpenCode server
    Sessions/               # Lista y selección de sesiones
    Graph/                  # Visualización del grafo de agentes
    Inspector/              # Panel de detalles del nodo seleccionado
  test/
    setup.ts
    renderWithProviders.tsx
```

## Convenciones

### 1. Estructura de un Dominio

```
Domains/[Domain]/
├── [Entity].entity.ts            # Tipos TypeScript derivados del SDK
├── [Domain].service.ts           # Queries y suscripciones (solo hooks, sin componentes)
├── [Domain].routes.ts            # Constantes de URLs
├── [Domain].router.tsx           # React Router routes
├── Components/
│   ├── [ComponentName].tsx
│   └── index.ts
├── Hooks/
│   ├── use[Action][Entity].ts    # Hooks de data fetching y lógica
│   └── index.ts
├── Pages/
│   ├── [Entity][Action].page.tsx
│   └── index.ts
└── index.ts                       # Barrel export
```

### 2. Tipos y Convenciones de Nombres

| Artefacto      | Patrón                         | Ejemplo                  |
|----------------|--------------------------------|--------------------------|
| Tipos entidad  | `T[Entity]`                    | `TSession`               |
| Hooks query    | `useGet[Entities]`             | `useGetSessions`         |
| Hooks mutation | `useAdd[Entity]`, etc.         | `useSubscribeEvents`     |
| Páginas        | `[Entity][Action].page.tsx`    | `SessionList.page.tsx`   |
| Routes const   | `[ENTITY]_[ACTION]_ROUTE`      | `SESSIONS_LIST_ROUTE`    |
| Router export  | `[Domain]Router`               | `SessionsRouter`         |

### 3. Datos y TanStack Query

- **Tipos:** derivados SOLO de `@opencode-ai/sdk`, con prefijo `T`.
- **Queries:** en `[Domain].service.ts`, con query keys centralizados en `queryKeys.ts` por dominio.
- **SSE:** una sola suscripción en `EventStreamProvider`, que dispatch eventos a queryClient vía `setQueryData`.
- **Hooks:** todo acceso a datos pasa por hooks (`useGet*`, `useSubscribe*`). **Prohibido**: llamar al cliente del SDK desde componentes.

### 4. Componentes y Páginas

- **Páginas:** envueltas en el componente `Page` de `@app/Application` (title, layout base).
- **Componentes compartidos:** desde `@app/Application/Components` (Button, Text, EmptyScreenError, etc.). Verificar el barrel antes de importar desde `ui/`.
- **Lógica:** vive en hooks (`Hooks/`), NO en componentes ni páginas. Los componentes son presentación pura.
- **Estados de pantalla:** toda pantalla con datos renderiza explícitamente:
  1. `isError` → `<EmptyScreenError />`
  2. `isLoading` → skeleton del dominio
  3. `!data?.length` → `<EmptyScreenFilter />` o `<EmptyState />`
  4. datos → contenido
- **Botones con mutations:** siempre con `isLoading={isPending}`.

### 5. Servicio del SDK (Infrastructure/Services/)

Crear `opencodeClient.ts` con:
- `createOpencodeClient({ baseUrl: '/oc' })` (proxy de Vite a localhost:4096)
- Métodos de wrapper: `fetchSessions()`, `subscribeEvents()`, etc.
- Tipado fuerte con tipos del SDK

### 6. EventStreamProvider

- Componente proveedor que suscribe al stream `/event`
- Reconexión con backoff exponencial
- Despacha eventos al queryClient: `queryClient.setQueryData(key, updater)`
- Batches de eventos (flush cada ~100ms) para evitar re-renders excesivos
- Ignora eventos de texto/reasoning, solo procesa partes significativas (tool, permission, etc.)

### 7. Tests

- Carpeta `specs/` junto al código (NO mezclados con .tsx).
- Tests de lógica pura: reductor de eventos, `buildGraph()`, queries.
- Tests de hooks: usando `renderWithProviders`.
- Fixtures: eventos reales grabados desde una ejecución de OpenCode (en `__fixtures__/`).

### 8. Restricciones

1. ✅ Llamar SDK solo desde `*.service.ts`.
2. ✅ Lógica de negocio en hooks o funciones puras, NO en componentes.
3. ❌ NO importar `@app/Domains/[OtroDominio]` desde un componente (rompe el encapsulamiento). Si necesitas cross-domain, hazlo en el hook.
4. ❌ NO divs con `flex`; usar `<Container>` con las props correctas.
5. ❌ NO usar magic strings; extraer a constantes (`EventType.SESSION_CREATED`).

### 9. Responsive — Mobile First

- Hook `useDevice()` para elegir presentación (desktop/mobile).
- **Prohibido** `md:hidden` / `hidden md:block` (ambas ramas se montan).
- Una sola fuente de lógica (un hook), dos presentaciones (componentes).

### 10. Validación

- Usar Zod para datos del usuario (filtros, parámetros).
- Tipos del SDK ya son tipados por OpenCode; no revalidar.

## Query Keys

Archivo `Domains/queryKeys.ts`:

```typescript
export const queryKeys = {
  sessions: {
    all: ['sessions'],
    list: () => [...queryKeys.sessions.all, 'list'],
    detail: (id: string) => [...queryKeys.sessions.all, 'detail', id],
    status: (id: string) => [...queryKeys.sessions.all, 'status', id],
    messages: (id: string) => [...queryKeys.sessions.all, 'messages', id],
    todos: (id: string) => [...queryKeys.sessions.all, 'todos', id],
  },
  agents: {
    all: ['agents'],
    list: () => [...queryKeys.agents.all, 'list'],
  },
  graph: {
    all: ['graph'],
    for: (sessionId: string) => [...queryKeys.graph.all, sessionId],
  },
};
```

## Flujo de Desarrollo con Spec-kit

1. **Constitution:** Los principios I–VIII en `.specify/memory/constitution.md`.
2. **Specify:** WHAT/WHY (problema, usuario, historias, criterios, scope).
3. **Clarify:** Cobertura (alcance, datos, UX, edge cases).
4. **Plan:** Architecture, stack, data flow, components.
5. **Tasks:** Tareas T### por user story, con paths concretos.
6. **Analyze:** Hallazgos, consistencia.
7. **Implement:** blendverse-back no aplica (no hay backend); solo frontend + tests.

## Convención de Commits

`<type>(<scope>): <subject>`

- `type`: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`
- `scope`: dominio o area (e.g., `graph`, `connection`, `hooks`)
- `subject`: imperativo, sin mayúsculas, max 50 chars

Ejemplo:
```
feat(graph): add real-time node updates via SSE
fix(connection): handle reconnection with exponential backoff
test(graph): add fixtures for multi-agent execution
```

## Próximos Pasos

1. Ejecutar `specify init --ai opencode --here` (ya está lista la carpeta).
2. Cargar constitution.
3. Ejecutar specify → clarify → plan → tasks → analyze.
4. Implementar con el mismo flow que gestDoc.

¡Listo para empezar con Spec-kit!
