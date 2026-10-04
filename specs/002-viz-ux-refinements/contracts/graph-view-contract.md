# Contract — Vista del grafo (`Domains/Graph/`)

Cubre US1 (resize) y US2 (modo cadena). Las funciones de `lib/` son puras y sin React (Constitución V).

## `buildChain()` — `lib/chainGraph.ts`

```ts
function buildChain(model: TGraphModel, nodeId: string): TGraphModel | null;
```

- Recorre los **ancestros** desde `nodeId` siguiendo las aristas en sentido `target → source` hasta la raíz de la sesión.
- Devuelve los nodos en orden `raíz → … → nodeId` y las aristas que los conectan.
- Devuelve `null` si `nodeId` no está en `model` (el llamador usa el grafo completo).
- No incluye descendientes ni ramas hermanas (FR-005).
- Caso `nodeId === raíz`: cadena de un solo nodo, sin aristas (edge case).

## `layoutChain()` — `lib/chainGraph.ts`

```ts
function layoutChain(model: TGraphModel): TGraphModel;
```

- Asigna posiciones en **una sola fila**: `x = index * (NODE_WIDTH + CHAIN_GAP)`, `y = 0`, respetando el orden recibido (FR-006).
- `CHAIN_GAP` es una constante nueva definida en `lib/chainGraph.ts` (no existe en `layoutGraph.ts`).
- Determinista y O(n); no usa dagre.

## `reduceNodeOverrides()` — `lib/nodeResize.ts`

```ts
// El tipo vive en Graph.entity.ts (estado de vista, prefijo T — Principio IV).
import type { TNodeSizeOverride } from '../Graph.entity';

function reduceNodeOverrides(
  overrides: Record<string, TNodeSizeOverride>,
  changes: NodeChange<TGraphNode>[],
): Record<string, TNodeSizeOverride>;
```

- Procesa `NodeDimensionChange` con `dimensions` definidas → actualiza `width`/`height` (aplica `MIN_NODE_WIDTH`/`MIN_NODE_HEIGHT`).
- Procesa `NodePositionChange` emitido por el resize → actualiza `x`/`y` (permite agrandar desde arriba/izquierda).
- Ignora selección y cualquier otro cambio; no muta la entrada (devuelve un mapa nuevo).
- No altera `position` del layout base salvo override del usuario.

## `useNodeResize()` — `Hooks/useNodeResize.ts`

```ts
function useNodeResize(resetKey: string | null): {
  overrides: Record<string, TNodeSizeOverride>;
  onNodesChange: OnNodesChange<TGraphNode>;
};
```

- Mantiene los overrides en estado local; `onNodesChange` delega en `reduceNodeOverrides`.
- Limpia los overrides cuando cambia `resetKey` (id de sesión raíz): el tamaño no se filtra entre sesiones (FR-003, edge case).
- No persiste ni sincroniza al servidor.

## `useChainSelection()` — `Hooks/useChainSelection.ts`

```ts
function useChainSelection(rootId: string | null): {
  selectedNodeId: string | null;   // selección explícita
  inspectedNodeId: string | null;  // selectedNodeId ?? rootId (para el inspector)
  isChainMode: boolean;            // selectedNodeId !== null
  selectNode: (id: string) => void;
  clearSelection: () => void;
};
```

- `selectNode` entra en modo cadena; `clearSelection` vuelve al grafo completo (FR-007).
- Se resetea cuando cambia `rootId` (edge case "cambia de sesión").

## `AgentGraph` — props

```ts
interface AgentGraphProps {
  graph: TGraphModel;                 // ya preparado (completo o cadena)
  selectedNodeId: string | null;      // nodo a resaltar: selección explícita (null = ninguno resaltado)
  isChainMode: boolean;
  onSelectNode: (id: string) => void;
  onClearSelection: () => void;       // clic en el fondo
  followNodeId?: string | null;
  resetKey?: string | null;           // sesión raíz: limpia tamaños
  className?: string;
}
```

- `selectedNodeId` es la **selección explícita** (`useChainSelection.selectedNodeId`), no la inspección por defecto: al montar sin selección vale `null` y ningún nodo se resalta (FR-008 se evalúa sobre la selección explícita).
- La inspección por defecto (`inspectedNodeId = selectedNodeId ?? rootId`) alimenta solo al `InspectorPanel`, no al resaltado del grafo.
- Pasa `onNodesChange` de `useNodeResize(resetKey)` a `<ReactFlow>`.
- `onPaneClick` → `onClearSelection`.
- `FitViewController` interno hace `fitView` cuando cambia `topologySignature(graph)` (React Flow solo ajusta en el montaje).
- Conserva `colorMode="dark"`, `nodesDraggable={false}`, `nodesConnectable={false}` y `FollowController`.

## `AgentNode` — contrato de presentación

- Renderiza `<NodeResizer nodeId={id} isVisible minWidth={180} minHeight={72} />` con tiradores planos revelados en hover/focus/selected (FR-004).
- El contenedor usa `h-full w-full`; el layout interno evita superposición (`min-w-0`, filas `flex-wrap`) para que al agrandar se lea todo el contenido (FR-002).
- Muestra el rango horario del nodo (ver [time-range-contract.md](./time-range-contract.md)) junto a la duración existente (FR-015).
- Distingue el nodo seleccionado (`border-accent`) de los ancestros de la cadena (`border-border`) según la prop `selected` (FR-008).
- Mantiene `NodeStatusRail`, el nombre del agente, el modelo, las métricas y la herramienta actual.

## Estados y fallbacks

- Sin nodos → `EmptyState` (ya en `WorkspacePage`); error → `EmptyScreenError`; loading → `GraphSkeleton` (FR-017).
- Modo cadena con `nodeId` inexistente → se usa el grafo completo, sin grafo vacío inconsistente (edge case).
- El resize y el modo cadena **no** disparan relayout global (Principio VII).
