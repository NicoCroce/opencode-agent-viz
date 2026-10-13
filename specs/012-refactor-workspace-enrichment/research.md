# Phase 0 — Research: refactor WorkspacePage + useGraphEnrichment

**Feature**: `012-refactor-workspace-enrichment` | **Date**: 2026-10-13
**Input**: [spec.md](./spec.md) · **Output**: decisiones que cierran el Technical Context

No quedan `NEEDS CLARIFICATION`: el alcance es interno y las cuatro suites de regresión fijan el
comportamiento esperado. Cada decisión se tomó leyendo el código real en `HEAD` (`c629e17`).

---

## Estado real del código (verificado)

`src/Infrastructure/WorkspacePage.tsx` (**500** líneas) contiene hoy:

1. `countAttentionByRoot` (pura, exportada) y `toPendingQuestionEntry` (pura, privada).
2. `isFocusWithinChat` (pura, privada) + `CHAT_PANEL_SELECTOR`.
3. `chatPending` (`useMemo` con `queryClient.getQueryData` en dos claves → cross-domain + preguntas).
4. `attentionNodeIds`, `attentionByRoot`, `chatSelectionSeed` (`useMemo` de derivación).
5. `handleEscape` + `useEscapeKey`.
6. Cableado de `useSessionOpenPerf`, `useWorkspaceSummary`, `useHistoryOverlay`, `useSessionForms`,
   `useSessionContext`.
7. Cinco bloques JSX de vista (`rail`, `graphPane`, `inspectorPane`, `chatPane`, `historyOverlay`)
   que **componen** componentes que ya existen: `SessionsRail`, `GraphPane`, `InspectorPane`,
   `ChatPanel` (dominio Chat) y `HistoryOverlay`.

`src/Domains/Graph/Hooks/useGraphEnrichment.ts` (**255** líneas) contiene: estado `progress`/`signature`,
`readyIds` (lee `sessions.messages`), `agentMedianByAgent`, el `useEffect` de idle (lotes + cancelación),
el `useMemo` de salida (fusión por nodo) y `useInvocationBatches` (export separado, ya usa `lib/`).

---

## D1 — Extracción de los cinco bloques de vista (FR-005)

- **Decisión**: los cinco bloques **ya son componentes propios** (`Infrastructure/Components/SessionsRail.tsx`,
  `GraphPane.tsx`, `InspectorPane.tsx`, `HistoryOverlay.tsx` y `Domains/Chat/Components/ChatPanel.tsx`).
  Lo que queda "inline" en la página son cinco **variables de composición** (`const rail = (<SessionsRail …/>)`,
  etc.). Se introduce **un** componente presentacional `Infrastructure/Components/WorkspaceView.tsx` que
  posee los cinco slots, el `WorkspaceChatAttentionContext.Provider` y el `WorkspaceLayout`; la página
  desaparece de toda composición de vista.
- **Rationale**: satisface la intención de FR-005 (la página deja de construir JSX) sin duplicar cinco
  componentes que ya existen ni crear wrappers vacíos; mantiene `data-testid` y props idénticos (FR-001/SC-002).
- **Resolución (decisión del usuario, 2026-10-13)**: **opción A confirmada** — un único
  `WorkspaceView.tsx` compone los cinco slots; los cinco componentes de dominio ya existentes **no se
  envuelven** con wrappers, y los bloques JSX inline que quedaban en `WorkspacePage.tsx` se trasladan a
  la composición de `WorkspaceView`. Decisión cerrada: no queda pregunta abierta.
- **Alternativas consideradas (rechazadas)**:
  (a) crear cinco wrappers nuevos (`WorkspaceRail`, `WorkspaceGraphPane`, …) → los cinco componentes ya
  existen; wrappers sin lógica son ruido y violan FR-023 (no duplicar).
  (b) reubicar/renombrar los componentes existentes a Infrastructure → churn de imports y riesgo de romper
  los `vi.mock` de dominio (D7) sin beneficio.

## D2 — `readyIds` puro y sin consultas (FR-011)

- **Decisión**: `lib/readyNodeIds.ts` → `collectReadyIds(ids, enriched, hasMessages)` donde `hasMessages`
  es `(id: string) => boolean` (predicado inyectado); devuelve un `Set` nuevo. El hook pasa
  `(id) => queryClient.getQueryData(queryKeys.sessions.messages(id)) !== undefined`.
- **Rationale**: un módulo `lib/` no puede recibir `QueryClient` sin acoplarse a TanStack (y sin abrir
  consultas); inyectar el predicado deja la función pura y testeable con un `Set` explícito (SC-003).
- **Alternativas consideradas**: pasar un `Map<id, messages>` snapshot (obliga a materializar toda la
  caché del subárbol → coste O(n) innecesario; el predicado corto-circuita igual); dejar la función en el
  hook (no cumple FR-011/FR-020).

## D3 — Medianas de latencia por agente puras (FR-012)

- **Decisión**: `lib/agentLatencyMedians.ts` → `deriveAgentMedians(entries: ReadonlyArray<{ agent: string; messages: TSessionMessage[] }>)`
  → `Record<string, number | null>`; reutiliza `deriveLatency` + `median` de `lib/metrics/latency.ts`,
  respaldo `null` para agentes sin muestras.
- **Rationale**: entradas explícitas (agente + mensajes) en lugar de `QueryClient`; el filtrado por
  `readyIds` y la lectura de caché se quedan en el hook, que es quien conoce la identidad de las entradas
  (FR-019).
- **Alternativas consideradas**: `(nodes, readyIds, getMessages)` como tripleta (mezcla selección con
  cálculo); recalcular por tick (prohibido por FR-019).

## D4 — Fusión de nodos pura y no mutante (FR-013/FR-014)

- **Decisión**: `lib/mergeEnrichedNodes.ts` → `mergeEnrichedNodes(structure, readyIds, buildNodeData)`
  → `TGraphModel` con `nodes.map(node => readyIds.has(node.id) ? { …node, data: buildNodeData(node) } : node)`
  y `edges` reutilizadas por referencia. La **fusión de señal** ya es `mergeExecutionSignals` en
  `lib/executionSignal.ts` y la **fusión de datos de un nodo** ya es `enrichNodeData` en `lib/enrichNodeData.ts`
  (ambas puras, con spec): no se reimplementan (FR-014/FR-023).
- **Rationale**: saca el último mapa de fusión del hook, conserva identidad de nodos no afectados
  (SC-006/VII) y mantiene `readNodeEnrichmentInput` como único lector de caché.
- **Alternativas consideradas**: fusionar señal y datos en una sola función (rechazado: FR-014 exige
  separarlas y las dos piezas ya existen y están probadas).

## D5 — Hooks de la página: dónde vive cada responsabilidad

- **Decisión**:
  `Hooks/useChatPending.ts` (bandeja: `permissions.list()` vía `useQuery`, semillas `permissions.for(id)`,
  preguntas accionables del subárbol, lectura reactiva opcional de `FormDetail`), `Hooks/useAttentionNodeIds.ts`,
  `Hooks/useAttentionByRoot.ts`, `Hooks/useChatSelectionSeed.ts`, `Hooks/useWorkspaceEscape.ts`,
  `Hooks/useHistoryData.ts` (compone `useHistoryOverlay` + `useSessionForms` + `useSessionContext`).
  Puros a `Infrastructure/lib/`: `countAttentionByRoot`, `toPendingQuestionEntry`, `isFocusWithinChat`.
- **Rationale**: el data-fetching cross-domain ya residía en Infrastructure (Principio II) y permanece ahí,
  ahora en hooks; los `useMemo` conservan **sus mismas claves de dependencia** para no alterar FR-019
  (identidad de entradas) ni adelgazar la memoización.
- **Alternativas consideradas**: mover la bandeja a `Domains/Chat` (rompería el encapsulamiento y el
  `vi.mock('@app/Domains/Chat')`), o dejarla en el componente `WorkspaceView` (lógica en presentación: prohibido).

## D6 — `Escape` con la misma precedencia (FR-009)

- **Decisión**: `lib/isFocusWithinChat.ts` exporta el selector (`[data-testid="chat-panel"]`) y el predicado;
  `Hooks/useWorkspaceEscape.ts` recibe `{ isFullscreen, closeFullscreen, clearSelection, selectedNodeId }`
  y devuelve/hace `useEscapeKey(handler, isFullscreen || selectedNodeId !== null)` con el orden
  foco-chat → fullscreen → selección.
- **Rationale**: la precedencia es una regla con 3 escenarios en `WorkspacePage.spec.tsx`; aislarla no cambia
  el listener global (`window`) ni el `activeElement` del momento del `keydown`.
- **Alternativas consideradas**: hook que devuelva el handler y dejar `useEscapeKey` en la página (dos
  fuentes para una regla, FR-023).

## D7 — Restricciones de los mocks y de las suites protegidas (crítico)

- **Decisión**: ningún archivo nuevo puede cambiar el **camino de import** que las suites espián:
  - `WorkspacePage.spec.tsx` / `.perf.spec.tsx` mockean `@app/Domains/Sessions`, `@app/Domains/Chat`,
    `@app/Domains/Inspector`, `@app/Domains/History`, y espían `useNow`/`summarizeSession`/`isActiveStatus`
    importados **por el barrel** `@app/Domains/Graph`. Por eso `useWorkspaceSummary` y los componentes deben
    seguir importando por barrel (no deep-import).
  - `useGraphEnrichment.spec.tsx` / `.freshness.spec.tsx` importan `../useGraphEnrichment`, por lo que el
    archivo `Hooks/useGraphEnrichment.ts` **se conserva con ese path y firma exportada** (`useInvocationBatches`
    incluido, consumido por `useGraphModel` desde `./useGraphEnrichment`).
- **Rationale**: FR-021/SC-001 exigen que estas suites pasen **sin editarse**; su verde es la prueba de no-regresión.
- **Alternativas consideradas**: renombrar o mover el hook a `lib/` (rompería el import de los specs).

## D8 — Ubicación de los specs nuevos

- **Decisión**: puros de Infrastructure → `src/Infrastructure/lib/specs/*.spec.ts` (patrón vigente de
  `Services/lib/specs/`); hooks → `src/Infrastructure/Hooks/specs/`; componente → `Components/specs/`;
  puros de Graph → `src/Domains/Graph/lib/specs/`.
- **Rationale**: Principio VIII ("specs junto al código"); `src/Infrastructure/specs/` ya se usa para los
  specs de página/proveedor, así que los `lib/` van con su propio subdirectorio como en `Services/lib/specs/`.
- **Alternativas consideradas**: usar solo `src/Infrastructure/specs/` (mezclaría specs de página con puros).

---

## Re-evaluación post-diseño (Gate Phase 1)

Tras generar `data-model.md`, `contracts/` y `quickstart.md`: **PASS**. Los artefactos de diseño no añaden
estado, consultas ni claves nuevas; las únicas superficies nuevas son funciones puras y hooks privados de
Infrastructure/Graph no exportados por los barrels de dominio. No hay violaciones que justificar, por lo que
`Complexity Tracking` en [plan.md](./plan.md) queda vacío.

## Open Questions

Ninguna. OQ-1 (los cinco bloques "inline" ya extraídos en `HEAD`) quedó **cerrada** con la decisión del
usuario: opción **A** — un único `WorkspaceView.tsx`, sin wrappers por slot (ver D1). Al generar `tasks.md`
basta registrar que la composición de los cinco slots vive en `WorkspaceView`, sin desviación pendiente.
