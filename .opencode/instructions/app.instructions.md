---
description: Convenciones de arquitectura por dominios para opencode-agent-viz. Se aplica automáticamente en cualquier tarea dentro de src/Domains/
applyTo: 'src/Domains/**'
---

# Frontend — Arquitectura por Dominios Funcionales

Proyecto: Visor real-time de ejecuciones multi-agente de OpenCode.

## Estructura de un Dominio

```
src/Domains/[Domain]/
├── [Entity].entity.ts            # Tipos TypeScript (derivados del SDK de OpenCode)
├── [Domain].service.ts           # Queries y suscripciones (solo TanStack Query)
├── [Domain].routes.ts            # Constantes de URLs (sin JSX → .ts)
├── [Domain].router.tsx           # JSX con <Route> de React Router
├── Components/                   # Componentes específicos del dominio
│   └── index.ts
├── Hooks/                        # Custom hooks (queries, mutations, lógica)
│   ├── use[Action][Entity].ts
│   └── index.ts
├── Pages/
│   ├── [Entity][Action].page.tsx
│   └── index.ts
└── index.ts                      # Barrel export del dominio
```

## Estructura de Specs

Todos los archivos de test (`.spec.tsx`, `.spec.ts`, `.test.tsx`, `.test.ts`) deben organizarse en una carpeta `specs/` manteniendo la misma estructura del directorio padre.

✅ **CORRECTO:**

```
src/Domains/Sessions/
├── Components/
│   ├── SessionCard.tsx
│   └── specs/
│       └── SessionCard.spec.tsx
├── Hooks/
│   ├── useGetSessions.ts
│   └── specs/
│       └── useGetSessions.spec.ts
└── Pages/
    ├── SessionList.page.tsx
    └── specs/
        └── SessionList.page.spec.tsx
```

❌ **PROHIBIDO** — Mezclar specs con archivos fuente:

```
Components/
├── SessionCard.tsx
├── SessionCard.spec.tsx          # ← INCORRECTO
```

## Patrones Obligatorios

### Reglas de Oro

1. **Separación de responsabilidades:** Las páginas y los componentes solo pueden llamar a los servicios desde los hooks, nunca directamente.
2. **SDK en capas:** El cliente del SDK de OpenCode SOLO se invoca desde `*.service.ts`. Prohibido en componentes.
3. **Wrappers del proyecto primero:** Los componentes en `Molecules/`, `Organisms/` y `Layout/` tienen patrones del proyecto (Button con `isLoading`, Input con `forceEnabled`). Importa desde el barrel `@app/Application/Components`:
   - ✅ `import { Button } from '@app/Application/Components'` — usa el wrapper
   - ❌ `import { Button } from '@app/Application/Components/ui/button'` — es raw shadcn

4. **Solo importa de `ui/` cuando no exista wrapper:** Verifica primero el barrel. Usa `ui/` solo para primitivos que el wrapper no expone (ej: `SelectContent`/`SelectItem` si el wrapper `Select` usa API distinta).

5. **Container es flex column por defecto:** Usa `<Container space="medium">` para layout, no `<div>` con `flex`. Analiza el comportamiento de `space` antes de agregar clases adicionales.

6. **Tipos con prefijo T:** Los tipos de datos usan prefijo `T` (`TSession`, `TSessionSearch`). Derivados del SDK de OpenCode, nunca interfaces manuales.

### Tipos de Datos

Los tipos vienen del SDK:

```typescript
// ✅ Correcto — del SDK
import type { Session, SessionStatus } from '@opencode-ai/sdk';

export type TSession = Session;
export type TSessionStatus = SessionStatus;

// Para búsquedas locales (no vienen del SDK):
export type TSessionSearch = { search?: string; status?: TSessionStatus };
```

### Servicio (TanStack Query)

Archivo `[Domain].service.ts` envuelve el SDK:

```typescript
// ✅ Correcto
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { opencodeClient } from '@app/Infrastructure/Services/opencodeClient';

export const useGetSessions = () => {
  return useQuery({
    queryKey: queryKeys.sessions.list(),
    queryFn: async () => opencodeClient.getSessions(),
    staleTime: 30000,
  });
};
```

### Hooks de Query

```typescript
// ✅ Correcto — data fetching en el hook
import { useGetSessions } from '../Sessions.service';

export const useFetchSessions = () => {
  const { data, isLoading, isError, error } = useGetSessions();
  return { sessions: data ?? [], isLoading, isError, error };
};
```

### Hooks de Mutation

Para acciones que actualizan OpenCode (si aplicable en v1):

```typescript
// ✅ Correcto — mutation con feedback
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useApprovePermission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissionId: string) =>
      opencodeClient.approvePermission(permissionId),
    onSuccess: () => {
      toast.success('Permiso aprobado');
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all() });
    },
    onError: () => {
      toast.error('Error al aprobar permiso');
    },
  });
};
```

### Botones de Submit — SIEMPRE con `isLoading`

Todo `<Button type="submit">` que dispara una mutation DEBE recibir `isLoading={isPending}`:

```tsx
// ✅ Correcto — spinner + disable automático
const { mutate, isPending } = useApprovePermission();
<Button type="submit" isLoading={isPending}>Aprobar</Button>

// ❌ Incorrecto — sin feedback visual
<Button type="submit" disabled={isPending}>Aprobar</Button>
```

Botones de "Cancelar" usan `disabled={isPending}` sin spinner.

### Feedback de Mutations — Toasts en el Hook

El `toast.success` / `toast.error` vive en el hook, no en el componente:

```tsx
// ✅ En Hooks/useApprovePermission.ts
export const useApprovePermission = () => {
  return useMutation({
    mutationFn: (...) => ...,
    onSuccess: () => toast.success('Permiso aprobado'),
    onError: () => toast.error('No se pudo aprobar'),
  });
};

// ✅ En el componente — solo llama al hook
const { mutate, isPending } = useApprovePermission();
```

### Estados de Pantalla — Loading / Error / Empty (OBLIGATORIO)

Toda pantalla o componente que obtiene datos de un servicio DEBE implementar los tres estados en este orden:

```tsx
const { data, isLoading, isError, error } = useGetSessions();

if (isError) return <EmptyScreenError message={error?.message} />;
if (isLoading) return <SessionListSkeleton />;
if (!data?.length) return <EmptyScreenFilter onClick={openFilters} />;

return <SessionList sessions={data} />;
```

**No dejes fallbacks en blanco; siempre usa componentes genéricos:**

| Estado  | Componente                    | Cuándo                                   |
|---------|-------------------------------|------------------------------------------|
| Error   | `<EmptyScreenError />`        | La query falla (`isError`)               |
| Vacío   | `<EmptyScreenFilter />`       | No hay resultados tras filtros/búsqueda  |
| Vacío   | `<EmptyState />`              | Empty state genérico con CTA             |
| Loading | Skeleton del dominio          | Esperar datos (componente propio)        |

**Skeletons de dominio** van en `Components/` del dominio (ej. `SessionListSkeleton.tsx`), construidos sobre `ui/skeleton`.

### Páginas — SIEMPRE Envueltas en `Page`

**Toda página (`.page.tsx`) DEBE estar envuelta en el componente `Page`:**

```tsx
// ✅ Correcto
import { Page } from '@app/Application/Components';

export const SessionListPage = () => {
  return (
    <Page title="Sesiones de OpenCode">
      <SessionList />
    </Page>
  );
};

// ❌ Incorrecto — pierde título, layout consistente
export const SessionListPage = () => {
  return <SessionList />;
};
```

**Reglas:**

1. Las páginas viven en `Domains/[Domain]/Pages/`, NUNCA en `Application/Components/`.
2. El título va en la prop `title` de `Page`, no se renderiza a mano.
3. Usa `size="small"` para formularios acotados; default `full` para listados.

### Componentes Compartidos

Antes de crear un componente nuevo, verifica en `src/Application/Components/`:

| Carpeta      | Contenido                                          |
|--------------|--------------------------------------------------|
| `ui/`        | Primitivos shadcn/ui (Button, Input, Dialog, etc.) |
| `Molecules/` | Button wrapper, Text, Input, Select, Spinner, etc. |
| `Organisms/` | AlertMessage, componentes complejos               |
| `Layout/`    | Container, Page, AnimatedLayout                  |

**Nunca dupliques un componente que ya exista.** Si falta, créalo en la capa correcta.

### Componentes de Dominio Reutilizables

Los pieces de presentación que se repiten dentro de un dominio van en archivos propios dentro de `Components/` del dominio, con nombre semántico:

```
Domains/Sessions/Components/
├── SessionCard.tsx
├── SessionCardSkeleton.tsx
├── SessionStatus.tsx            # Estados visuales
├── SessionEmptyState.tsx
└── index.ts
```

**Regla:** Si el mismo fragmento aparece en 2+ archivos o infla una página, extráelo a un archivo propio en `Components/` del dominio.

## Rutas

### `[Domain].routes.ts` (constantes)

Contiene SOLO constantes de URLs, sin JSX (extensión `.ts`):

```typescript
export const SESSIONS_ROUTE = '/sessions';
export const SESSIONS_LIST_ROUTE = SESSIONS_ROUTE;
export const SESSION_DETAIL_ROUTE = `${SESSIONS_ROUTE}/:id`;
```

### `[Domain].router.tsx` (JSX)

```tsx
import { Route } from 'react-router-dom';
import { SessionListPage, SessionDetailPage } from './Pages';
import { SESSIONS_LIST_ROUTE, SESSION_DETAIL_ROUTE } from './Sessions.routes';

export const SessionsRouter = [
  <Route
    key="sessions-list"
    path={SESSIONS_LIST_ROUTE}
    element={<SessionListPage />}
  />,
  <Route
    key="session-detail"
    path={SESSION_DETAIL_ROUTE}
    element={<SessionDetailPage />}
  />,
];
```

## Búsquedas — SIEMPRE con Debounce

Todo input de búsqueda que dispara una query DEBE usar `useDebounce` antes de enviar el valor:

```tsx
// ✅ Correcto
import { useDebounce } from '@app/Application';

const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 400);
const { data } = useGetSessions({ search: debouncedSearch });

// ❌ Incorrecto — un request por cada tecla
const { data } = useGetSessions({ search });
```

Delay default: `400ms`. Cambia solo si hay motivo (búsqueda local puede ser `200ms`).

## Formularios

Siempre usar React Hook Form + Zod:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  status: z.enum(['pending', 'running', 'done']),
});

const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { name: '', status: 'pending' },
});
```

## Responsive — Mobile First

Use el hook `useDevice()` para elegir presentación (desktop/mobile). **Prohibido usar `md:hidden` / `hidden md:block`:**

```tsx
const { isMobile } = useDevice();

return isMobile ? (
  <SessionCardsView sessions={sessions} />
) : (
  <SessionTableView sessions={sessions} />
);
```

Una sola fuente de lógica (un hook), dos presentaciones (componentes).

## Archivos Globales a Actualizar al Crear un Dominio

1. `src/Infrastructure/Routes.tsx` → agregar `[Domain]Router` al array `AllRoutes`
2. Actualizar `src/Domains/index.ts` si aplica

## Convenciones de Nombres

| Artefacto      | Patrón                         | Ejemplo                  |
|----------------|--------------------------------|--------------------------|
| Tipos entidad  | `T[Entity]`                    | `TSession`               |
| Tipo búsqueda  | `T[Entity]Search`              | `TSessionSearch`         |
| Hooks query    | `useGet[Entities]`             | `useGetSessions`         |
| Hooks mutation | `use[Action][Entity]`          | `useApprovePermission`   |
| Páginas        | `[Entity][Action].page.tsx`    | `SessionList.page.tsx`   |
| Routes const   | `[ENTITY]_[ACTION]_ROUTE`      | `SESSIONS_LIST_ROUTE`    |
| Router export  | `[Domain]Router`               | `SessionsRouter`         |

## Restricciones

1. ❌ No debes llamar el SDK o un servicio directamente desde un componente.
2. ❌ No debes escribir grandes bloques de código directamente en `*.page.tsx`.
3. ❌ No debes crear componentes genéricos que no sean específicos de tu dominio.
4. ❌ No debes escribir lógica de negocio en los componentes. Todo en hooks o funciones puras.
5. ❌ NO divs con `flex`; usa `<Container>`.
6. ✅ Métodos y variables en camelCase.
7. ✅ Preferir nullish coalescing (`??`) antes que ternarios.

## Convención de Commits

Conventional Commits: `<type>(<scope>): <subject>`

```
feat(graph): add real-time node updates
fix(connection): handle reconnection with exponential backoff
test(sessions): add fixtures for session list
```

Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`
