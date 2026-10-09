---
name: front-ddd-generator
description: Genera el esqueleto de un dominio nuevo en `src/Domains/` (entity, service, query keys, rutas, router, hooks, página, barrel) siguiendo la arquitectura del visor. Usar al crear un dominio nuevo, no para editar uno existente.
---

# Front DDD Generator

Crea el esqueleto de `src/Domains/<Domain>/`. Las reglas de fondo están en `AGENTS.md` y `.opencode/instructions/app.instructions.md`; esta skill solo indica qué archivos crear y dónde registrarlos.

## Antes de crear

1. Comprueba que el dominio no existe: `ls src/Domains`.
2. Define: nombre del dominio (PascalCase plural), entidad (singular), si necesita página y ruta, y qué datos del SDK consume.
3. Mira un dominio vivo como referencia de estilo: `src/Domains/Sessions/`.
4. Muestra el árbol a crear y espera confirmación si el usuario no lo especificó.

## Árbol

```
src/Domains/<Domain>/
├── <Entity>.entity.ts
├── <Domain>.service.ts
├── <Domain>.routes.ts          # solo si hay página
├── <Domain>.router.tsx         # solo si hay página
├── Components/index.ts
├── Hooks/
│   ├── use<Action><Entity>.ts
│   ├── specs/use<Action><Entity>.spec.tsx
│   └── index.ts
├── Pages/                      # solo si hay página
│   ├── <Entity><Action>.page.tsx
│   └── index.ts
├── specs/                      # tests del service y fixtures
└── index.ts
```

## Reglas por archivo

- **entity**: tipos con prefijo `T`, derivados de `@opencode/client`. Sin interfaces manuales salvo tipos locales de filtros (`T<Entity>Search`).
  ```ts
  import type { SessionInfo } from '@opencode/client';
  export type TSession = SessionInfo;
  ```
- **service**: solo hooks de TanStack Query. El acceso al SDK pasa siempre por `opencodeService` de `@app/Infrastructure/Services/opencodeClient`; nunca se llama al cliente directamente. Claves de `queryKeys` de `src/Domains/queryKeys.ts`.
  ```ts
  export const useGet<Entities> = (directory: string | null) =>
    useQuery({
      queryKey: queryKeys.<entities>.list(directory ?? ''),
      queryFn: () => opencodeService.list<Entities>(directory as string),
      enabled: Boolean(directory),
    });
  ```
- **queryKeys**: añade la rama del dominio a `src/Domains/queryKeys.ts` con `all` y las claves necesarias.
- **routes**: constantes `<ENTITY>_<ACTION>_ROUTE` sin JSX (`.ts`).
- **router**: array exportado `<Domain>Router` con `<Route key=... />`.
- **hooks**: concentran la lógica y combinan el service. Los componentes y las páginas no llaman al service directamente.
- **page**: envuelta en `<Page title="...">` de `@app/Application/Components`. Estados en este orden: `isError` → `<EmptyScreenError />`, `isLoading` → skeleton del dominio, sin datos → `<EmptyScreenFilter />` o `<EmptyState />`, datos.
- **Components**: presentación pura. Layout con `<Container>`, no con `div` + `flex`. Skeleton del dominio en `Components/`.
- **barrel `index.ts`**: reexporta entity, service, routes, Components, Hooks, Pages y el router.

## Registro global

1. `src/Infrastructure/Routes.tsx`: importar `<Domain>Router` desde `@app/Domains/<Domain>` y añadirlo dentro de `<Route element={<AppShell />}>` (`{<Domain>Router}`).
2. `src/Domains/queryKeys.ts`: la rama nueva.

## Restricciones

- No importes `@app/Domains/<OtroDominio>` desde un componente; si hace falta cruzar dominios, hazlo en el hook.
- Sin magic strings: extrae constantes.
- Sin `md:hidden` / `hidden md:block`; usa `useDevice()`.
- Los tests van en `specs/` junto al código, nunca mezclados con los fuentes.

## Verificación

```
pnpm tsc && pnpm lint && pnpm test
```
Corrige los errores antes de dar el dominio por creado.
