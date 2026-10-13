# Contrato — Aceleración por paralelismo

**Feature**: `010-context-metrics-insights`
**Cubre**: FR-006..FR-010 · SC-003
**Implementa**: `Domains/Graph/lib/metrics/speedup.ts` (puro), `Domains/Graph/lib/metrics/summarizeSession.ts` (extender),
`Domains/Graph/Graph.entity.ts` (`TGroupSpeedup`, `TNodeSpeedup`, `speedup?`), `Domains/Inspector/Inspector.entity.ts` (`TSessionSpeedup`),
`Domains/Graph/lib/reconcile/comparators.ts` (`sameSpeedup`), `Domains/Graph/Components/SessionSummaryBar.tsx`.

---

## 1. Tipos

```ts
// Domains/Graph/Graph.entity.ts
export interface TGroupSpeedup {
  groupId: string;
  size: number;
  serialMs: number | null;
  wallMs: number;
  speedup: number | null;
  efficiency: number | null;
  provisional: boolean;
}

export interface TNodeSpeedup {
  groupId: string;
  size: number;
  serialMs: number | null;
  wallMs: number;
  speedup: number | null;
  efficiency: number | null;
  provisional: boolean;
}

export interface TSessionSpeedup {
  serialMs: number | null;
  wallMs: number | null;
  speedup: number | null;
}
// campo nuevo, opcional:
speedup?: TNodeSpeedup | null;
```

## 2. Derivación por grupo (FR-006, FR-007)

```ts
// Domains/Graph/lib/metrics/speedup.ts (puro)
export const deriveGroupSpeedup = (
  group: TParallelGroup,
  nodeById: Map<string, TGraphNode>,
  now: number,
): TGroupSpeedup;

export const deriveSpeedupByNode = (
  model: TGraphModel,
  now: number,
): Record<string, TNodeSpeedup>;
```

- `serialMs = Σ durationOf(miembro)`; `durationOf = metrics.durationMs ?? (nodeInterval end − start)`. `null` si algún miembro carece de duración calculable.
- `wallMs = group.endedAt − group.startedAt` (ventana de solape ya calculada por `deriveSiblingBatches`). `deriveSpeedupByNode` copia `serialMs`/`wallMs` a `TNodeSpeedup` para que el detalle los muestre sin recalcular el grupo.
- `speedup = wallMs > 0 && serialMs !== null ? serialMs / wallMs : null`.
- `efficiency = speedup !== null ? speedup / size : null`.
- `provisional = group.nodeIds.some(id => isActiveStatus(nodeById.get(id)!.data.status))`.

### Edge cases
- Grupo de 1 (no debería llegar; `deriveParallelGroups` filtra ≥ 2): no se produce `TNodeSpeedup`.
- `wallMs = 0` (todo instantáneo): `speedup = null` → UI "no disponible".
- Solape perfecto con duraciones iguales → `efficiency = 1`, `speedup = size`.

## 3. Aceleración global de sesión (FR-008)

```ts
export const deriveSessionSpeedup = (
  model: TGraphModel,
  now: number,
): TSessionSpeedup;
```

- `serialMs = Σ durationOf(todos los nodos)`.
- `wallMs` = longitud de la **unión** de `nodeInterval(node, now)` de todos los nodos (merge de intervalos solapados; no suma bruta).
- `speedup = wallMs > 0 && serialMs !== null ? serialMs / wallMs : null`.
- Se incorpora a `TSessionSummary` y lo muestra `SessionSummaryBar` como métrica "Paralelismo ×N".

## 4. Presentación (FR-009)

- **Nodo**: badge `×N` (una cifra) cuando `speedup !== null`; `provisional` atenúa la marca. Se muestra junto al indicador de paralelismo existente (`data.parallel`), sin añadir filas a `cardHeight` salvo el ancho reservado.
- **Detalle**: sección **Paralelismo** con tamaño del grupo, tiempo en serie, tiempo real, aceleración y eficiencia (ver `context-panel-contract.md`).
- **Resumen**: métrica global.

## 5. Comparador (recon)

`sameSpeedup(a, b)` compara `groupId`, `size`, `serialMs`, `wallMs`, `speedup`, `efficiency`, `provisional`. `sameNodeData` **debe** invocarlo.

## 6. Validación

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| P1 | `speedup = serial/wall` con duraciones y solape conocidos | spec puro `speedup.spec.ts` |
| P2 | Solape perfecto y duraciones iguales → `efficiency = 1`, `speedup = size` | spec puro |
| P3 | Solape parcial → `speedup < size` y `efficiency < 1` | spec puro |
| P4 | Miembro activo → `provisional = true` | spec puro |
| P5 | Duración ausente o `wallMs = 0` → `speedup = null` | spec puro |
| P6 | Global usa la unión de intervalos, no la suma bruta | spec puro |
| P7 | `sameSpeedup` propaga cambios | spec `reconcileGraph.spec.ts` extendido |
| P8 | `SessionSummaryBar` muestra la métrica global | spec de `SessionSummaryBar` extendido |
