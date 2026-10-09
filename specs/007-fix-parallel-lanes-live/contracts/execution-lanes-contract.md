# Contrato — Intervalo de ejecución, filas y badge de paralelismo

**Feature**: `007-fix-parallel-lanes-live`
**Cubre**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-010, FR-011 · SC-001, SC-002, SC-003, SC-004, SC-005
**Implementa**: `Domains/Graph/lib/execution/nodeInterval.ts`, `Domains/Graph/lib/execution/executionKey.ts`,
`Domains/Graph/lib/execution/deriveExecutionLayout.ts`, `Domains/Graph/lib/parallelism.ts`,
`Domains/Graph/Hooks/useGraphStructure.ts`, `Domains/Graph/Hooks/useGraphModel.ts`.

---

## 1. Intervalo de ejecución (puro, sin reloj en el agrupamiento)

```ts
// lib/execution/nodeInterval.ts
export const startOf = (node: TGraphNode): number;
export const endOf = (node: TGraphNode, now: number): number;
export const nodeInterval = (node: TGraphNode, now: number): [number, number];
export const executionInterval = (node: TGraphNode): [number, number];
```

| Función | Activo (`isActiveStatus`) | Terminado |
|---------|---------------------------|-----------|
| `startOf` | `createdAt ?? metrics.startedAt ?? 0` | igual |
| `endOf(node, now)` | `now` (abierto hasta el presente observado) | `updatedAt ?? metrics.endedAt ?? now` |
| `executionInterval` | `[startOf, +∞)` | `[startOf, max(startOf, endOf(node, 0))]` |

- **Activo** = `isActiveStatus(node.data.status)` ∈ {`running`, `retrying`, `compacting`, `waiting-permission`, `waiting-input`}. Nunca se infiere de datos ausentes (FR-011).
- **`+∞` para activos**: para el **solape**, modelar el fin abierto como `+∞` es equivalente a evaluar en cualquier `now ≥ max(inicio)`. Un terminado solapa a un activo si y solo si su fin es posterior al inicio del activo. Esto desacopla el agrupamiento del reloj (FR-008, Principio V) y elimina la sensibilidad al `now` congelado del montaje.

## 2. Agrupamiento de hermanos (`lib/parallelism.ts`)

`deriveSiblingBatches(model)` / `deriveParallelGroups(model)`:

- Agrupa **hermanos** (mismo padre por aristas) por **componentes conexas del grafo de solape** de `executionInterval` (union-find). Solape transitivo.
- Incluye lotes de 1. Nunca empareja padre con hijo (niveles distintos).
- Una **sola** implementación de intervalo: se elimina el `intervalOf` privado; el módulo consume `executionInterval`. Esto garantiza FR-010 (badge = fila).
- Orden estable de lotes por instante de inicio, desempate por `parentId` y primer `nodeId`.

## 3. Clave de ejecución y recálculo (`lib/execution/executionKey.ts`)

```ts
export const deriveExecutionKey = (model: TGraphModel): string;
```

- Compone `topologySignature(model)` con, por nodo, `id:start:('open' | finSinReloj)`.
- **Disparadores de recálculo** (FR-003): aparición/desaparición de nodos, cambio de padre, transición activo↔terminado, cambio del fin real de un terminado.
- **No disparadores** (FR-007, SC-004): tick de 1 s, eventos de contenido/estado no estructurales, hover/selección.

## 4. Derivación del layout (`lib/execution/deriveExecutionLayout.ts`)

```ts
export interface TExecutionLayout {
  graph: TGraphModel;
  plan: TExecutionPlan;
  positions: Record<string, { x: number; y: number }>;
  parallelGroups: TParallelGroup[];
  parallelByNode: Record<string, TNodeParallelism>;
}
export const deriveExecutionLayout = (model: TGraphModel, now: number): TExecutionLayout;
```

- `plan = deriveExecutionLevels(model, now)` (niveles = tandas de hermanos concurrentes; raíz en nivel 0; normalización padre→hijo).
- `positions = indexPositions(layoutExecution(model, plan).nodes)`.
- `parallelGroups = deriveParallelGroups(model, now)`; `parallelByNode = toParallelByNode(parallelGroups)`.
- `graph = assembleStructuralGraph(model, positions, parallelByNode)`.
- **Ventanas congeladas con la clave** (A2): `plan.levels[].startedAt/endedAt` se calculan con el `now` vigente en el momento de derivar y quedan **congeladas** mientras `deriveExecutionKey(model)` no cambie. El agrupamiento, los niveles y las columnas **no** dependen del reloj (FR-008); `now` solo refresca las ventanas informativas de los carriles cuando la clave cambia (nuevo nodo, transición activo↔terminado, cambio de fin real). El tick de 1 s no recalcula el plan (FR-007, SC-004).

## 5. Responsabilidad de los hooks

- **`useGraphStructure`**: lee `sessions.activity()` y construye el modelo estructural (`updatedAt` fresco, `EMPTY_METRICS`, `enrichment: 'pending'`). Deriva el plan/paralelismo **estructural** memoizado por `deriveExecutionKey(model)`. Primer pintado.
- **`useGraphModel`**: compone estructura + enriquecimiento; deriva el plan/paralelismo **autoritativo** desde el modelo **enriquecido** (estados finales, incluidos `compacting`/esperas) memoizado por `deriveExecutionKey(enriched)`, con `now` vivo (`useNow({ enabled: hasActiveNode })`) leído vía ref para las ventanas. Devuelve `executionPlan`/`parallelGroups` autoritativos; el tick de 1 s solo ajusta `durationMs` sobre el grafo ya posicionado.
- La **API pública de `UseGraphModelResult` no cambia** (FR de 006, L8): `graph`, `parallelGroups`, `executionPlan`, `activeNodeId`, `isLoading`, `isError`, `error`.

## 6. Invariantes de disposición

1. **Paridad en vivo/refresco** (FR-004, SC-002/SC-005): un mismo estado de sesiones produce la misma disposición, se acabe de abrir o lleve tiempo abierta. La marca de actividad (ver [session-activity-contract.md](./session-activity-contract.md)) iguala los tiempos en vivo con los del servidor.
2. **Estabilidad** (FR-007, SC-004): 0 saltos de fila/orden ante eventos no estructurales o tick.
3. **Determinismo** (FR-006): columnas por `startOf`, desempate por `id`; sin `Date.now()` en el agrupamiento.
4. **No solapados en filas distintas** (FR-005): intervalos disjuntos → grupos distintos; orden temporal antes arriba.
5. **Badge coherente** (FR-010): `data.parallel` proviene de los mismos grupos que asignan niveles/columnas.

## 7. Criterios de aceptación del contrato

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| E1 | `executionInterval` abre activos (`+∞`) y cierra terminados con fin real | spec puro `nodeInterval.spec.ts` |
| E2 | `deriveSiblingBatches` agrupa activos concurrentes creados con diferencia y separa secuenciales | spec puro `parallelism.spec.ts` |
| E3 | `deriveExecutionKey` cambia con topología y con la clase/borde de intervalo; estable ante eventos no estructurales | spec puro `executionKey.spec.ts` |
| E4 | `deriveExecutionLayout` devuelve plan/posiciones/grupos coherentes y no muta la entrada | spec puro `deriveExecutionLayout.spec.ts` |
| E5 | Filas paralelas en vivo desde el modelo enriquecido y estables tras refresco (paridad) | spec de hook `useGraphModel.spec.tsx` |
| E6 | Plan estructural correcto y sin consultas de contenido (L4 de 006 se preserva) | spec de hook `useGraphStructure.spec.tsx` |
| E7 | 0 saltos de fila ante tick/eventos no estructurales | spec de hook (identidad de posiciones) |
| E8 | Badge de paralelismo coincide con la fila | spec puro `parallelism.spec.ts` (T025: `data.parallel` = filas) + `AgentNodeHeader`/`AgentNode` existentes |
