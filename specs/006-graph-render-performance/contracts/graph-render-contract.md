# Contrato — Render estable del grafo

**Feature**: `006-graph-render-performance`
**Cubre**: FR-005, FR-007 · SC-004, SC-006
**Implementa**: `Domains/Graph/lib/reconcileGraph.ts`, `Domains/Graph/Components/NodeFocusContext.tsx`,
`Domains/Graph/Components/AgentGraph.tsx`, `Domains/Graph/Components/AgentNode.tsx`,
`Domains/Graph/Components/InvocationEdge.tsx`, `Domains/Graph/lib/buildViewNodes.ts`.

---

## 1. Identidad estable de nodos y aristas

### 1.1 `reconcileGraphModel(prev, next)`

```ts
import type { TGraphModel } from '../Graph.entity';

export const reconcileGraphModel = (
  prev: TGraphModel | null,
  next: TGraphModel,
): TGraphModel;
```

**Garantías (verificables por identidad `===`)**:

1. Si `prev` es `null` → devuelve `next` tal cual.
2. Para cada nodo de `next`, si existe un nodo en `prev` con **mismo `id`**, **misma `position`** (x e y) y **mismo `data`** comparado campo a campo (incluido `metrics`, `status`, `enrichment`), el objeto `node` devuelto es **el mismo de `prev`** (`result.nodes[i] === prevNode`).
3. `result.edges === prev.edges` si `topologySignature(prev) === topologySignature(next)`; en caso contrario devuelve `next.edges`.
4. El array `result.nodes` es un array nuevo si algún nodo difiere; si **todos** los nodos se reutilizan y el orden es idéntico, **puede** devolver `prev.nodes`.
5. No muta `prev` ni `next` (función pura, Principio V).

**Consecuencia**: `AgentNode`/`InvocationEdge` (`React.memo`) solo re-renderizan cuando sus props cambian realmente. Un tick de `now` que solo altera `durationMs` de nodos activos re-renderiza **solo esos nodos**.

### 1.2 Estabilidad frente a hover y selección

**Regla**: el array `nodes`/`edges` que recibe `<ReactFlow>` **no cambia de referencia** cuando cambia `hoveredNodeId` o `selectedNodeId`.

Esto implica:
- El `useMemo` de `edges` en `AgentGraph` **no** incluye `hoveredNodeId` ni `lineage` en sus dependencias. Sus dependencias son `graph.edges`, `plan.columnByNode` y la firma de topología.
- El `useMemo` de `nodes` **no** incluye `selectedNodeId` ni `lineage`. Sus dependencias son `graph.nodes`, `overrides` y `plan`/`rowLayout`.
- El estado de foco se publica por **contexto** (sección 2), no por `data`/`style`.

## 2. Contexto de foco (`NodeFocusContext`)

```ts
export interface TNodeFocus {
  /** Selección explícita; `null` = sin foco. */
  selectedNodeId: string | null;
  /** Conjunto de ids en el linaje (ancestros + descendientes) del seleccionado. */
  lineageNodeIds: ReadonlySet<string>;
  /** Conjunto de ids de aristas del linaje. */
  lineageEdgeIds: ReadonlySet<string>;
  /** Nodo bajo el cursor; `null` = sin hover. */
  hoveredNodeId: string | null;
}

export const NodeFocusProvider: React.FC<{ value: TNodeFocus; children: React.ReactNode }>;

/** Devuelve el foco; fuera de un provider devuelve la constante sin foco. */
export const useNodeFocus = (): TNodeFocus;
```

**Contrato de resaltado** (idéntico al comportamiento actual, FR-007):

| Situación | Extremo | Regla |
|-----------|---------|-------|
| Sin foco | — | aristas `stroke = hsl(var(--muted-foreground))`, `strokeWidth = 1.25`, `opacity = 0.45` |
| Foco (linaje) | en linaje | arista `stroke = hsl(var(--foreground))`, `strokeWidth = 2`, `opacity = 1` |
| Foco (linaje) | fuera | arista `opacity = 0.15`, color/tamaño por defecto |
| Hover sin foco | incidente | arista `stroke = hsl(var(--foreground))`, `strokeWidth = 1.6`, `opacity = 1` |
| Foco (linaje) | nodo | nodo `opacity = 1`; fuera del linaje `opacity = 0.15` |

**Precedencia**: el foco (selección/linaje) gana sobre el hover; el hover solo actúa cuando no hay selección. Es la regla actual de `AgentGraph` y no cambia.

**Sin foco por defecto**: `useNodeFocus()` fuera de provider devuelve `EMPTY_NODE_FOCUS` (`selectedNodeId: null`, sets vacíos, `hoveredNodeId: null`), de modo que los specs de `AgentNode`/`InvocationEdge` que no montan el provider siguen funcionando.

## 3. Altura calculada una sola vez

`buildViewNodes(nodes, overrides, selectedNodeId, isChainMode)` devuelve cada `TGraphViewNode` con:

```ts
width = override?.width ?? NODE_WIDTH;
height = override?.height ?? cardHeight(node.data, width);
```

**Contrato**: `AgentGraph` **no** vuelve a llamar `cardHeight`; usa `node.height` de la salida de `buildViewNodes` para construir `heightByNode` y `rowLayout`. La firma de `buildViewNodes` no cambia (seguirá recibiendo `selectedNodeId`, que se puede seguir usando para `selected`; opcionalmente se puede difuminar hacia el contexto, pero la función mantiene su contrato para no romper sus specs).

## 4. Invariante de paridad (FR-007, SC-006)

Dado un conjunto de fixtures representativas (al menos `run.ndjson` y `run.v2.ndjson`):

> Con todos los nodos en `enrichment === 'ready'`, el `TGraphModel` derivado —nodos, aristas, `status`, `metrics`, `retry`, `interruptReason`, `model`, `currentTool`, `parallel`— es **campo a campo igual** al generado por la implementación de línea base.

`enrichment` es el único campo nuevo de `TGraphNodeData` y **no** participa de la comparación de paridad visual de negocio. Se valida con un spec de paridad (`buildGraph.spec.ts` extendido + fixture).

## 5. Criterios de aceptación del contrato

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| C1 | `reconcileGraphModel` reutiliza nodos idénticos (`===`) | spec puro `reconcileGraph.spec.ts` |
| C2 | `edges` estable si la topología no cambia | spec puro + spec de `AgentGraph` (referencia del array) |
| C3 | hover/selección no recrean `data` ni arrays | spec de `AgentGraph` con `rerender` y espiado de render de `AgentNode` |
| C4 | resaltado por contexto idéntico a la tabla §2 | specs de `AgentNode`/`InvocationEdge` |
| C5 | `cardHeight` no se recalcula | spec de `buildViewNodes` (mock/spy de `cardHeight`) |
| C6 | paridad campo a campo | spec de paridad sobre fixtures |
