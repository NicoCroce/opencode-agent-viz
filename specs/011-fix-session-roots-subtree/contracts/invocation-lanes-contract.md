# Contrato — Filas y badge de paralelismo por invocación (E4)

**Feature**: `011-fix-session-roots-subtree`
**Cubre**: FR-007, FR-008, FR-011, FR-012, FR-014, FR-016 · US5 · SC-003, SC-004, SC-008
**Implementa**: `Domains/Graph/lib/invocations.ts` (**nuevo**),
`Domains/Graph/lib/execution/executionKey.ts`, `Domains/Graph/lib/parallelism.ts`,
`Domains/Graph/lib/parallelByNode.ts`, `Domains/Graph/Hooks/useGraphStructure.ts`,
`Domains/Graph/Hooks/useGraphModel.ts`.

**Actualiza**: `specs/007-fix-parallel-lanes-live/spec.md` (FR-001/005/010, Edge Case l.113),
`contracts/execution-lanes-contract.md` §2/§6, `data-model.md`, `research.md` (FR-014).

---

## 1. Derivación pura (sin consultas nuevas)

```ts
// Domains/Graph/lib/invocations.ts
export interface TInvocation {
  sessionId: string | null;
  stepId: string;
  startedAt: number;
  endedAt: number | null;
  status: string;
  toolName: 'subagent' | 'task';
}

export const deriveInvocations: (messages: TSessionMessage[]) => TInvocation[];
export const deriveInvocationBatches: (invocations: TInvocation[]) => TInvocationBatch[];
```

- `SUBAGENT_TOOLS = { 'subagent', 'task' }` **duplicada** desde `Inspector/lib/deriveTasks.ts:8` (Principio II), con comentario al origen.
- `sessionId` = `state.metadata.sessionID`; `stepId` = id del mensaje assistant que contiene la tool call; tiempos del tool part.
- **Sin consultas nuevas**: los mensajes ya están en `queryKeys.sessions.messages(id)`. Se deriva **solo para nodos con hijos**, memoizado por `(sessionId, identidad de los mensajes)`.
- **Fin de la invocación (FR-016)**: `endedAt = time.completed` del tool part del padre; si `state.input.background === true`, `max(completed, fin de la sesión hija)` — 0 casos medidos, documentado y no generalizado.

## 2. Agrupamiento por paso (FR-007/FR-011)

- `deriveInvocationBatches` agrupa por `stepId` del padre: 2+ invocaciones en el mismo paso = **lote paralelo**.
- Una sesión reutilizada en dos pasos aporta **dos invocaciones** y participa en **dos lotes** (el nodo sigue siendo único por sesión).
- El solape se calcula **entre invocaciones**; pasos secuenciales **no** caen en la misma fila.

## 3. Paridad fila ↔ badge (FR-008)

- `deriveExecutionLevels` (filas/carriles) y `parallelByNode` (badge) se alimentan de la **misma** fuente de lotes. **La invocación gana** cuando existe.
- **`deriveExecutionKey` incorpora la firma de lotes** (ids + miembros). Sin esto, al llegar los mensajes del padre el memo por clave no se invalida, las filas no cambian y E4 es un **no-op silencioso** que rompe FR-008.
- **La paridad exigida es fila ↔ badge, no barra ↔ fila**: la barra temporal del nodo mantiene el intervalo de sesión (`executionInterval`), mientras filas y badge usan la ventana de la invocación. La diferencia se **documenta**; no se unifica en esta feature.

## 4. Respaldo (FR-012)

- En la fase estructural (padre sin mensajes) manda el solape por **sesión** de `deriveSiblingBatches`, que **no se toca**; `deriveParallelGroups` se conserva para no romper sus specs.
- `parallelByNode` **combina** ambas fuentes: invocación (si existe) > solape de sesión. Sin regresión del comportamiento estructural (contrato de carga §1.1 de `006`).

## 5. Criterios de aceptación

| # | Criterio | Cómo se valida |
|---|---|---|
| E1 | Paso con 2+ invocaciones → un lote | spec puro `invocations.spec.ts` |
| E2 | Sesión reutilizada en dos pasos → 2 invocaciones y **2** lotes | spec puro |
| E3 | Pasos secuenciales → lotes distintos (no se fusionan) | spec puro |
| E4 | `deriveExecutionKey` cambia al llegar la firma de lotes (filas cambian; no no-op) | `executionKey.spec.ts` + `useGraphModel.spec.tsx` |
| E5 | Paridad fila ↔ badge en el 100 % de las sesiones observadas | spec nuevo de paridad |
| E6 | Caso `background` documentado (fin = tool part; fallback `max`) | spec puro |
| E7 | Padre sin mensajes → agrupamiento estructural sin regresión (respaldo) | `parallelism.spec.ts` |
