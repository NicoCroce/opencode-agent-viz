---
description: "Task list for feature 010-context-metrics-insights"
---

# Tasks: Context Composition, Parallel Speedup & Latency Insights

**Input**: Design documents from `/specs/010-context-metrics-insights/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluidos. La constitución (Principio V) y `quickstart.md` §1 exigen specs para las derivaciones puras nuevas (`contextBreakdown`, `windowStats`, `parentImpact`, `speedup`, `latency`, `anomalyThreshold`) y extensiones de los specs existentes (`reconcileGraph`, `summarizeSession`, `useGraphModel`, `AgentNodeFooter`, `SessionSummaryBar`) y specs nuevos de las secciones del panel. Los specs se escriben **antes** de su implementación (TDD) y deben fallar primero.

**Organization**: Tareas agrupadas por user story (US1..US5) en orden de prioridad. La Fase 2 (**Fundacional**) reúne el núcleo compartido: los tipos de vista nuevos y los comparadores de reconciliación, de los que dependen todas las historias.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: User story (US1..US5). Setup/Foundational/Polish no llevan story label.
- Rutas de archivo exactas en cada descripción.

## Path Conventions

Proyecto único frontend (SPA). Rutas relativas a la raíz del repo:
`src/Domains/Graph/`, `src/Domains/Inspector/`, `src/Application/`. Specs junto al código en carpetas `specs/` (Principio VIII).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar el punto de partida sin introducir dependencias.

- [X] T001 [P] Registrar la línea base de calidad en verde (`npm test`, `npm run tsc`, `npm run lint`) y verificar que **no** se agregan dependencias en `package.json` (plan.md Technical Context / Constraints).
- [X] T002 [P] Auditar los helpers y tokens existentes que reutiliza la feature: `formatTokens`, `formatDuration`, `formatCost`, `totalTokens` (`Application/Helpers`), el hook `useDevice` (doble presentación), `<Container>`/`<Metric>` (`Application/Components`) y los tokens CSS (`--primary`, `--status-error`, `--status-waiting`, `--status-running`, `--muted-foreground`). Sin editar todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de vista nuevos y su integración en la reconciliación. Invisible si no entra en `sameNodeData`.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [X] T003 [P] Añadir los tipos de vista a `src/Domains/Graph/Graph.entity.ts`: `TContextCategory`, `TContextBucket`, `TContextBreakdown`, `TContextWindow`, `TNodeContextMetrics` (con `latency?` opcional), `TGroupSpeedup`, `TNodeSpeedup`, `TLatencySample`, `TLatencyAnomaly`, `TLatencyReport`, y los campos **opcionales** `context?: TNodeContextMetrics | null` y `speedup?: TNodeSpeedup | null` en `TGraphNodeData` (data-model §1..§5; Principio IV; opcional por consistencia con `effort?`).
- [X] T004 [P] Añadir `TSessionSpeedup` y el campo `sessionSpeedup` a `TSessionSummary` en `src/Domains/Inspector/InspectorSession.entity.ts` (data-model §4.3).
- [X] T005 [P] Extender `src/Domains/Graph/lib/specs/reconcileGraph.spec.ts`: `sameContext` detecta cambios de `breakdown`/`window`/`provisional` y `sameSpeedup` de `groupId`/`size`/`speedup`/`efficiency`/`provisional`; un nodo con el mismo `context`/`speedup` no se reemplaza (data-model §7; quickstart §3).
- [X] T006 Añadir `sameContext(a, b)` y `sameSpeedup(a, b)` a `src/Domains/Graph/lib/reconcile/comparators.ts` y engancharlos en `sameNodeData` (depende de T003, T005) (data-model §7; recon: sin esto el nodo queda congelado).

**Checkpoint**: Tipos y comparadores listos — las user stories pueden comenzar.

---

## Phase 3: User Story 1 - Composición del contexto del agente (Priority: P1) 🎯 MVP

**Goal**: Desglose del contexto del agente en `toolResult`/`toolInput`/`reasoning`/`assistantText`/`userText`, con tokens reales repartidos por peso de caracteres y porcentajes que suman 100%.

**Independent Test**: Con un agente de contexto conocido, la composición muestra la categoría dominante primero, los `%` suman 100% y los valores coinciden con el reparto esperado (quickstart §2 US1; C1..C4).

- [X] T007 [P] [US1] Crear `src/Domains/Graph/lib/specs/contextBreakdown.spec.ts` (C1..C4): categorización de cada parte; `%` por peso de caracteres que suman 100 (±1); `tokens_bucket = round(windowTokens × chars/chars)`; sin ventana → `hasTokens = false` y `tokens = null`; sin mensajes → `chars = 0`, `buckets = []`; orden por `chars` descendente (context-metrics-contract §1; FR-001..FR-005).
- [X] T008 [US1] Implementar `deriveContextBreakdown(messages)` en `src/Domains/Graph/lib/metrics/contextBreakdown.ts` (puro, depende de T007, T003) (context-metrics-contract §1; research R1/R2).
- [X] T009 [P] [US1] Crear `src/Domains/Graph/lib/specs/windowStats.spec.ts` (C5): `hitRate = cacheRead/(cacheRead+input)` con y sin caché; `costPerKToken` con y sin ventana/costo; `null` cuando el denominador es 0 (context-metrics-contract §2).
- [X] T010 [US1] Implementar `deriveContextWindow(metrics, windowTokens)` en `src/Domains/Graph/lib/metrics/windowStats.ts` (puro, depende de T009, T003) (context-metrics-contract §2).
- [X] T011 [P] [US1] Crear `src/Application/Helpers/format/specs/formatPercent.spec.ts` y `formatPercent(value)` (puro) para mostrar porcentajes con redondeo consistente (sin magic strings, AGENTS §8.5).
- [X] T012 [P] [US1] Crear `src/Domains/Inspector/Components/specs/ContextCompositionBar.spec.tsx` (S2): barra apilada con leyenda (categoría, `%`, valor absoluto), orden por peso, y **texto además de color** (a11y).
- [X] T013 [US1] Implementar `src/Domains/Inspector/Components/ContextCompositionBar.tsx` (depende de T012, T011) (context-panel-contract §2/§7).
- [X] T014 [P] [US1] Crear `src/Domains/Inspector/Components/specs/ContextSection.spec.tsx` (S1, S3): la sección lista composición y ventana; representa los 4 estados (error/cargando/vacío/datos) (context-panel-contract §6; FR-017).
- [X] T015 [US1] Implementar `src/Domains/Inspector/Components/ContextSection.tsx` (composición + ventana) y `src/Domains/Inspector/Components/ContextSectionSkeleton.tsx` (depende de T014, T013) (context-panel-contract §2/§6).
- [X] T016 [US1] Extender `src/Domains/Graph/lib/enrichNodeData.ts` para poblar `context` (breakdown + window; `latency: null`) desde `messages`, y crear el hook derivador `src/Domains/Inspector/Hooks/useContextMetrics.ts` que expone `context` del nodo (depends T008, T010) (context-metrics-contract §4; research R3).
- [X] T017 [US1] Insertar `ContextSection` en `src/Domains/Inspector/Components/InspectorPanel.tsx` entre Métricas y Recursos, y exportar en `src/Domains/Inspector/Components/index.ts` (depende de T015) (context-panel-contract §2).

**Checkpoint**: Composición del contexto visible en el detalle con sus 4 estados — MVP.

---

## Phase 4: User Story 2 - Aceleración real por paralelismo (Priority: P2)

**Goal**: `speedup = serialMs/wallMs` por grupo y global de sesión, con eficiencia y provisionalidad; visible en nodo, detalle y resumen.

**Independent Test**: Con un grupo de duraciones conocidas, `speedup` y `efficiency` coinciden con el cálculo serie/real; la global usa la unión de intervalos (quickstart §2 US2; P1..P6).

- [X] T018 [P] [US2] Crear `src/Domains/Graph/lib/specs/speedup.spec.ts` (P1..P6): `deriveGroupSpeedup` (serial/wall/speedup/efficiency), solape perfecto → `efficiency = 1`, solape parcial → menor que `size`, miembro activo → `provisional`, `wallMs = 0`/duración ausente → `null`; `deriveSessionSpeedup` con **unión** de intervalos (parallel-speedup-contract §2/§3; FR-006..FR-010).
- [X] T019 [US2] Implementar `src/Domains/Graph/lib/metrics/speedup.ts` (`deriveGroupSpeedup`, `deriveSpeedupByNode`, `deriveSessionSpeedup`; puro, depende de T018, T003) (parallel-speedup-contract §1..§3; research R4).
- [X] T020 [P] [US2] Extender `src/Domains/Graph/lib/specs/deriveMetrics.spec.ts` (o nuevo `summarizeSession.spec.ts`) para `sessionSpeedup`, e implementarlo en `src/Domains/Graph/lib/metrics/summarizeSession.ts` (depende de T019) (data-model §4.3; FR-008).
- [X] T021 [US2] Extender `src/Domains/Graph/Hooks/useGraphModel.ts` para adjuntar `speedup` por nodo en el memo final (identidad estable) y extender `src/Domains/Graph/Hooks/specs/useGraphModel.spec.tsx` (P7; quickstart §3).
- [X] T022 [P] [US2] Crear `src/Domains/Graph/Components/specs/AgentNodeSpeedupBadge.spec.tsx`: muestra `×N`, etiqueta `provisional`, no depende solo del color.
- [X] T023 [US2] Implementar `src/Domains/Graph/Components/AgentNodeSpeedupBadge.tsx` (depende de T022) (parallel-speedup-contract §4).
- [X] T024 [US2] Cablear `data.speedup` en `src/Domains/Graph/Components/AgentNode.tsx` (badge en la fila del indicador de paralelos) y extender `src/Domains/Graph/Components/specs/AgentNode.spec.tsx` (depende de T023, T021) (FR-009; sin filas nuevas).
- [X] T025 [P] [US2] Extender `src/Domains/Graph/Components/specs/SessionSummaryBar.spec.tsx` y `src/Domains/Graph/Components/SessionSummaryBar.tsx` con la métrica global "Paralelismo ×N" (P8; FR-009).
- [X] T026 [P] [US2] Crear `src/Domains/Inspector/Components/specs/ParallelismSection.spec.tsx` (S5): visible solo con grupo; muestra tamaño, serial, wall, aceleración y eficiencia; etiqueta provisional.
- [X] T027 [US2] Implementar `src/Domains/Inspector/Components/ParallelismSection.tsx` y montarla en `ContextSection` (depende de T026, T015) (context-panel-contract §3).

**Checkpoint**: Aceleración visible y verificable numéricamente.

---

## Phase 5: User Story 3 - Contexto in/out y aporte al padre (Priority: P2)

**Goal**: El nodo muestra `in → out`; el detalle indica cuánto aportó al padre y qué % representa, con navegación al padre.

**Independent Test**: Con un hijo inyectado en su padre, el nodo muestra in/out y el detalle el aporte y el `%`, navegable (quickstart §2 US3; C6..C8).

- [X] T028 [P] [US3] Crear `src/Domains/Graph/lib/specs/parentImpact.spec.ts` (C6, C7): halla el tool de spawn por `metadata.sessionID` (`subagent`/`task`), calcula `addedChars`, `pctOfParent` y `addedTokens`; nodo raíz / sin tool → `null` (context-metrics-contract §3; FR-012/FR-013).
- [X] T029 [US3] Implementar `deriveParentImpact(parentMessages, childSessionId)` en `src/Domains/Graph/lib/metrics/parentImpact.ts` (puro, depende de T028, T008) (context-metrics-contract §3; research R5).
- [X] T030 [P] [US3] Extender `src/Domains/Graph/Components/specs/AgentNodeFooter.spec.tsx` e implementar la línea `in → out` en `src/Domains/Graph/Components/AgentNodeFooter.tsx` (entrada = ventana; salida = `output + reasoning`), sin romper `cardHeight` (FR-011; context-panel-contract §5).
- [X] T031 [US3] Extender `src/Domains/Inspector/Hooks/useContextMetrics.ts` para calcular `parentImpact` bajo demanda con los mensajes del padre (`useSessionMessages(parentId)`), y extender `src/Domains/Inspector/Hooks/specs/useContextMetrics.spec.tsx` (S4) (context-panel-contract §1; research R5).
- [X] T032 [US3] Implementar `src/Domains/Inspector/Components/ParentImpactRow.tsx` (aporte + `%` + control "Ir al agente padre" accesible por teclado) con su spec `specs/ParentImpactRow.spec.tsx` (S4, S8), y montarla en `ContextSection` (depende de T031, T015) (FR-012..FR-014).
- [X] T033 [US3] Ajustar `src/Domains/Graph/lib/cardHeight.ts` y `src/Domains/Graph/lib/specs/cardHeight.spec.ts` si la línea in/out requiere reserva de alto/ancho (S7).

**Checkpoint**: in/out en el nodo y aporte al padre navegable.

---

## Phase 6: User Story 4 - Cobertura completa de contexto en el detalle (Priority: P3)

**Goal**: La sección Contexto reúne ventana, caché+hit rate, composición, evolución, salida, compactaciones y coste, con los 4 estados.

**Independent Test**: Con cualquier nodo, el panel contiene todos los apartados y cada uno respeta error/cargando/vacío/datos (quickstart §2 US4; S1, S3).

- [X] T034 [P] [US4] Extender `src/Domains/Inspector/Components/specs/ContextSection.spec.tsx` (S1, S3): ventana, caché y **tasa de acierto**, evolución del contexto por paso, salida y relación `reasoning/output`, compactaciones (`SessionMessageCompaction`) y coste por 1k tokens; estado vacío por apartado.
- [X] T035 [US4] Extender `src/Domains/Inspector/Components/ContextSection.tsx` con los apartados restantes (depende de T034, T015) (context-panel-contract §2; FR-016).
- [X] T036 [US4] Implementar la evolución del contexto (sparkline) respetando `prefers-reduced-motion` en `src/Domains/Inspector/Components/ContextGrowth.tsx` con su spec (depende de T034).
- [X] T037 [P] [US4] Extender `src/Domains/Inspector/Components/specs/ContextSection.spec.tsx` (o nuevo spec a11y) para la accesibilidad de la sección (leyenda textual, `role`/`aria-label`) (S8; context-panel-contract §7).

**Checkpoint**: Cobertura completa de contexto en el detalle.

---

## Phase 7: User Story 5 - Velocidad de respuesta y anomalías (Priority: P2)

**Goal**: Serie de TTFT y latencia total; anomalía bidireccional contra la mediana histórica (nodo/agente), umbral configurable.

**Independent Test**: Con respuestas previas que fijan la mediana, una muy lenta y una muy rápida se marcan como anomalía con magnitud y referencia (quickstart §2 US5; L1..L9).

- [X] T038 [P] [US5] Crear `src/Domains/Graph/lib/specs/anomalyThreshold.spec.ts` (L7): `clampThreshold` acota a `(0.05, 0.95)` y cae al default con `NaN`; `DEFAULT_ANOMALY_THRESHOLD = 0.4`.
- [X] T039 [US5] Implementar `src/Domains/Graph/lib/metrics/anomalyThreshold.ts` (`DEFAULT_ANOMALY_THRESHOLD`, `clampThreshold`, clave de `localStorage`) (depende de T038) (latency-anomaly-contract §4; research R7).
- [X] T040 [P] [US5] Crear `src/Domains/Graph/lib/specs/latency.spec.ts` (L1..L6): muestras `ttftMs`/`totalMs` desde `time`; referencia = mediana del nodo con ≥ `MIN_SAMPLES`, del agente si no; sin baseline → `anomalies = []`; `slow`/`fast` según umbral; dentro de banda → sin anomalía (latency-anomaly-contract §2/§3; FR-018..FR-021).
- [X] T041 [US5] Implementar `deriveLatency(messages, options)` y `detectAnomalies(...)` en `src/Domains/Graph/lib/metrics/latency.ts` (puro, depende de T040, T003) (latency-anomaly-contract §2/§3).
- [X] T042 [US5] Extender `src/Domains/Graph/lib/enrichNodeData.ts` para añadir `context.latency` (depende de T041, T016) (data-model §3.1; research R3).
- [X] T043 [P] [US5] Crear `src/Domains/Graph/Components/specs/AgentNodeLatencyMark.spec.tsx` (L8): marca textual "Respuesta lenta/rápida" + color cuando la última muestra es anómala.
- [X] T044 [US5] Implementar `src/Domains/Graph/Components/AgentNodeLatencyMark.tsx` y cablearla en `AgentNode.tsx` (depende de T043, T042) (FR-023).
- [X] T045 [US5] Implementar `src/Domains/Inspector/Components/LatencySection.tsx` (serie TTFT/total, mediana de referencia, lista de anomalías con magnitud y referencia) con su spec `specs/LatencySection.spec.tsx` (L9), y montarla en `ContextSection` (depende de T041, T015) (context-panel-contract §4; FR-019/FR-023).

**Checkpoint**: Velocidad y anomalías visibles, con umbral configurable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cierre transversal.

- [X] T046 [P] Extender los barrels (`src/Domains/Graph/Components/index.ts`, `src/Domains/Inspector/Components/index.ts`, `src/Domains/Inspector/Hooks/index.ts`) con los artefactos nuevos (AGENTS §11).
- [X] T047 [P] Ejecutar `quickstart.md` completo: specs por historia, regresión (`lint`, `tsc`, `vitest run`, `build`) y checklist de aceptación.
- [X] T048 Revisar que ninguna métrica muestra valores inventados (SC-007) y que la información no depende solo del color (a11y), ajustando si hace falta.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias.
- **User Stories (Phase 3+)**: dependen de Foundational. US1 es el MVP; US2..US5 pueden ir en paralelo entre sí, salvo las integraciones en `ContextSection.tsx`/`enrichNodeData.ts`/`AgentNode.tsx` (mismo archivo → secuenciar).
- **Polish (Phase 8)**: al cerrar las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: independiente tras Foundational (MVP).
- **US2 (P2)**: independiente; monta `ParallelismSection` en `ContextSection` (US1) → coordinar el archivo.
- **US3 (P2)**: depende de US1 para la composición del padre (`deriveContextBreakdown`) y para `ContextSection`.
- **US4 (P3)**: depende de US1 (`ContextSection`) y reutiliza `TParentImpact` (US3).
- **US5 (P2)**: independiente; extiende `enrichNodeData` (US1) y monta `LatencySection` en `ContextSection`.

### Within Each User Story

- Spec (falla) → implementación → integración → validación.
- Derivaciones puras antes de los componentes.

### Parallel Opportunities

- T001/T002 (Setup) y T003/T004/T005 (Foundational) en paralelo.
- Los specs puros de cada historia (`[P]`) en paralelo entre sí.
- Historias distintas en paralelo por equipos, salvo archivos compartidos (`ContextSection.tsx`, `enrichNodeData.ts`, `AgentNode.tsx`, `useContextMetrics.ts`).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Setup + Foundational → base lista.
2. US1 → validar composición en el detalle.
3. **STOP and VALIDATE** con `quickstart.md §2 US1`.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → MVP.
3. US2 → US3 → US5 → US4, cada una validada de forma independiente sin romper las anteriores.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Sin `git add`/`commit` durante `implement` (lo gestiona `sddorch-release`).
- No añadir filas al card sin ajustar `cardHeight`.
- Todo campo nuevo del nodo **debe** entrar en `sameNodeData`.
