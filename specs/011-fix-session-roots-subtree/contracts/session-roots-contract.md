# Contrato — Listado de raíces (E1)

**Feature**: `011-fix-session-roots-subtree`
**Cubre**: FR-001, FR-002, FR-003, FR-015 · US1, US2 · SC-001, SC-005, SC-009
**Implementa**: `Infrastructure/Services/lib/sessionPagination.ts` (**nuevo**),
`Infrastructure/Services/session.service.ts`, `Domains/queryKeys.ts`,
`Domains/Sessions/Hooks/useRootSessions.ts`, `Infrastructure/WorkspacePage.tsx`.

---

## 1. Paginación por cursor (pura)

```ts
// Infrastructure/Services/lib/sessionPagination.ts
export const SESSION_PAGE_SIZE = 200;
export const SESSION_MAX_PAGES = 25; // techo 5.000 raíces/directorio

export interface TRootSessionsResult {
  sessions: SessionInfo[];
  truncated: boolean;
}
```

- Patrón `messagePagination.ts`: `order: 'desc'` **solo en la primera página** (la API rechaza `cursor` + `order`); el cursor ya fija la dirección.
- `truncated = true` ⟺ se agotaron las `SESSION_MAX_PAGES` con `cursor.next` todavía presente.
- Sin duplicados (el cursor avanza); `sessions` es la concatenación de páginas en orden.

## 2. Servicio (SDK solo aquí — Principio III)

```ts
// session.service.ts — SessionReadService
listRootSessions: (directory?: string) => Promise<TRootSessionsResult>;
listChildSessions: (parentID: string) => Promise<SessionInfo[]>; // + paginación
getSession: (id: string) => Promise<SessionInfo>;
```

- `listRootSessions` → `session.list({ directory, parentID: null, limit: SESSION_PAGE_SIZE, order: 'desc' })` + bucle por cursor.
- `listSessions` se conserva hasta E2 (el grafo aún lo usa) y deja de usarse al cerrar E2.

## 3. Clave de caché

- `queryKeys.sessions.roots(directory) = [...sessions.all, directory, 'roots']` (D3).
- La invalidación por prefijo de `sessions.all` (8 tipos de evento) **alcanza** la key y **no** alcanza `graph`/`metrics`/`permissions`. `staleTime: Infinity` **no** protege de la invalidación por prefijo.

## 4. Hook `useRootSessions`

- Consume `listRootSessions` con la key nueva (por `directory` de cada proyecto).
- Conserva `.filter((s) => s.parentID === undefined)` como **defensa en profundidad** (comentario explicando que el server ya filtra).
- Orden por `time.updated` **desc**; agrupa por `location.directory`.
- Expone `truncated` agregado por proyecto para el aviso del listado.
- **Memoiza** `items`/`groups` (coste de render: 15→38 tarjetas) y `SessionCard` con `React.memo` si el spec de render lo exige.

## 5. Resolución del `directory` (FR-003)

`WorkspacePage.tsx`: `items` → `session.get({ sessionID })` → `null`.

- Key de respaldo **por id**: `['sessions','directory', id]`, `staleTime: Infinity` (no `sessions.detail(directory, id)`: el `directory` aún no se conoce — R3).
- Una raíz fuera de la ventana deja de colgar la página: al resolver el `directory`, el subárbol carga (US2).

## 6. Criterios de aceptación

| # | Criterio | Cómo se valida |
|---|---|---|
| R1 | `listRootSessions` envía `parentID: null` y pagina con cursor (2 páginas → 2 requests, sin duplicados, `order` solo en la 1ª) | spec de `sessionPagination` + `session.service.spec` |
| R2 | El listado muestra todas las raíces y ninguna hija, orden desc por carpeta | `useRootSessions.spec.tsx` con hijas mezcladas |
| R3 | >200 sesiones mixtas → todas las raíces visibles (regresión del bug) | `SessionList.page.spec.tsx` |
| R4 | Sesión fuera de `items` → cae a `session.get`, resuelve `directory` y **no** queda en loading | `WorkspacePage.spec.tsx` |
| R5 | `truncated` del listado se declara con el banner informativo puro (`role="status"`, sin cifras ni acción) | spec de `GraphTruncationBanner` + integración |
| R6 | El refresco no se encarece (payload 200→38, sin consultas nuevas) | medición / `WorkspacePage.perf.spec.tsx` reapuntado |
