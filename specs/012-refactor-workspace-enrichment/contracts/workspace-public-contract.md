# Contract: superficie pública congelada (regresión)

**Feature**: `012-refactor-workspace-enrichment` | **Tipo**: contrato de no-regresión (UI interna del visor)

Este refactor es **interno**: no expone endpoints, CLIs ni librerías. El "contrato" verificable es la
superficie que consumen las cuatro suites protegidas y el resto de la app. Ningún elemento de esta lista
puede cambiar (FR-001/FR-002, SC-002/SC-005).

## 1. Exports que no cambian de ruta ni de firma

| Export | Ruta | Firma |
|---|---|---|
| `WorkspacePage` | `src/Infrastructure/WorkspacePage.tsx` | `() => JSX.Element` (sin props) |
| `useGraphEnrichment` | `src/Domains/Graph/Hooks/useGraphEnrichment.ts` | `(ids: string[], structure: TGraphModel, threshold?: number) => TGraphModel` |
| `useInvocationBatches` | `src/Domains/Graph/Hooks/useGraphEnrichment.ts` | `(structure: TGraphModel) => TInvocationBatch[]` |

> El **path** de `Hooks/useGraphEnrichment.ts` es parte del contrato: los specs importan `'../useGraphEnrichment'`.
> `countAttentionByRoot` deja de exportarse desde `WorkspacePage.tsx` (0 consumidores) y pasa a
> `src/Infrastructure/lib/countAttentionByRoot.ts`; su firma y su valor se conservan.

## 2. Props de los componentes de la vista (mismas formas)

| Componente | Props (forma) |
|---|---|
| `SessionsRail` | `{ groups, statuses, selectedId, isLoading, onSelect, truncated?, attentionByRoot? }` |
| `GraphPane` | `{ graph, summary, follow, selectedNodeId, onSelectNode, onClearSelection, onOpenHistory, rootId, attentionNodeIds? }` |
| `InspectorPane` | `{ graph, parallelGroups, inspectedNodeId, showReasoning, onToggleReasoning, onOpenHistory, onSelectNode, isResizing, isFullscreen, onToggleFullscreen, chat, showDetailTabs, attentionCount, activeTab, onTabChange }` |
| `HistoryOverlay` | `{ node, lineage, missingId, onClearMissing, showReasoning, onToggleReasoning, onNavigate, onClose, questions, context }` |
| `ChatPanel` | `{ sessionId, directory, selectionSeed, showReasoning, pending, attention, onGoToRequest }` |
| `WorkspaceLayout` | `{ isMobile, tab, onChangeTab, sessions, graph, inspector, chat, history, inspectorWidth, isResizing, onResizeStart, onResizeKey, isFullscreen }` |
| `WorkspaceView` (**nuevo**) | agrupa esos cinco slots + `panel` + `attentionCount`; presentacional, sin lógica de datos |

Tipos con prefijo `T` derivados del SDK (`PermissionRequest`, `FormInfo`, `FormDetail`, `ModelRef`).

## 3. `data-testid` congelados

`chat-panel`, `chat-pending-tray`, `chat-attention-badge`, `chat-timeline-scroll`, `chat-loading`,
`chat-disconnected-notice`, `inspector-pane`, `detail-chat-slot`, `inspector-resize-handle`,
`inspector-column`, más los definidos por los componentes de dominio mockeados en los specs
(`agent-graph`, `graph-skeleton`, `session-list`, `inspector-panel`).

## 4. Rutas y claves de caché congeladas

- Rutas: `/sessions`, `/sessions/:id` (`SESSIONS_LIST_ROUTE`, `SESSION_DETAIL_ROUTE`, `GRAPH_VIEW_ROUTE`),
  helper `sessionDetailPath(id)`.
- `queryKeys` usadas: `sessions.messages(id)`, `sessions.forms(id)` (+ `[..., formId]`),
  `sessions.execution(id)`, `sessions.roots`, `permissions.list()`, `permissions.for(id)`.
- **Cero claves nuevas, cero claves renombradas.**

## 5. Comportamiento congelado (escenarios que las suites ya fijan)

1. Precedencia de `Escape`: foco en chat ⇒ no propaga; luego fullscreen; luego limpiar selección.
2. Modo "seguir" anclado a `latestActiveNodeId`; badge de atención por raíz con el mismo conteo.
3. Sin sesión no hay chat; semilla de selección derivada del nodo abierto.
4. `enrichment`: `pending → ready`, sin degradación; lotes por idle; cancelación por cambio de plan;
   "lo vivo gana sobre la siembra".
5. Estados de pantalla error → carga → vacío → datos (Principio VI).

## 6. Criterio de verificación

`pnpm tsc && pnpm tsc:node && pnpm lint && pnpm test` en verde **sin editar** ningún spec existente de
`src/Infrastructure/specs/` ni de `src/Domains/Graph/Hooks/specs/` (FR-021/FR-022).
