# OpenCode Agent Viz — Convenciones y Flujo de Desarrollo

Proyecto: Visor web de ejecuciones multi-agente de OpenCode.

## Stack

- **Frontend:** React 19, Vite 8, TypeScript strict
- **Estado:** TanStack Query 5, React Router 7, Zustand (estado global opcional)
- **UI:** Tailwind 4, shadcn/ui (Radix), lucide-react, sonner
- **Graph:** React Flow (@xyflow/react) con dagre para layout
- **SDK:** @opencode/client para consumir eventos de OpenCode
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

- **Tipos:** derivados SOLO de `@opencode/client`, con prefijo `T`.
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
- `createOpencodeClient({ baseUrl: '/oc' })` (proxy de Vite al background service de OpenCode vía `OPENCODE_URL`)
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
- Tests de hooks: usando `renderWithProviders`. Acepta `queryClient` propio (`createTestQueryClient({ gcTime: Infinity })` si el spec revalida contra caché sembrada) y `seed(queryClient)`, que siembra la caché ANTES de renderizar.
- Radix en jsdom: `src/test/setup.ts` instala los polyfills de puntero y `scrollIntoView` (`src/test/radix.ts`); con `Select`/`AlertDialog` usa `setupRadixUser()` y espera el foco con `findBy…`/`waitFor`.
- `Alert` del barrel raíz es el primitivo de `ui/`; el wrapper del proyecto se importa desde `@app/Application/Components/Molecules/Alert`.
- `pnpm tsc` no cubre `vite.config.ts`; verifícalo con `pnpm tsc:node`.
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

### 11. UI, hooks y dominios (reglas esenciales)

Referencia extendida con ejemplos: `.opencode/instructions/app.instructions.md` (no se carga automáticamente; consultarla solo si hace falta un ejemplo).

- **Imports:** wrappers desde el barrel `@app/Application/Components` (`Button`, `Input`…). Importar de `ui/` solo si el wrapper no expone el primitivo. Verificar el barrel antes de crear un componente nuevo; nunca duplicar uno existente.
- **Layout:** `Container` es flex column por defecto; usar `space` antes de añadir clases. Toda `*.page.tsx` va envuelta en `Page` (`title` por prop; `size="small"` para formularios, `full` por defecto). Las páginas viven en `Domains/[Domain]/Pages/`, sin bloques grandes de código.
- **Mutations:** `toast.success` / `toast.error` viven en el hook, no en el componente. `<Button type="submit">` con `isLoading={isPending}`; "Cancelar" usa `disabled={isPending}`.
- **Formularios:** React Hook Form + Zod (`zodResolver`).
- **Búsquedas:** todo input que dispare una query pasa por `useDebounce` (400 ms por defecto; 200 ms si es búsqueda local).
- **Skeletons y piezas repetidas:** los skeletons de dominio van en `Components/` del dominio, sobre `ui/skeleton`. Un fragmento que aparece en 2+ archivos o infla una página se extrae a su propio archivo en `Components/`. No crear componentes genéricos dentro de un dominio.
- **Campos derivados para la UI** (p. ej. `enrichment`, `effort`): opcionales en el tipo del modelo (`campo?: T | null`). Los comparadores de reconciliación (`sameNodeData`) deben cubrirlos, o el valor no se re-renderiza.
- **Rutas:** `[Domain].routes.ts` solo con constantes (sin JSX); `[Domain].router.tsx` exporta el array de `<Route key=…>`.
- **Dominio nuevo:** registrar `[Domain]Router` en `AllRoutes` de `src/Infrastructure/Routes.tsx` y actualizar `src/Domains/index.ts` si aplica.
- **Estilo:** camelCase para métodos y variables; preferir `??` antes que ternarios para valores por defecto.

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
7. **Implement:** solo frontend + tests; lo orquesta el agente `sddorch` (`.opencode/agents/sddorch.md`).

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
4. Implementar con `sddorch`.

¡Listo para empezar con Spec-kit!
