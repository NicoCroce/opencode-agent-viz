# Research — Refinamientos de experiencia del visor

**Feature**: `002-viz-ux-refinements`
**Date**: 2026-10-03
**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

Este documento resuelve los puntos técnicos abiertos por las cinco mejoras. La spec ya está cerrada con clarificaciones; no quedan `NEEDS CLARIFICATION`. Cada decisión se apoya en campos/APIs ya presentes en `@opencode/client` 2.0.22 y en `@xyflow/react` 12.

---

## R1. Redimensionar nodos de React Flow (US1, FR-001..FR-004)

**Decision**: Usar el componente `NodeResizer` de `@xyflow/react` (exportado directamente por el paquete; verificado en 12.12.0, sin `additional-components`) dentro de `AgentNode`, y convertir el grafo en controlado:

1. `AgentGraph` pasa `onNodesChange` a `<ReactFlow>`.
2. Un hook `useNodeResize(resetKey)` mantiene `overrides: Record<nodeId, { width; height; x?; y? }>`.
3. `onNodesChange` delega en la función pura `reduceNodeOverrides(overrides, changes)`: solo procesa `type === 'dimensions'` (guarda `width`/`height`) y `type === 'position'` emitidos durante el resize (ajustan `x`/`y` para resize desde arriba/izquierda). Los cambios de selección/posición por drag se ignoran porque `nodesDraggable=false`.
4. Los nodos renderizados combinan el modelo derivado (`graph.nodes`) con los overrides; el wrapper usa `width`/`height` y el contenido interno `h-full w-full`.
5. `resetKey` = id de la sesión raíz; al cambiar, `useEffect` limpia los overrides (FR-003, edge case "otra sesión").
6. `NodeResizer` se renderiza siempre (`isVisible`), con `minWidth={180}`/`minHeight={72}` y `handleClassName` que revela los tiradores en hover/focus/selected vía `group` (FR-004).

**Rationale**: `NodeResizer` es la solución oficial de React Flow v12; dispara `NodeDimensionChange` a través de `onNodesChange` (`triggerNodeChanges`), que es el punto de entrada controlado. Mantener los overrides **fuera** del modelo derivado evita que un evento en vivo (`buildGraph` re-render) revierta el tamaño (FR-003) y respeta el Principio VII (no relayout). La clave por sesión cumple el edge case de aislamiento entre sesiones.

**Alternatives considered**:
- Librería externa (`react-rnd`, `re-resizable`): añade dependencia y CSS propio; descartada.
- Redimensionar con CSS `resize: both`: no participa del layout de React Flow (los handles de conexión y el `fitView` quedarían desalineados); descartada.
- Guardar tamaño dentro de `TGraphNodeData`: se perdería en cada `buildGraph` por evento y podría revertirse; descartada.

---

## R2. Aislar la cadena raíz→nodo en una fila (US2, FR-005..FR-008)

**Decision**: Dos funciones puras nuevas en `Domains/Graph/lib/chainGraph.ts`:

```ts
function buildChain(model: TGraphModel, nodeId: string): TGraphModel | null;
function layoutChain(model: TGraphModel): TGraphModel; // una sola fila
```

- `buildChain` recorre los ancestros por las aristas (`target → source`) desde `nodeId` hasta la raíz, devuelve los nodos ordenados raíz→nodo y las aristas que los conectan. Devuelve `null` si `nodeId` no está en el modelo (fallback a grafo completo, edge case).
- `layoutChain` posiciona en una fila: `x = index * (NODE_WIDTH + CHAIN_GAP)`, `y = 0`, preservando el orden. Garantiza "una sola línea" incluso con muchos ancestros (FR-006) sin depender de dagre.
- `useChainSelection(rootId)` gestiona la selección **explícita**: `{ selectedNodeId, inspectedNodeId, isChainMode, selectNode, clearSelection }`, donde `inspectedNodeId = selectedNodeId ?? rootId` alimenta solo al inspector, y se resetea cuando cambia `rootId` (edge case "cambia de sesión").
- `WorkspacePage` deriva `displayGraph = isChainMode ? layoutChain(buildChain(...)) : graph.graph` y lo memoiza. Si `buildChain` devuelve `null`, usa el grafo completo.
- Salida del modo: `onPaneClick` de `<ReactFlow>` → `clearSelection`; `useEscapeKey(clearSelection, isChainMode)` en `WorkspacePage` (FR-007).
- Distinción visual (FR-008): el nodo seleccionado ya recibe `selected` (borde `--accent`); los ancestros conservan borde normal.
- `fitView` tras el cambio: un controlador interno `FitViewController` llama a `fitView` cuando cambia la firma de topología de la vista (`topologySignature(displayGraph)`), porque React Flow solo hace `fitView` en el montaje.

**Rationale**: La cadena es una propiedad del grafo (aristas padre→hijo) y encaja como función pura testeable (Principio V). Separar la **selección para inspección** (que hoy cae por defecto en la raíz) de la **selección explícita** evita que el modo cadena se active siempre: hoy `selectedNodeId` default es `rootId` para el inspector. La fila manual es determinista y más simple que un dagre `LR` para un caso lineal.

**Alternatives considered**:
- Filtrar con `filterSubtree` (descendientes) en vez de ancestros: invertiría la semántica pedida ("cómo se llegó hasta él"); descartado.
- Reusar `layoutGraph` con `rankdir: 'LR'`: añade ranks y márgenes innecesarios; la fila manual es exacta; descartado.
- Un `key` en `<ReactFlow>` para forzar remount y `fitView`: pierde el viewport y remonta todo; descartado.

---

## R3. Historial de herramientas truncable (US3, FR-009..FR-012)

**Decision**: Constante `TOOL_HISTORY_LIMIT = 10` y hook `useToolHistory(tools)` en `Domains/Inspector/Hooks`:

```ts
function useToolHistory(tools: TToolHistoryEntry[]): {
  visibleTools: TToolHistoryEntry[]; // 10 primeras o todas si expanded
  hiddenCount: number;               // tools.length - 10 (>= 0)
  canExpand: boolean;                // tools.length > 10
  isExpanded: boolean;
  toggle: () => void;
};
```

`ToolHistory` renderiza `visibleTools` en el orden actual (cronológico ascendente, sin invertir) y, si `canExpand`, un control plano con chevron: `"Ver N más"` cuando está colapsado y `"Ver menos"` cuando está expandido (FR-010, FR-012). Con ≤10 entradas no se muestra control (FR-011).

**Rationale**: El orden de `getSessionMessages` es `order: 'asc'`, así que `tools` ya viene cronológico; basta un `slice` para respetar FR-009 y las "10 más antiguas visibles". Extraer el cálculo a un hook mantiene el componente como presentación (AGENTS §4) y lo hace testeable.

**Alternatives considered**:
- Estado de expansión dentro de `ToolHistory`: funciona, pero incumple la convención "lógica en hooks"; descartado.
- `Accordion` de shadcn para el resto: cambia el patrón visual y añade animación; el control inline es más fiel a la referencia ("flecha hacia abajo"); descartado.
- Invertir la lista para mostrar las más recientes: contradice la clarificación Q4; descartado.

---

## R4. Tarjeta de sesión: título arriba, agente abajo (US4, FR-013)

**Decision**: Reordenar `SessionCard` a dos líneas: fila 1 = `StatusDot` + `session.title` (texto principal, `text-sm font-medium`) + rango horario a la derecha; fila 2 = agente (texto secundario, `text-xs text-muted-foreground`) o `"agente no disponible"` cuando `agentName` es `null` (FR-013, acceptance 2). El `onSelect`, el estado `selected` y el `StatusDot` no cambian.

**Rationale**: El título es el identificador humano natural; hoy el agente ocupa la línea principal (imagen 4). El fallback explícito evita una línea en blanco.

**Alternatives considered**:
- Mantener el agente arriba y solo mover el título: no cumple el pedido; descartado.
- Ocultar la línea de agente cuando falta: deja una tarjeta ambigua; descartado.

---

## R5. Origen y formato del rango horario (US5, FR-014..FR-016)

**Decision**: Helper puro `formatTimeRange` en `Application/Helpers/formatTimeRange.ts` (compartido por Graph y Sessions):

```ts
interface TTimeRangeInput {
  startedAt: number | null;
  endedAt: number | null;
  isRunning: boolean;
}
function formatTimeRange(input: TTimeRangeInput): string;
// `${inicio} – ${fin}` con formato HH:mm (locale del navegador)
// fin = 'en curso' si isRunning; 'no disponible' si falta; inicio = 'no disponible' si falta
```

- **Nodo** (`AgentNode`): `startedAt = metrics.startedAt`, `endedAt = metrics.endedAt`, `isRunning = status === 'running' || status === 'waiting'`. La hora de fin es la real (`endedAt`, derivada de `assistant.time.completed` en `deriveMetrics`); **no** se usa `now`. El rango convive con la duración existente (Assumption de la spec).
- **Tarjeta** (`SessionCard`): `startedAt = session.time.created`, `endedAt = session.time.updated`, `isRunning = status?.type === 'busy' || status?.type === 'retry'`.

**Rationale**: `metrics.endedAt` es la hora de fin real reportada por el servidor y ya está disponible en el nodo; usar `now` es exactamente "la hora que cambia sola" que la clarificación Q2 prohíbe. Para la tarjeta, `SessionInfo.time.updated` es la última actualización reportada por el servidor y, con la sesión ya no en curso, es estática y equivale al fin de la última ejecución; evita cargar mensajes de cada sesión raíz de todos los proyectos (coste N+1). `time.created`/`time.updated` son campos requeridos del SDK, por lo que la tarjeta siempre tiene ambos extremos; los nodos sí pueden tener `null` (FR-016). "En curso" cubre `busy`/`retry` (sesión) y `running`/`waiting` (nodo, porque un permiso pendiente no es un fin de ejecución).

**Alternatives considered**:
- Para la tarjeta, cargar el último mensaje assistant de cada sesión y usar su `time.completed`: fiel pero obliga a N consultas pesadas en el rail global; descartado.
- Reutilizar `formatDuration`/`formatTime` existentes: no expresan rango ni "en curso"; descartado.
- Mostrar `endedAt ?? now` para nodos en curso: viola Q2 ("hora que cambia sola"); descartado.

---

## R6. Estrategia de pruebas (Principio V y VIII)

**Decision**:
- **Puras** (`specs/` en `lib/`): `chainGraph.spec.ts` (orden de ancestros, raíz sola, nodo ausente → `null`, ignora hermanos/descendientes, fila con `y` constante y `x` creciente); `nodeResize.spec.ts` (dimensiones, posición de resize, ignora cambios no relevantes, reset); `formatTimeRange.spec.ts` (ambos extremos, en curso, faltantes, formato HH:mm); `useToolHistory.spec.tsx` (0/10/11 entradas, `hiddenCount`, toggle, orden).
- **Componentes** (Testing Library): `ToolHistory.spec.tsx` (10 visibles + control con 11, sin control con 10, expandir revela el resto), `AgentNode.spec.tsx` (rango horario y presencia del tirador), `SessionCard.spec.tsx` (título arriba / agente abajo / "agente no disponible" / rango).
- **Hooks**: `useNodeResize.spec.tsx` y `useChainSelection.spec.tsx` con `renderWithProviders`/`renderHook`.

**Rationale**: La constitución exige lógica pura testeada; los casos límite de la spec (10 exactas, nodo raíz, faltantes, en curso) se cubren en unit tests deterministas, sin depender de un servidor vivo.

**Alternatives considered**:
- Solo tests de componente end-to-end: más lentos y frágiles; se reservan para los flujos visibles; descartado como única estrategia.

---

## Open questions

Ninguna. Todos los puntos técnicos quedaron resueltos con APIs existentes del SDK y de React Flow; la spec no contiene `NEEDS CLARIFICATION`.
