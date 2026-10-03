# front-ddd-generator — Templates

Solo para crear un dominio nuevo. Reemplazar todos los placeholders `[...]` con los valores reales.

## Template: `[Entity].entity.ts`

> ⚠️ **DERIVAR DEL CONTRATO, NUNCA DEL INTERNO (constitución Pr. III):** no importes `I[Entity]` del server ni definas `T[Entity] = I[Entity]` — es el desvío D1 de `arch-audit` (segunda fuente de verdad que se desincroniza del contrato real). Deriva con `inferRouterOutputs`: el tipo ES la salida que tRPC devuelve por la red. `get` devuelve `[Entity] | null`, por eso se envuelve en `NonNullable`.

```typescript
import { inferRouterOutputs } from '@trpc/server';
import { T[Domain]Router } from '@server/domains/[Domain]';
import { TPagination } from '@app/Application';

type T[Domain]RouterOutput = inferRouterOutputs<T[Domain]Router>;

export type T[Entity] = NonNullable<T[Domain]RouterOutput['get']>;

export type T[Entity]Search = {
  // campos de búsqueda opcionales según los filtros del dominio
  search?: string;
} & TPagination;
```

---

## Template: `[Domain].service.ts`

```typescript
import { T[Domain]Router } from '@server/domains/[Domain]';
import { createTRPCReact } from '@trpc/react-query';

export const _[domain]Service = createTRPCReact<T[Domain]Router>();
export const [Domain]Service = _[domain]Service.[domain];
```

---

## Template: `[Domain].routes.tsx`

```typescript
export const [DOMAIN]_ROUTE = '/[domain]';
export const [DOMAIN]_NEW_ROUTE = `${[DOMAIN]_ROUTE}/new`;
export const [DOMAIN]_UPDATE_ROUTE = `${[DOMAIN]_ROUTE}/update/:id`;
```

---

## Template: `[Domain].router.tsx`

```tsx
import { Route } from 'react-router-dom';
import { [Entity]ListPage, [Entity]NewPage, [Entity]UpdatePage } from './Pages';
import { [DOMAIN]_ROUTE, [DOMAIN]_NEW_ROUTE, [DOMAIN]_UPDATE_ROUTE } from './[Domain].routes';

export const [Domain]Router = [
  <Route key="[domain]-list" path={[DOMAIN]_ROUTE} element={<[Entity]ListPage />} />,
  <Route key="[domain]-new" path={[DOMAIN]_NEW_ROUTE} element={<[Entity]NewPage />} />,
  <Route key="[domain]-update" path={[DOMAIN]_UPDATE_ROUTE} element={<[Entity]UpdatePage />} />,
];
```

---

## Template: `Hooks/useCache[Entities].ts`

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { [Domain]Service } from '../[Domain].service';

export const useCache[Entities] = () => {
  const queryClient = useQueryClient();
  const key = getQueryKey([Domain]Service.getAll);
  return {
    getData: () => queryClient.getQueryData(key),
    invalidate: () => queryClient.invalidateQueries({ queryKey: key }),
  };
};
```

---

## Template: `Hooks/useGet[Entities].ts`

```typescript
import { useURLParams } from '@app/Application/Hooks/useURLParams';
import { T[Entity]Search } from '../[Entity].entity';
import { [Domain]Service } from '../[Domain].service';

export const useGet[Entities] = () => {
  const { searchParams } = useURLParams<T[Entity]Search>();
  return [Domain]Service.getAll.useQuery(searchParams, {
    staleTime: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });
};
```

---

## Template: `Hooks/useGet[Entity].ts`

```typescript
import { [Domain]Service } from '../[Domain].service';

export const useGet[Entity] = (id: number) => {
  return [Domain]Service.get.useQuery(id, {
    enabled: !!id,
    staleTime: 1000,
  });
};
```

---

## Template: `Hooks/useAdd[Entity].ts`

```typescript
import { toast } from 'sonner';
import { [Domain]Service } from '../[Domain].service';
import { useCache[Entities] } from './useCache[Entities]';

export const useAdd[Entity] = () => {
  const cache = useCache[Entities]();
  return [Domain]Service.create.useMutation({
    onSuccess: () => {
      toast.success('Registro agregado');
      cache.invalidate();
    },
    onError: () => {
      toast.error('Registro no agregado');
    },
  });
};
```

---

## Template: `Hooks/useUpdate[Entity].ts`

```typescript
import { toast } from 'sonner';
import { [Domain]Service } from '../[Domain].service';
import { useCache[Entities] } from './useCache[Entities]';

export const useUpdate[Entity] = () => {
  const cache = useCache[Entities]();
  return [Domain]Service.update.useMutation({
    onSuccess: () => {
      toast.success('Registro actualizado');
      cache.invalidate();
    },
    onError: () => {
      toast.error('Error al actualizar');
    },
  });
};
```

---

## Template: `Hooks/useDelete[Entity].ts`

```typescript
import { toast } from 'sonner';
import { [Domain]Service } from '../[Domain].service';
import { useCache[Entities] } from './useCache[Entities]';

export const useDelete[Entity] = () => {
  const cache = useCache[Entities]();
  return [Domain]Service.delete.useMutation({
    onSuccess: () => {
      toast.success('Registro eliminado');
      cache.invalidate();
    },
    onError: () => {
      toast.error('Error al eliminar');
    },
  });
};
```

---

## Template: `Hooks/index.ts`

```typescript
export * from './useCache[Entities]';
export * from './useGet[Entities]';
export * from './useGet[Entity]';
export * from './useAdd[Entity]';
export * from './useUpdate[Entity]';
export * from './useDelete[Entity]';
```

---

## Template: `Components/index.ts`

```typescript
// Componentes específicos del dominio [Domain]
// Agregar exports aquí a medida que se crean los componentes
```

---

## Template: `Pages/[Entity]List.page.tsx`

> ⚠️ **ESTADOS OBLIGATORIOS (ver Convenciones de UI):** toda página que obtiene datos DEBE implementar `isError → EmptyScreenError`, `isLoading → Skeleton`, `empty → EmptyScreenFilter/EmptyState` en ese orden. NO dejar fallbacks `<Text.Muted>Cargando</Text.Muted>` ni texto suelto inline.

```tsx
import { EmptyScreenError, EmptyScreenFilter, Page } from '@app/Application';
import { useGet[Entities] } from '../Hooks';

export const [Entity]ListPage = () => {
  const { data, isLoading, isError, error } = useGet[Entities]();

  if (isError) return <EmptyScreenError message={error?.message} />;
  if (isLoading) return <[Entity]TableSkeleton />; // skeleton del dominio en Components/
  if (!data?.length) return <EmptyScreenFilter onClick={() => {}} />;

  return (
    <Page title="[Entities]">
      {/* TODO: Implementar lista con DataCollection */}
    </Page>
  );
};
```

---

## Template: `Pages/[Entity]New.page.tsx`

```tsx
export const [Entity]NewPage = () => {
  return (
    <div>
      <h1>Nuevo [Entity]</h1>
      {/* TODO: Implementar formulario */}
    </div>
  );
};
```

---

## Template: `Pages/[Entity]Update.page.tsx`

```tsx
import { useParams } from 'react-router-dom';
import { useGet[Entity] } from '../Hooks';

export const [Entity]UpdatePage = () => {
  const { id } = useParams<{ id: string }>();
  const { data } = useGet[Entity](Number(id));

  return (
    <div>
      <h1>Editar [Entity]</h1>
      {/* TODO: Implementar formulario con data */}
    </div>
  );
};
```

---

## Template: `Pages/index.ts`

```typescript
export * from './[Entity]List.page';
export * from './[Entity]New.page';
export * from './[Entity]Update.page';
```

---

## Template: `index.ts` (barrel público)

```typescript
export * from './[Entity].entity';
export * from './[Domain].service';
export * from './[Domain].routes';
export * from './[Domain].router';
export * from './Components';
export * from './Hooks';
export * from './Pages';
```

---

