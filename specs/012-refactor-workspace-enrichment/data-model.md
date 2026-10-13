# Phase 1 — Data Model: refactor WorkspacePage + useGraphEnrichment

**Feature**: `012-refactor-workspace-enrichment` | **Date**: 2026-10-13

Este refactor **no introduce entidades de dominio nuevas**. El modelo son las formas que ya circulan entre
la vista y el enriquecimiento; se documentan porque las piezas extraídas deben conservar exactamente sus
campos, relaciones y transiciones (FR-001/FR-023). Tipos del SDK con prefijo `T` (Principio IV).

## 1. Entidades existentes (congeladas)

### 1.1 `TGraphModel` — `src/Domains/Graph/Graph.entity.ts`

| Campo | Tipo | Notas |
|---|---|---|
| `nodes` | `TGraphNode[]` | Identidad por nodo; los no afectados conservan referencia |
| `edges` | `TGraphModelEdge[]` | Reutilizadas por referencia en la fusión |

### 1.2 `TGraphNode` / `TGraphNodeData`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `string` | Id de sesión; clave de `readyIds` y de las claves de caché |
| `data.sessionId` | `string` | Igual a `id` en la práctica; base de `subtreeIds` |
| `data.agentName` | `string` | Clave de `agentMedianByAgent` (FR-012) |
| `data.model` | `ModelRef \| null` | Semilla de selección del chat (FR-008) |
| `data.enrichment` | `'pending' \| 'ready'` (opcional) | Transición gobernada por `readyIds` (FR-013) |
| `data.latency`, `context`, `effort`, `speedup` | opcionales | Campos derivados; cubiertos por comparadores (FR-015) |
| `data.status`, `metrics`, `retry`, `interruptReason` | — | Sin cambios |

### 1.3 `TChatPendingItem` — `src/Domains/Chat/Components/ChatPanel.tsx`

Unión discriminada: `permission` (`{ originSessionId, originLabel, permission: { id, action, resources, message } }`)
y `question` (`{ originSessionId, originLabel, question: TQuestionEntry }`). Dedupe por
`permission:<id>` / `question:<formId>` (FR-006).

### 1.4 `TAttentionItem` — `src/Domains/Chat/Chat.entity.ts`

`{ id, kind: 'permission' | 'question', sessionId, nodeId: string | null, title, at }`.
**Fuente única** de badge/banner/toast/realce y de las preguntas accionables (FR-007/FR-023).

### 1.5 `TChatSelectionSeed` — `src/Domains/Chat/Hooks/useChatController.ts`

`{ agent?: string | null, model?: ModelRef | null }`; ambos `null`/ausentes ⇒ **"no cambiar"** (FR-008).

### 1.6 `TNodeEnrichmentInput` — `src/Domains/Graph/lib/enrichNodeData.ts`

`{ messages, permissions, formDetails, signal }`, resuelto desde caché por `readNodeEnrichmentInput`;
entrada de la fusión pura `enrichNodeData` (FR-013).

## 2. Estado interno que se conserva (no exportado)

### 2.1 `TEnrichmentProgress` — hoy en `useGraphEnrichment.ts`

| Campo | Tipo | Semántica |
|---|---|---|
| `signature` | `string` | `ids.join('\u0000')`; identifica el plan vigente (FR-018) |
| `ids` | `ReadonlySet<string>` | Ids procesados **en esta visita** |

Reglas: `enriched = progress.signature === signature ? progress.ids : EMPTY_IDS` (`EMPTY_IDS` con
identidad estable); un cambio de firma **cancela** el turno en vuelo y reinicia el progreso, sin bloquear
el plan nuevo (FR-018/Edge Case "cambio de subárbol con lote en vuelo").

### 2.2 Derivaciones de la página (se trasladan, mismo valor)

| Derivación | Hoy | Destino | Invariante |
|---|---|---|---|
| `readyIds` | `useMemo` en el hook | `lib/readyNodeIds.ts` | `enriched ∪ { id ∈ ids : messages(id) cacheado }`, sin consultas (FR-011) |
| `agentMedianByAgent` | `useMemo` en el hook | `lib/agentLatencyMedians.ts` | mediana de `totalMs` de los nodos **ready**; `null` sin muestras (FR-012) |
| Fusión de nodos | `useMemo` de salida | `lib/mergeEnrichedNodes.ts` | solo `readyIds.has(id)`; no muta; `edges` idénticas (FR-013) |
| `attentionNodeIds` | `useMemo` | `Hooks/useAttentionNodeIds.ts` | `nodeId !== null` (FR-007) |
| `attentionByRoot` | `useMemo` + pura | `lib/countAttentionByRoot.ts` + `Hooks/useAttentionByRoot.ts` | permisos del árbol abierto + preguntas del subárbol (FR-007) |
| `chatSelectionSeed` | `useMemo` | `Hooks/useChatSelectionSeed.ts` | nodo con `data.sessionId === id`; sin nodo ⇒ `null/null` (FR-008) |
| `chatPending` | `useMemo` + `useQueryClient` | `Hooks/useChatPending.ts` | permisos listados + sembrados por sesión + preguntas accionables, dedupe (FR-006) |
| `Escape` | `useCallback` + `useEscapeKey` | `Hooks/useWorkspaceEscape.ts` + `lib/isFocusWithinChat.ts` | foco chat → fullscreen → selección; activo solo con fullscreen o selección (FR-009) |
| Histórico (`node`, `lineage`, `missingId`, `questions`, `context`) | `useHistoryOverlay` + 2 llamadas | `Hooks/useHistoryData.ts` | misma composición (FR-010) |

## 3. Firmas de las piezas puras nuevas

```ts
// src/Infrastructure/lib/countAttentionByRoot.ts
countAttentionByRoot(
  roots: string[], permissions: PermissionRequest[], openRootId: string | null,
  openSubtreeSessionIds: ReadonlySet<string>, openQuestionCount: number,
): Record<string, number>

// src/Infrastructure/lib/toPendingQuestionEntry.ts
toPendingQuestionEntry(form: FormInfo): TQuestionEntry   // state: 'pending', answer: null

// src/Infrastructure/lib/isFocusWithinChat.ts
CHAT_PANEL_SELECTOR: string
isFocusWithinChat(): boolean   // document.activeElement.closest(CHAT_PANEL_SELECTOR) !== null

// src/Domains/Graph/lib/readyNodeIds.ts
collectReadyIds(
  ids: string[], enriched: ReadonlySet<string>, hasMessages: (id: string) => boolean,
): Set<string>

// src/Domains/Graph/lib/agentLatencyMedians.ts
deriveAgentMedians(
  entries: ReadonlyArray<{ agent: string; messages: TSessionMessage[] }>,
): Record<string, number | null>

// src/Domains/Graph/lib/mergeEnrichedNodes.ts
mergeEnrichedNodes(
  structure: TGraphModel, readyIds: ReadonlySet<string>,
  buildNodeData: (node: TGraphNode) => TGraphNodeData,
): TGraphModel
```

## 4. Validación y reglas de negocio

| Regla | Origen | Comprobación |
|---|---|---|
| Un nodo `pending` solo pasa a `ready` si está en `readyIds` | FR-013 | spec de `mergeEnrichedNodes` |
| Un agente sin muestras propias cae en la mediana de su agente; sin referencia ⇒ `null` | FR-012 | spec de `deriveAgentMedians` |
| Un nodo ya cacheado no se vuelve a pedir | FR-011 | spec de `collectReadyIds` |
| Cambio de campo derivado ⇒ cambio detectado por el comparador | FR-015 | specs de `reconcile/comparators` + `sameNodeData` |
| "Lo vivo gana sobre la siembra": la señal/permiso en vivo prevalece | FR-017 | `mergeExecutionSignals` (existente) + `useGraphEnrichment.freshness.spec` (protegido) |
| Un lote por turno de idle; cancelación por cambio de plan | FR-016/FR-018 | `useGraphEnrichment.spec` (protegido) |
| El foco dentro del chat no propaga `Escape` | FR-009 | spec de `isFocusWithinChat` + `WorkspacePage.spec` (protegido) |

## 5. Transiciones de estado

```text
enriquecimiento de un nodo:  pending ──(lote de idle escribe caché + id ∈ progress)──▶ ready
                                            ▲ no se degrada (enrichment no vuelve a pending)
plan de carga:               firma S₁ ──(cambia ids/sesión)──▶ firma S₂
                             · turno en vuelo de S₁: cancelled=true, idle.cancel()
                             · resultados de S₁ ya escritos en caché: válidos y reutilizables
                             · progress de S₁ descartado; S₂ arranca de EMPTY_IDS
selección de chat:           sin nodo abierto ──▶ { agent: null, model: null } = "no cambiar"
```
