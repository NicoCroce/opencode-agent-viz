# Contract: API interna de las piezas extraídas

**Feature**: `012-refactor-workspace-enrichment` | **Tipo**: contrato de módulos internos (no públicos)

Superficie que el hook/componente consumidor espera de cada pieza nueva. Es interna al repo, pero se
congela para que las tareas de implementación y los specs compartan la misma forma (FR-020/FR-023).
Todas las funciones de este documento son **puras** (sin React, sin `QueryClient`, sin I/O) salvo los hooks.

## 1. `src/Infrastructure/lib/` (puros, no exportados por ningún barrel de dominio)

```ts
// countAttentionByRoot.ts — movido tal cual desde WorkspacePage.tsx
export const countAttentionByRoot: (
  roots: string[],
  permissions: PermissionRequest[],
  openRootId: string | null,
  openSubtreeSessionIds: ReadonlySet<string>,
  openQuestionCount: number,
) => Record<string, number>;
// Post: counts[root] = nº de permisos de la raíz (árbol abierto si root === openRootId,
//       si no solo la propia sesión); + openQuestionCount en openRootId. No muta entradas.

// toPendingQuestionEntry.ts — extraído del useMemo chatPending
export const toPendingQuestionEntry: (form: FormInfo) => TQuestionEntry;
// Post: state: 'pending', answer: null; options solo en 'string' | 'multiselect'.

// isFocusWithinChat.ts — extraído del módulo de la página
export const CHAT_PANEL_SELECTOR: string;               // '[data-testid="chat-panel"]'
export const isFocusWithinChat: () => boolean;
// Post: true si document.activeElement?.closest(CHAT_PANEL_SELECTOR) != null.
```

## 2. `src/Infrastructure/Hooks/` (React; acceso a datos solo por caché/`useQuery`)

```ts
useChatPending(attention: TAttentionItem[], nodes: TGraphNode[],
  listedPermissions: PermissionRequest[]): TChatPendingItem[]
// Sin observadores propios: recibe `listedPermissions` del llamador (que es el
// único que abre `useQuery` sobre permissions.list()) y solo lee la caché
// permissions.for(sessionId) y sessions.forms(sessionId); dedupe por
// 'permission:<id>' / 'question:<formId>'; respeta FormDetail no-'pending' (una
// pregunta resuelta no vuelve a la bandeja). Reactivo **por props**: el llamador
// re-renderiza al cambiar la caché. Una sola suscripción por clave (abrir un
// segundo observador de permissions.list() con initialData de identidad nueva
// realimentaba el ciclo observerOptionsUpdated → read() → render al abrir el
// overlay del histórico). FR-006/FR-017.

useAttentionNodeIds(attention: TAttentionItem[]): ReadonlySet<string>          // FR-007

useAttentionByRoot(p: { rootIds: string[]; permissions: PermissionRequest[];
  openRootId: string | null; openSubtreeSessionIds: ReadonlySet<string>;
  openQuestionCount: number; }): Record<string, number>                        // FR-007

useChatSelectionSeed(p: { nodes: TGraphNode[]; sessionId: string | null }): TChatSelectionSeed  // FR-008

useWorkspaceEscape(p: { isFullscreen: boolean; closeFullscreen: () => void;
  clearSelection: () => void; selectedNodeId: string | null }): void
// Registra useEscapeKey(handler, isFullscreen || selectedNodeId !== null). FR-009/FR-023.

useHistoryData(p: useHistoryOverlay params & { sessionIdForForms?: string | null }):
  { node, lineage, missingId, clearMissing, questions, context }               // FR-010
```

## 3. `src/Domains/Graph/lib/` (puros)

```ts
// readyNodeIds.ts
export const collectReadyIds: (
  ids: string[],
  enriched: ReadonlySet<string>,
  hasMessages: (id: string) => boolean,
) => Set<string>;
// Post: { id ∈ ids : hasMessages(id) } ∪ enriched; no abre consultas; nuevo Set.

// agentLatencyMedians.ts
export const deriveAgentMedians: (
  entries: ReadonlyArray<{ agent: string; messages: TSessionMessage[] }>,
) => Record<string, number | null>;
// Post: median(deriveLatency(messages).samples[].totalMs ≠ null) por agente; null sin muestras.
// Reutiliza median() de lib/metrics/latency.ts (no reimplementa).

// mergeEnrichedNodes.ts
export const mergeEnrichedNodes: (
  structure: TGraphModel,
  readyIds: ReadonlySet<string>,
  buildNodeData: (node: TGraphNode) => TGraphNodeData,
) => TGraphModel;
// Post: nodes.map(n => readyIds.has(n.id) ? { ...n, data: buildNodeData(n) } : n);
// edges devueltas por referencia; no muta la entrada. La fusión interna del nodo sigue siendo
// enrichNodeData (datos) + mergeExecutionSignals (señal), ya existentes y probados.
```

## 4. Invariantes transversales

- **Sin consultas nuevas** en ninguna pieza pura (FR-011/FR-012/FR-019).
- **Sin mutación** de entradas en `countAttentionByRoot`, `toPendingQuestionEntry`, `collectReadyIds`,
  `deriveAgentMedians`, `mergeEnrichedNodes` (FR-013).
- **Memoización**: los hooks preservan las claves de dependencia actuales de los `useMemo` que reemplazan
  (identidad de `graph.nodes`, `attention`, `items`, `listedPermissions`, `id`) (FR-019).
- **Imports por barrel**: los módulos nuevos importan dominios por su barrel (`@app/Domains/Graph`,
  `@app/Domains/Chat`, `@app/Domains/Sessions`) para no romper los `vi.mock` de los specs (D7).
