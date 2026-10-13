# Contrato — Subárbol del grafo y estados de pantalla (E2)

**Feature**: `011-fix-session-roots-subtree`
**Cubre**: FR-003, FR-004, FR-005, FR-006, FR-013 · US2, US3, US4 · SC-002, SC-006, SC-008, SC-009
**Implementa**: `Domains/Graph/lib/loadPlan/subtree.ts` (**nuevo**),
`Domains/Graph/Hooks/useGraphStructure.ts`, `Domains/Graph/Hooks/useGraphModel.ts`,
`Infrastructure/Components/GraphPane.tsx`, `Application/Components/Molecules/GraphTruncationBanner.tsx` (**nuevo**),
`Infrastructure/Hooks/useSessionOpenPerf.ts`.

**Actualiza**: `specs/006-graph-render-performance/contracts/graph-loading-contract.md` §1.1 (FR-013).

---

## 1. Cargador puro

```ts
// Domains/Graph/lib/loadPlan/subtree.ts
export interface TSubtreeLoadResult {
  sessions: SessionInfo[];
  truncated: boolean;
  loadedCount: number;
  reason?: string;
  notFound?: boolean;
}

export const loadSubtree: (input: {
  sessionId: string;
  roots: readonly SessionInfo[];   // todas las raíces (tras E1)
  getSession: (id: string) => Promise<SessionInfo>;
  listChildren: (parentID: string) => Promise<SessionInfo[]>;
}) => Promise<TSubtreeLoadResult>;
```

- **Resolver la raíz**: si `sessionId ∈ roots` → **fast path, 0 requests** de subida. Si es descendiente → subir con `ancestorChain` (`traversal.ts:6`) usando `getSession`.
- **BFS descendente** con `Promise.all` **por nivel**; guarda anti-ciclo (precedente `filterSubtree.ts:28`); `parentID` ausente ignorado.
- **Bosque plano ⇒ 1 request por raíz**; el coste escala con nodos internos, no con nodos.
- **Presupuesto global** de nodos/requests (no tope por padre), alineado al techo ~200 de `006`. Al superarlo: `truncated = true`, se corta y se expone `reason`/`loadedCount` (nunca recorte silencioso).
- `sessionId` inexistente → `notFound = true` con `sessions: []` (FR-005).

## 2. Frescura en vivo (D5)

- El subárbol vive bajo `sessions.children(parentID)` (no bajo `sessions.all`): los 8 tipos de evento de sesión **no** re-ejecutan el BFS.
- El árbol se refresca refrescando **explícitamente la profundidad 1** de la raíz observada en `session.created` / `session.deleted` (los dos eventos que cambian el árbol); V2 no trae `parentID` en `session.created`, así que no se puede invalidar la key exacta del padre.
- Ninguna consulta de **contenido** (mensajes/log/permisos/formularios/inbox) se abre en la fase estructural: se preserva el criterio L4 de `006`.

## 3. Hook `useGraphStructure`

- Deja de leer `sessions.list`; deriva el modelo estructural desde el subárbol + `status()` + `activity()` + `agents.list(directory)`.
- El plan/las posiciones/los grupos siguen memoizados por `deriveExecutionKey` (ver [invocation-lanes-contract.md](./invocation-lanes-contract.md)).
- `filterSubtree` se conserva como función pura (API del barrel) y recibe spec propio.

## 4. Estados de pantalla (Principio VI, FR-004/FR-005)

- `isLoading = directorio pendiente de resolución || isLoading(estructura)`; ambas cargas son **acotadas** (terminan al resolver o fallar), nunca terminales.
- `isError = isError(estructura)` (fallo de red/servidor de la estructura). El fallo del directorio **no** entra aquí.
- `notFound = notFound(estructura) || fallo de resolución del directorio`. **Limitación conocida**: el fallo del respaldo del directorio no se distingue de «sesión inexistente» (ambos llegan igual), así que se resuelve como «no encontrada».
- Orden en `GraphPane`: **error → loading acotada → no encontrada → vacío → datos**.
- Sesión inexistente → `EmptyState` "no encontrada" con acción a `/sessions`, **distinta** de "sin agentes", vía `notFound: boolean` **aditivo** en `UseGraphModelResult` (no rompe la forma pública; RFC); estado **no terminal**, con salida al listado.
- Nunca un estado de carga terminal sin salida (SC-002). `EmptyScreenFilter` no aplica.
- `useSessionOpenPerf` se reapunta a la key nueva del subárbol (arrastra `WorkspacePage.spec.tsx`, `WorkspacePage.perf.spec.tsx`).

## 5. Banner de truncamiento (FR-006, SC-009)

`GraphTruncationBanner` (`Application/Components/Molecules/`), montado en `GraphPane` **entre cabecera y lienzo**:

- `Alert` compartido, `variant="warning"`; `role="status"`, `aria-live="polite"` (patrón `ConnectionBadge`); **no** `role="alert"` (lo ocupa el banner de atención del chat).
- **Informativo puro**: sin acción y sin cifras del tipo "N de M".
- Persiste mientras `truncated`; no bloquea (el grafo sigue usable); no se re-anuncia por tick.
- El mismo componente/criterio se reutiliza para el corte del **listado de raíces**.

## 6. Criterios de aceptación

| # | Criterio | Cómo se valida |
|---|---|---|
| S1 | Subárbol con hijos fuera de la primera página → el grafo los incluye | `useGraphStructure.spec.tsx` |
| S2 | Raíz fuera de `items` → `session.get` resuelve y el grafo carga (no skeleton terminal) | `useGraphStructure.spec.tsx` / `WorkspacePage.spec.tsx` |
| S3 | `truncated` → banner visible; subárbol completo → sin banner | spec de `GraphTruncationBanner` + hook |
| S4 | Sesión inexistente → "no encontrada" con acción; error de red → `EmptyScreenError` | `useGraphModel.spec.tsx` / `GraphPane.spec` |
| S5 | La fase estructural no abre consultas de contenido (L4 de 006) | spía de `opencodeService` |
| S6 | Diagonal del presupuesto: `truncated` se activa por presupuesto global, nunca por tope por padre | spec puro de `loadSubtree` |
| S7 | `filterSubtree` conserva comportamiento (API del barrel) | `filterSubtree.spec.ts` (**nuevo**) |
