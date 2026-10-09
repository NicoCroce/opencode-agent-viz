---
name: test-generator
description: Guía para escribir tests de reglas reales (no stubs) en este visor con Vitest + Testing Library. Cubre lógica pura, services, hooks y componentes, usando specs existentes como canon.
---

# Test Generator

Tests con Vitest + Testing Library + jsdom. Configuración en `vitest.config.ts`; setup en `src/test/setup.ts`.

## Dónde van

- En una carpeta `specs/` junto al código, con la misma estructura. Nunca mezclados con los fuentes.
- Nombre: `<Archivo>.spec.ts` o `<Archivo>.spec.tsx`.
- Antes de crear un spec, mira si ya existe para ese archivo y añade casos; no lo sobreescribas.

## Canon (copia la estructura del que corresponda)

| Qué testeas | Referencia |
|---|---|
| Hook con TanStack Query | `src/Domains/Sessions/Hooks/specs/useRootSessions.spec.tsx` |
| Hook con estado local | `src/Domains/Sessions/Hooks/specs/useSessionFilters.spec.tsx` |
| Service (queries) | `src/Domains/Sessions/specs/Sessions.service.spec.tsx` |
| Página | `src/Domains/Sessions/Pages/specs/` |
| Fixtures | `src/Domains/Sessions/specs/fixtures.ts` |

Si el archivo que vas a testear tiene un vecino con spec, usa ese como canon.

## Qué validar

- **Funciones puras** (reductor de eventos, `buildGraph()`, derivaciones): entradas concretas y salida exacta; casos límite y vacíos.
- **Hooks**: la query usa la clave y los parámetros correctos; estados `isLoading` / `isError` / datos; el resultado derivado.
- **Mutations**: llamada con argumentos exactos e invalidación de queries.
- **Componentes**: presentación de los estados de pantalla (error, loading, vacío, datos) y los eventos del usuario.
- **Eventos SSE**: usa eventos reales grabados en `__fixtures__/`, no inventados.

Datos concretos siempre. Nada de `it.todo`, stubs vacíos ni `any` (usa el tipo real o `as never`).

## Mocks

- El SDK se mockea siempre en la frontera `@app/Infrastructure/Services/opencodeClient`, devolviendo datos con la forma real:
  ```ts
  vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
    opencodeService: { listProjects: vi.fn(() => Promise.resolve([...])) },
  }));
  ```
- Renderiza con `renderWithProviders` (`src/test/renderWithProviders.tsx`) o con un `QueryClient` de test (`createTestQueryClient`, `retry: 0`).
- Mockea solo la frontera, no tus propios hooks ni funciones puras.

## No requieren tests

`*.routes.ts`, `*.router.tsx`, `index.ts`, `Pages/**` sin lógica y componentes puramente visuales. Un archivo merece test si tiene derivaciones, reglas de negocio, llamadas con argumentos específicos o manejo de errores.

## Ejecutar

```
pnpm test            # todo
pnpm vitest run <ruta-del-spec>
```
