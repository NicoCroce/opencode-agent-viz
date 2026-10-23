---

description: "Task list for 015-session-efficiency-panel"
---

# Tasks: Panel de eficiencia de sesión

**Input**: Design documents from `/specs/015-session-efficiency-panel/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/efficiency-engine-contract.md](./contracts/efficiency-engine-contract.md),
[contracts/efficiency-overlay-contract.md](./contracts/efficiency-overlay-contract.md),
[quickstart.md](./quickstart.md), `.specify/memory/constitution.md`

**Tests**: SÍ solicitados — el plan, los dos contratos y `quickstart.md` exigen specs en carpetas
`specs/` junto al código (Principio VIII), con ciclo rojo → verde, y la instrucción del run exige un
spec de integración por cada cadena de estado que cruce dos unidades. Toda tarea de test crea o
extiende **solo** ficheros de test; ninguna mezcla producto y test.

**Organization**: por historia de usuario (US1/US2 P1; US3/US4 P2; US5 P3), con una tarea E2E por
frontera de unidades dentro de la fase de la historia que la posee.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable — fichero propio sin conflicto de escritura con otra tarea; se lanza cuando
  sus dependencias están completas.
- **[Story]**: US1…US5 solo en fases de historia. Setup, Foundational y Polish no llevan etiqueta.
- Cada descripción indica `writes:` con las rutas exactas que escribe la tarea y el resultado que
  debe quedar cierto. No hay tareas vagas ni pasos implícitos.

## Instrucción adicional del run ($ARGUMENTS) — integración E2E de fronteras

> «Por cada cadena de estado de `contracts/` que cruce dos unidades, añade una tarea de integración
> de extremo a extremo con su spec, incluido el caso negativo (dato inexistente / 404); ninguna
> frontera entre unidades queda sin dueño».

**Unidades de esta feature**:

- **U1** = motor puro: `src/Domains/Efficiency/Efficiency.entity.ts` + `src/Domains/Efficiency/lib/**`.
- **U2** = hook de datos: `src/Domains/Efficiency/Hooks/**` (`useSessionEfficiency`).
- **U3** = presentación del dominio: `src/Domains/Efficiency/Components/**`.
- **U4** = proyección y estado de vista en Infrastructure:
  `src/Infrastructure/lib/buildEfficiencySessions.ts` + `src/Infrastructure/Hooks/useEfficiencyPanel.ts`.
- **U5** = overlay: `src/Infrastructure/Components/EfficiencyOverlay.tsx`.
- **U6** = entrada y slots: `GraphPane.tsx`, `WorkspaceView.tsx`, `WorkspaceLayout.tsx`.
- **U7** = composición del workspace: `WorkspacePage.tsx` + `useWorkspaceEscape.ts`.

Toda cadena de estado de los contratos que cruza dos unidades tiene **un dueño E2E** con caso
negativo. Los diez specs viven en `src/Infrastructure/specs/integration/` (misma convención de
suites E2E de frontera que `012-refactor-workspace-enrichment` y `014-inspector-detail-tabs`) y
reutilizan `src/Infrastructure/specs/integration/harness.tsx` **sin modificarlo**; los que no
necesitan la página usan `renderWithProviders`/`createTestQueryClient` de `src/test/` sin duplicar
el arnés.

| Frontera | Cadena de estado (contracts) | Dueño E2E | Caso negativo |
|---|---|---|---|
| U1 ↔ U2 | Engine §2/§3 + data-model §3/§5.4 — caché `sessions.messages` → `TEfficiencyReport` (sin fetch) | T037 | Raíz sin caché y `rootReady: true` ⇒ `no_data`, nunca mensajes inventados; `graphError` sin informe ⇒ error, nunca vacío |
| U1 ↔ U3 | Engine §5 + overlay §5.2 — score/banda/cobertura/confianza/factores → veredicto | T038 | `in_progress`/`insufficient` ⇒ sin nota y sin `aria-label` “N de 100”; cobertura y métricas crudas visibles |
| U1 ↔ U3 | Engine §6 + overlay §5.3 — hallazgo/ancla/cita → tarjetas y señales débiles | T049 | Candidato sin `evidence.messageId` ⇒ no se emite/tarjeta ausente; cita >120 code points solo completa al expandir |
| U1 ↔ U3 | Data-model §2.5 + overlay §5.4 — ciclo del turno → tabla/detalle | T054 | Un solo turno ⇒ “muestra insuficiente” sin nota; turno abierto marcado y fuera de denominadores; prompt corto sin botón |
| U1 ↔ U3 ↔ U7 | Engine §7 + overlay §5.6/R8 — totales `null` → “no disponible” y contraste con `summary.metrics` | T061 | Sin tokens/coste ⇒ “no disponible”, nunca 0/100; referencia distinta ⇒ nota de compactación |
| U4 ↔ U5 ↔ U6 | Overlay §1/§2/§3 + data-model §5.3 — abrir/cerrar/foco/cambio de raíz | T039 | Disparador eliminado del DOM ⇒ no se fuerza foco inválido ni lanza; raíz 404 ⇒ botón no montado |
| U5 ↔ U7 | Overlay §2/§9 — exclusión mutua eficiencia ↔ histórico y propiedad de `Escape` | T040 | `Escape` sin selección ni histórico ⇒ no-op; abrir histórico cierra eficiencia y viceversa |
| U4 ↔ U1 | Data-model §1.2/§5.2/§5.3 + engine §4 — grafo (aristas/estado) → mapa de sesiones → estado y parcialidad | T059 | Hijo sin mensajes ⇒ `isPartial` + `missingSessionIds`, sin ceros inventados; hijo activo ⇒ `in_progress`; raíz inexistente ⇒ `no_data` |
| U2 ↔ U5 | Overlay §4 — precedencia de estados del informe → render del overlay | T060 | Error/404 sin informe ⇒ `EmptyScreenError`, nunca vacío; error con informe previo ⇒ banner “no actualizado” y datos conservados |
| U3 ↔ U7 | Overlay §5.4/§7 + FR-034/SC-010 — misma fuente → tabla escritorio / tarjetas móvil | T066 | 320 px sin scroll horizontal de página (aserción estructural + deuda visual); prompt corto sin expansión |

> **Desviación documentada respecto a `plan.md`**: el plan listaba un único spec de integración
> (`workspaceEfficiencyOverlay.integration.spec.tsx`). Los otros nueve son una adición exigida por
> la instrucción del run; no tocan la superficie de producto ni el arnés.

## Ficheros intocables (superficie congelada)

| Fichero / zona | Motivo |
|---|---|
| `src/Domains/queryKeys.ts` | sin claves nuevas ni renombradas; se reutiliza `sessions.messages(id)` |
| `src/Domains/History/**` (`buildHistory`, etc.) | sin cambios (decisión vinculante) |
| `src/Domains/Graph/lib/metrics/summarizeSession.ts` | se consume el resultado, no se recalcula ni se edita |
| `src/Domains/Graph/Graph.entity.ts` (`TGraphNodeData`, `sameNodeData`) | sin cambios; el overlay no re-layouta el grafo |
| `specs/014-inspector-detail-tabs/**` y `src/Domains/Inspector/**` | 7 pestañas y `Detalle \| Chat` intactos; no hay 8.ª pestaña |
| `src/Infrastructure/Routes.tsx`, `*.routes.ts` | sin ruta nueva |
| `package.json`, `pnpm-lock.yaml` | sin dependencias nuevas (Radix Dialog 1.1.x ya instalado) |
| `src/Infrastructure/specs/integration/harness.tsx` | se reutiliza sin modificarlo |
| `src/Infrastructure/EventStreamProvider.tsx`, reducer/batching | sin cambios (Principio VII) |

## Ficheros serializados (un solo dueño por edición)

Estos ficheros se editan varias veces; las tareas que los escriben **no son paralelizables** y van
en el orden indicado.

| Fichero | Secuencia |
|---|---|
| `src/Domains/Efficiency/lib/analyzeSession.ts` | T016 → T043 |
| `src/Domains/Efficiency/Components/EfficiencyReport.tsx` | T028 → T047 → T052 → T055 → T064 |
| `src/Domains/Efficiency/Components/index.ts` | T030 → T047 → T052 → T064 |
| `src/Domains/Efficiency/lib/specs/analyzeSession.spec.ts` | T017 → T044 |
| `src/Domains/Efficiency/Components/specs/EfficiencyReport.spec.tsx` | T029 → T048 → T053 → T056 → T065 |
| `src/Infrastructure/Components/EfficiencyOverlay.tsx` | T031 → T057 |
| `src/Infrastructure/Components/specs/EfficiencyOverlay.spec.tsx` | T032 → T058 |

---

## Phase 1: Setup (línea base de no regresión)

**Purpose**: fijar el verde de partida y la superficie congelada antes de crear el dominio.

- [X] T001 (writes: `specs/015-session-efficiency-panel/baseline.md`) Ejecutar la línea base y registrarla en `specs/015-session-efficiency-panel/baseline.md`: `pnpm test -- src/Infrastructure/Components/specs/GraphPane.spec.tsx src/Infrastructure/Components/specs/WorkspaceView.spec.tsx src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx src/Infrastructure/specs/WorkspacePage.spec.tsx src/Infrastructure/Hooks/specs/useWorkspaceEscape.spec.tsx`, `pnpm tsc`, `pnpm tsc:node` y `pnpm lint`; anotar el total de tests, `git rev-parse HEAD`, la versión instalada de `@radix-ui/react-dialog` (1.1.23) y la ausencia de dependencias nuevas. Adjuntar la salida de `git diff --exit-code` para `src/Domains/queryKeys.ts`, `src/Domains/History/lib/buildHistory.ts`, `src/Domains/Graph/lib/metrics/summarizeSession.ts`, `src/Domains/Graph/Graph.entity.ts` y `specs/014-inspector-detail-tabs/`.

**Checkpoint**: baseline verde y firmada; recién ahora se crea código.

---

## Phase 2: Foundational (prerrequisitos bloqueantes de todas las historias)

**Purpose**: tipos, constantes, texto, hechos/turnos, score, informe, proyección del grafo y hook
observador. Sin estos módulos ninguna historia puede calcular ni renderizar un informe.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase.

- [X] T002 [P] (writes: `src/Domains/Efficiency/Efficiency.entity.ts`) Crear `Efficiency.entity.ts` con todos los tipos de `data-model.md` §1–§2: `TEfficiencySessionStatus`, `TEfficiencySessionMeta`, `TEfficiencyInput`, `TEfficiencyStatus`, `TBand`, `TConfidence`, `TSeverity`, `TDimensionKey`, `TRuleId`, `TIndicatorKey`, `TIndicatorResult`, `TDimensionResult`, `TEfficiencyTotals`, `TEfficiencyReference`, `TTurnAnalysis`, `TEvidence`, `TFinding` (incluye `condition`), `TFactor`, `TOmission`, `TEfficiencyReport`, `TUseSessionEfficiencyParams` y `TSessionEfficiencyResult`. Prefijo `T`, sin redefinir tipos del SDK; `TSessionMessage` se importa con `import type` desde `@app/Infrastructure/Services/opencodeClient`.
- [X] T003 [P] (writes: `src/Domains/Efficiency/lib/thresholds.ts`) Crear `thresholds.ts` con los valores normativos de engine §5 y data-model §4: pesos `{ entrada: 30, ejecucion: 30, contexto: 15, resultado: 25 }`; pesos de indicador (45/35/20, 45/35/20, 70/30, 70/30); caps `0,5 / 0,33 / 1 / 0,2 / 0,1 / 0,15 / 2 / 0,6 / 1 / 1`; mínimos (3 pares; 10 calls y 5 pasos; 10 pasos de caché; outcome conocido); guardas de cobertura `<60`, confianza `>=85` alta y `>=70` media; bandas 85/70/50; `PROMPT_TRUNCATE_CODE_POINTS = 120`; `SLOW_TOOL_MS = 60_000`; `MAX_FINDINGS = 10`; `MAX_WEAK_SIGNALS = 10`. Sin números mágicos fuera de este archivo.
- [X] T004 [P] (writes: `src/Domains/Efficiency/lib/labels.ts`) Crear `labels.ts` con las etiquetas en español de dimensiones, bandas (`eficiente`, `aceptable`, `mejorable`, `fricción`), confianza, severidad, estados (`En curso`, `Muestra insuficiente`, `Sin datos`) y el copy neutral de UI (“posible fricción”, “señal”, “no disponible”). Sin importar React ni SDK.
- [X] T005 [P] (writes: `src/Domains/Efficiency/lib/text.ts`) Crear `text.ts` según research R4: `normalizeText` (NFD, sin marcas, minúsculas), `tokenize` con `/[^\p{L}\p{N}]+/u`, `tokenCount`, `similaritySet` (tokens ≥2 y stopwords es/en), `jaccard` (unión vacía ⇒ 0), `codePointLength`, `truncateCodePoints(120)`, `isWriteTool` (`write`, `edit`, `patch`, `apply_patch`, `multiedit`, case-insensitive), `extractFilePath` (claves `filePath/filepath/path/file/filename`, profundidad 4, `\`→`/`), `canonicalToolInput` (profundidad 4, strings 256, arrays 20, total 1 000) y `extractQuestionText` (`title/question/header/prompt`).
- [X] T006 [P] (writes: `src/Domains/Efficiency/lib/specs/text.spec.ts`, `src/Domains/Efficiency/lib/specs/thresholds.spec.ts`) Crear los dos specs de nodo: `text.spec.ts` cubre acentos/mayúsculas, stopwords, emoji/code points, Jaccard 0,59/0,60/0,61, tokenCount 5/6/7, canónico estable y extracción de ruta; `thresholds.spec.ts` verifica que los pesos de dimensión suman 100, los de indicador suman 1 por dimensión, caps >0, mínimos ≥0 y los límites de bandas/confianza. Deben fallar antes de T003/T005.
- [X] T007 [P] (writes: `src/Domains/Efficiency/lib/specs/fixtures.ts`) Crear `fixtures.ts` (no es suite) con builders deterministas de `TSessionMessage`: `buildUser`, `buildAssistant` (tokens/coste/retry/error), `buildToolPart` (running/completed/error, `time.created/ran/completed`, input canónico), `buildIdle` (succeeded/failed/interrupted), `buildCompaction` (auto/manual, completed) y `buildLongSession(200)`; tiempos fijos, sin `Date.now()`.
- [X] T008 (writes: `src/Domains/Efficiency/lib/turns.ts`) Crear `turns.ts` con una sola pasada sobre `messagesBySession` (raíz + subárbol) que construya `TFacts` (data-model §5.1), los turnos de `TTurnAnalysis` y los totales de engine §7: usuarios solo de la raíz; pasos/herramientas por ventana `[at, cierre)`; cierre por `idle` con ≥1 paso o por el siguiente `user` (interrupted); `idle` sin pasos de cancelación; turno abierto fuera de denominadores; `cost/tokens/cache` assistant-only; `windowTokens` de la raíz; `latencyP95Ms` nearest-rank y `slowToolCalls`; `missingSessionIds` ordenados. No muta la entrada. Depende de T002, T003 y T005.
- [X] T009 [P] (writes: `src/Domains/Efficiency/lib/specs/turns.spec.ts`) Crear `turns.spec.ts` con los casos de engine §10: turno normal, interrumpido por `user`, `idle` de cancelación, turno abierto, múltiples turnos, subagente atribuido por tiempo, `user` de subagente ignorado, índices 1..N y ≤1 abierto al final; totales `null` sin tokens/coste y `0` real en conteos. Depende de T007/T008.
- [X] T010 (writes: `src/Infrastructure/lib/buildEfficiencySessions.ts`) Crear la proyección pura `buildEfficiencySessions(graph: TGraphModel): Record<string, TEfficiencySessionMeta>` (data-model §1.2): `parentID` desde la arista cuyo `target` es el nodo (raíz sin padre), `status: isActiveStatus(node.data.status) ? 'active' : 'idle'`, incluye todos los nodos del grafo y no inventa sesiones. Depende de T002.
- [X] T011 [P] (writes: `src/Infrastructure/lib/specs/buildEfficiencySessions.spec.ts`) Crear el spec de nodo: raíz sin `parentID`, hijos con el `source` correcto, `active`/`idle` desde `isActiveStatus`, grafo vacío ⇒ `{}`, nodo sin arista ⇒ sin padre, y ninguna sesión fuera de `graph.nodes`. Depende de T010.
- [X] T012 (writes: `src/Domains/Efficiency/lib/score.ts`) Crear `score.ts` (engine §5): indicadores con `ratio`, `cap`, `score`, `count`, `minimum`; `1 − min(1, r/cap)` para fricción y `min(1, hitRate/0,6)` para caché; `RES-4` con `ratio = max(0, n−1)` y `cap = 2` (la primera compactación no resta); dimensión renormalizada sobre indicadores disponibles; global renormalizado sobre dimensiones disponibles y `Math.round` final; cobertura §4.4 (descuenta 4,5 si Contexto está disponible y la caché se omite); confianza §4.6; `bandFor` 85/70/50. No aplica las guardas de estado (las aplica `analyzeSession`). Depende de T002/T003/T008.
- [X] T013 [P] (writes: `src/Domains/Efficiency/lib/specs/score.spec.ts`) Crear `score.spec.ts`: dimensión disponible/omitida por mínimo, caché omitida (4,5), outcome 1/0,5/0, cobertura 59/60, bandas 49/50, 69/70 y 84/85, redondeo y confianza alta/media/baja/parcial; sin DOM. Depende de T012.
- [X] T014 (writes: `src/Domains/Efficiency/lib/factors.ts`, `src/Domains/Efficiency/lib/omissions.ts`) Crear `factors.ts` (2–3 factores por impacto `peso_dimensión × peso_indicador × (1 − score)`, con `count` y `kind: 'resta' | 'suma'`, fallback positivo cuando no hay pérdidas) y `omissions.ts` (`TOmission[]` desde dimensiones no disponibles y caché omitida, con motivo, peso, indicador, conteo y mínimo). Depende de T012.
- [X] T015 [P] (writes: `src/Domains/Efficiency/lib/specs/factors.spec.ts`, `src/Domains/Efficiency/lib/specs/omissions.spec.ts`) Crear los specs: 2–3 factores en `ok`, orden por impacto, fallback positivo, signo/conteo; omisiones de Entrada/Ejecución/Resultado y de la caché con su peso y motivo. Depende de T014.
- [X] T016 (writes: `src/Domains/Efficiency/lib/analyzeSession.ts`) Crear `analyzeSession(input): TEfficiencyReport` (engine §2–§4, §8): valida `rootSessionId` en `sessions`; construye `TFacts`/turnos/totales (T008); calcula score/factores/omisiones; aplica precedencia `no_data → in_progress → insufficient → ok` (alguna sesión `active`; `closedTurns < 2` o `coverage < 60`); `findings`/`weakSignals` vacíos hasta US2; añade notas en el orden de data-model §7; devuelve objeto inmutable, sin `Date.now`, aleatoriedad, React ni SDK (solo `now` inyectado). Depende de T008/T012/T014.
- [X] T017 [P] (writes: `src/Domains/Efficiency/lib/specs/analyzeSession.spec.ts`) Crear el spec de nodo: sesión limpia, con fricción, en curso, <2 turnos, cobertura <60, sin datos, subárbol parcial; notas en el orden de data-model §7 (parcial, tokens, caché, compactación, turno abierto); dos ejecuciones con el mismo input ⇒ mismo `JSON.stringify`; fixture de 200 mensajes con `performance.now()` < 1 000 ms; totales coincidentes con `summarizeSession` en una sesión de un nodo. Depende de T007/T016.
- [X] T018 (writes: `src/Domains/Efficiency/Hooks/useSessionEfficiency.ts`) Crear `useSessionEfficiency` según data-model §3 y research R2: `useQueries` sobre `queryKeys.sessions.messages(id)` con `queryFn: skipToken` y `staleTime: Infinity` (observador de caché, **nunca** fetch), referencias estabilizadas, `analyzeSession` memoizado por `[idsKey, referencias, sessionsKey, now]`, `enabled: false` ⇒ sin observación, raíz ausente con `rootReady:false` ⇒ `isLoading`, con `rootReady:true` ⇒ `messagesBySession[root]=[]` ⇒ `no_data`, subárbol ausente ⇒ `isPartial` + `missingSessionIds`, `graphError` sin informe ⇒ `isError`, con informe ⇒ se conserva. No llama al SDK. Depende de T007/T016.
- [X] T019 [P] (writes: `src/Domains/Efficiency/Hooks/specs/useSessionEfficiency.spec.tsx`) Crear el spec de hook (jsdom) con `renderWithProviders` y `createTestQueryClient({ gcTime: Infinity })`: `enabled:false` sin observación; raíz cacheada ⇒ informe; raíz ausente con `rootReady:false` ⇒ carga; con `true` ⇒ `no_data`; hijo ausente ⇒ `isPartial`/`missingSessionIds`; `setQueryData` del hijo ⇒ nuevo informe; re-render con las mismas referencias ⇒ misma referencia; sesión `active` ⇒ `in_progress`/`score:null`; `graphError` sin datos ⇒ `isError`; ninguna petición de red. Depende de T007/T018.
- [X] T020 (writes: `src/Infrastructure/Hooks/useEfficiencyPanel.ts`) Crear `useEfficiencyPanel({ rootSessionId, clock? })` según research R1: `{ isOpen, openedAt, open(trigger), close, restoreFocus }`; `open` guarda `event.currentTarget` y `openedAt = clock()` (por defecto `Date.now`); `restoreFocus` enfoca el disparador solo si sigue en `document`; un cambio de `rootSessionId` resetea durante el render (patrón `useHistoryOverlay`), sin `useEffect` en cascada. Depende de T002.
- [X] T021 [P] (writes: `src/Infrastructure/Hooks/specs/useEfficiencyPanel.spec.tsx`) Crear el spec: abre/cierra, `openedAt` con reloj inyectado, `restoreFocus` enfoca el disparador, disparador eliminado ⇒ no lanza ni enfoca otro elemento, cambio de raíz cierra y limpia el disparador, y `open` guarda el elemento actual. Depende de T020.
- [X] T022 [P] (writes: `src/Domains/Efficiency/Hooks/index.ts`, `src/Domains/Efficiency/Components/EfficiencySkeleton.tsx`) Crear el barrel de hooks (`export * from './useSessionEfficiency'`) y `EfficiencySkeleton` sobre `ui/skeleton` con `role="status"` y texto “Cargando análisis…”, sin lógica ni datos. Depende de T018.
- [X] T023 [P] (writes: `src/Domains/Efficiency/Components/specs/EfficiencySkeleton.spec.tsx`) Crear el spec del skeleton: expone `role="status"`, el texto de carga y no anuncia una nota ni datos falsos. Depende de T022.

**Checkpoint**: tipos, motor completo (hechos, turnos, score, informe), proyección y hook de caché
listos; US1–US5 pueden empezar.

---

## Phase 3: User Story 1 - Veredicto explicable de un vistazo (Priority: P1) 🎯 MVP

**Goal**: abrir el panel desde la cabecera del grafo y ver puntuación, banda, cobertura, confianza,
factores y “cómo se calcula”, sin leer el transcript (FR-001, FR-005, FR-008…FR-017).

**Independent Test**: con caché sembrada de una sesión cerrada y ≥2 turnos, `pnpm test -- EfficiencyVerdict.spec.tsx EfficiencyFactors.spec.tsx EfficiencyHowCalculated.spec.tsx EfficiencyTotals.spec.tsx EfficiencyOverlay.spec.tsx` y los E2E T037–T040: el botón `Eficiencia` abre un `dialog` llamado “Eficiencia de la sesión” con nota entera, banda, cobertura, confianza y 2–3 factores; `Escape` cierra y el foco vuelve al botón.

> Los prerrequisitos de datos (motor e hook) están en Foundational (T012–T023); US1 añade la
> lectura, el acceso y el veredicto.

### Implementación de US1

- [X] T024 [US1] (writes: `src/Domains/Efficiency/Components/EfficiencyVerdict.tsx`, `src/Domains/Efficiency/Components/EfficiencyFactors.tsx`) Crear el veredicto (nota ≥2rem con `aria-label="{score} de 100, {banda}"`, banda con texto + icono sin depender del color, cobertura y confianza visibles; `score === null` ⇒ no pinta nota ni valores) y los factores (etiqueta, conteo, signo `resta`/`suma`, dimensión; 2–3). Presentación pura, sin datos ni fetch. Depende de T002/T004/T014.
- [X] T025 [P] [US1] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyVerdict.spec.tsx`, `src/Domains/Efficiency/Components/specs/EfficiencyFactors.spec.tsx`) Crear los specs: `aria-label` exacto “78 de 100, aceptable”, banda con texto e icono, cobertura/confianza, ausencia de nota con `score:null`; 2–3 factores con conteo/signo y orden. Depende de T024.
- [X] T026 [US1] (writes: `src/Domains/Efficiency/Components/EfficiencyHowCalculated.tsx`, `src/Domains/Efficiency/Components/EfficiencyTotals.tsx`) Crear “Cómo se calcula” (`Disclosure` con pesos, indicadores `r/cap/aporte/minimum`, cobertura, omisiones, confianza, bandas, notas del motor, “coste y latencia no puntúan” y fuente de totales) y `EfficiencyTotals` (coste, tokens in/out, caché, ventana, compactaciones, reintentos, errores, llamadas, latencia p95; `UnavailableValue` en ausencia; contraste opcional con `TEfficiencyReference` explicando compactación). Depende de T002/T004/T014.
- [X] T027 [P] [US1] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyHowCalculated.spec.tsx`, `src/Domains/Efficiency/Components/specs/EfficiencyTotals.spec.tsx`) Crear los specs: pesos/mínimos/omisiones/cobertura/confianza/bandas/notas visibles; “no disponible” en cada total ausente (nunca 0/100); contraste con referencia distinta y ausencia de `SessionSummaryBar`/`MetricsSection` duplicados. Depende de T026.
- [X] T028 [US1] (writes: `src/Domains/Efficiency/Components/EfficiencyReport.tsx`) Crear `EfficiencyReport` como orquestador de presentación: recibe `report`, `reference`, `isMobile`; compone veredicto, factores, “cómo se calcula” y totales. En esta tarea no monta hallazgos ni turnos (llegan en US2/US3) y no implementa los estados de guarda (US4). Depende de T024/T026.
- [X] T029 [P] [US1] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyReport.spec.tsx`) Crear el spec de `EfficiencyReport`: con `status:'ok'` muestra veredicto/factores/cómo se calcula/totales; no muestra nota con `score:null`; no hay fetch ni estados de carga/error propios. Depende de T028.
- [X] T030 [US1] (writes: `src/Domains/Efficiency/Components/index.ts`, `src/Domains/Efficiency/index.ts`) Crear el barrel de componentes con los exports actuales y el barrel raíz del dominio: `export * from './Efficiency.entity'; export * from './Hooks'; export * from './Components';`. Sin exportar módulos internos de `lib` que la UI no consuma. Depende de T022/T028.
- [X] T031 [US1] (writes: `src/Infrastructure/Components/EfficiencyOverlay.tsx`) Crear `EfficiencyOverlay` con las props de overlay §2: Radix `Dialog.Root/Portal/Overlay/Content` full-screen (`fixed inset-0 z-50 bg-surface-1`), `Title` “Eficiencia de la sesión”, `Description` “Análisis de solo lectura de la sesión y su subárbol.”, botón “Cerrar” (`aria-label="Cerrar análisis de eficiencia"`), `onCloseAutoFocus` con `preventDefault()` + `onRestoreFocus()`; usa `useSessionEfficiency` y `useDevice`; estados básicos `isLoading && !report` ⇒ `EfficiencySkeleton`, `isError && !report` ⇒ `EmptyScreenError`, `no_data` ⇒ `EmptyState`, datos ⇒ `EfficiencyReport`; el header y “Cerrar” siguen en carga/error/vacío. Depende de T022/T030.
- [X] T032 [P] [US1] (writes: `src/Infrastructure/Components/specs/EfficiencyOverlay.spec.tsx`) Crear el spec del overlay: `getByRole('dialog', { name: 'Eficiencia de la sesión' })`, foco inicial dentro, `Tab` cicla, `Escape` cierra, “Cerrar” cierra, `onRestoreFocus` se invoca, header visible en carga/error/vacío, y `Sin mensajes` en `no_data`. Usa `setupRadixUser` si el diálogo lo requiere. Depende de T031.
- [X] T033 [US1] (writes: `src/Infrastructure/Components/GraphPane.tsx`, `src/Infrastructure/Components/WorkspaceView.tsx`, `src/Infrastructure/Components/WorkspaceLayout.tsx`) Cablear la entrada y los slots: `GraphPane` gana `onOpenEfficiency(trigger: HTMLElement)` e `isMobile?: boolean`, monta `Eficiencia` (`variant="outline"`, `aria-haspopup="dialog"`, icono `faChartLine` con `aria-label="Abrir análisis de eficiencia"` en móvil, texto visible en escritorio) **antes** de `Seguir` y solo con `graph.graph.nodes.length > 0`; `WorkspaceView` gana `efficiency?: ReactNode` y lo pasa a `WorkspaceLayout`; `WorkspaceLayout` lo renderiza en móvil y escritorio junto a `history`, sin alterar las tres columnas ni el móvil. Depende de T002.
- [X] T034 [P] [US1] (writes: `src/Infrastructure/Components/specs/GraphPane.spec.tsx`, `src/Infrastructure/Components/specs/WorkspaceView.spec.tsx`, `src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx`) Extender los tres specs: `GraphPane` pinta `Eficiencia` antes de `Seguir`, `aria-haspopup="dialog"`, callback con `currentTarget`, sin nodos ⇒ no se monta, móvil ⇒ solo icono con `aria-label`; `WorkspaceView` propaga el slot; `WorkspaceLayout` monta `efficiency` en ambas presentaciones y conserva `history` y el layout de tres columnas. Depende de T033.
- [X] T035 [US1] (writes: `src/Infrastructure/WorkspacePage.tsx`, `src/Infrastructure/Hooks/useWorkspaceEscape.ts`) Cablear la página: `useEfficiencyPanel({ rootSessionId: rootId })`, `buildEfficiencySessions(graph.graph)` memoizado, `handleOpenEfficiency(trigger)` que cierra el histórico y abre eficiencia, `handleOpenHistory(sessionId)` que cierra eficiencia y abre el histórico (lo usan grafo e inspector), `EfficiencyOverlay` como slot con `rootTitle` (título del nodo raíz), `sessions`, `rootReady` (`enrichment === 'ready'` del nodo raíz), `truncated`, `graphError: graph.isError`, `now`, `reference: summary?.metrics ?? null`, `onClose`, `onRestoreFocus`; `GraphPane` recibe `isMobile={Boolean(isMobile)}`; `useWorkspaceEscape` gana `isDialogOpen?: boolean` y con `true` **no** registra su listener (Escape pertenece al diálogo). No toca `queryKeys` ni `summarizeSession`. Depende de T031/T033.
- [X] T036 [P] [US1] (writes: `src/Infrastructure/specs/WorkspacePage.spec.tsx`, `src/Infrastructure/Hooks/specs/useWorkspaceEscape.spec.tsx`) Extender los specs: la página abre/cierra el overlay, el cambio de raíz lo cierra y la exclusión mutua se cablea; `useWorkspaceEscape` con `isDialogOpen:true` no registra listener (Escape no limpia la selección) y sin diálogo conserva la precedencia actual; caso negativo: sin selección ni fullscreen el listener no se registra. Depende de T035.
- [X] T037 [US1] (writes: `src/Infrastructure/specs/integration/efficiencyCacheToReport.integration.spec.tsx`) E2E U1↔U2 (engine §2/§3 + data-model §3/§5.4): montar `EfficiencyOverlay` abierto con `renderWithProviders` y caché sembrada en `sessions.messages`; comprobar que el hook observa la caché sin fetch y el informe llega al DOM; `setQueryData` produce un informe nuevo. Negativo: raíz sin caché y `rootReady:true` ⇒ `Sin mensajes`/`no_data`, nunca mensajes inventados; `graphError` sin informe ⇒ `EmptyScreenError`. Depende de T031.
- [X] T038 [US1] (writes: `src/Infrastructure/specs/integration/efficiencyReportToVerdict.integration.spec.tsx`) E2E U1↔U3 (engine §5 + overlay §5.2): con un informe real de `analyzeSession`, comprobar nota entera, banda con texto + icono, cobertura, confianza, `aria-label` “N de 100, banda” y 2–3 factores con conteo y signo; “cómo se calcula” abre y muestra pesos/omisiones. Negativo: `in_progress` e `insufficient` ⇒ sin nota, sin valores de dimensión y sin `aria-label` “de 100”, con cobertura y métricas crudas visibles. Depende de T016/T028/T031.
- [X] T039 [US1] (writes: `src/Infrastructure/specs/integration/efficiencyPanelAccessFocus.integration.spec.tsx`) E2E U4↔U5↔U6 (overlay §1/§2/§3 + data-model §5.3): montar `WorkspacePage` con el arnés (`createIntegrationQueryClient`, `seedSessions`, `seedSubtree`, `seedMessages`, `seedDevice` y los mocks por barrel `mockGraphBarrel`/`mockSessionsBarrel`/`mockChatBarrel`/`mockInspectorBarrel`/`mockHistoryBarrel`); pulsar `Eficiencia`, comprobar `dialog`, foco atrapado, `Escape` cierra y el foco vuelve al disparador; `now` llega como `openedAt` y el turno abierto lo usa; cambiar de raíz cierra el panel. Negativo: carga/error/no encontrada/sin agentes/raíz 404 ⇒ el botón no se monta; disparador eliminado antes de cerrar ⇒ no se fuerza foco inválido ni lanza. Depende de T035.
- [X] T040 [US1] (writes: `src/Infrastructure/specs/integration/workspaceEfficiencyOverlay.integration.spec.tsx`) E2E U5↔U7 (overlay §2/§9): con histórico abierto, abrir eficiencia lo cierra; con eficiencia abierta, abrir el histórico la cierra; `Escape` con el diálogo abierto cierra solo el diálogo y no limpia la selección del grafo. Negativo: histórico cerrado y sin selección ⇒ `Escape` es no-op (no abre/cierra nada); abrir eficiencia dos veces no deja dos capas. Depende de T035.

**Checkpoint**: US1 funciona de punta a punta y es demostrable sola (MVP).

---

## Phase 4: User Story 2 - Hallazgos accionables con evidencia (Priority: P1)

**Goal**: mostrar hallazgos con condición, severidad, cita y recomendación; señales débiles aparte y
sin ancla no se emite (FR-023…FR-030).

**Independent Test**: `pnpm test -- rules.spec.ts EfficiencyFindingCard.spec.tsx EfficiencyFindings.spec.tsx` y T049: un hallazgo real muestra `ruleId`, condición, severidad, cita con turno/mensaje y recomendación; un candidato sin ancla no aparece; las señales débiles están separadas y no alteran la nota.

### Implementación de US2

- [X] T041 [US2] (writes: `src/Domains/Efficiency/lib/rules.ts`) Crear el catálogo INP-1…RES-6 (research R6): una emisión por regla, agregando conteo y eligiendo la evidencia más representativa; `messageId` obligatorio (sin ancla no emite); `quote` con formato `[turno N · msg_… · tool … · hh:mm] "texto"` usando `formatClock`; `condition` medido y neutral; recomendación específica; severidades (INP-1 media/alta con ≥2 pares; RES-1 media/alta con r ≥0,25 o fallo; RES-2 alta solo con attempt ≥3 o ≥3 reintentos; RES-4 baja con n≥2 y débil con n=1; INP-4/RES-5/RES-6 débiles); orden determinista `penalizes → severidad → peso → turnIndex → ruleId`; máximos 10/10. Depende de T008/T014.
- [X] T042 [P] [US2] (writes: `src/Domains/Efficiency/lib/specs/rules.spec.ts`) Crear la tabla por regla: positivo/negativo, umbral−1/umbral/umbral+1, sin ancla ⇒ no emite, severidad alta, RES-2 solo ≥3, RES-4 n=1 débil, señales débiles fuera de `findings`, cap 10 y orden estable. Depende de T041.
- [X] T043 [US2] (writes: `src/Domains/Efficiency/lib/analyzeSession.ts`) Extender `analyzeSession` para ejecutar el catálogo sobre `TFacts`, ordenar/capar `findings` y `weakSignals`, poblar `TTurnAnalysis.signals` con las reglas cuya evidencia cae en la ventana y mantener determinismo; las guardas y la cobertura no cambian. Depende de T016/T041.
- [X] T044 [US2] (writes: `src/Domains/Efficiency/lib/specs/analyzeSession.spec.ts`) Extender el spec de `analyzeSession` (T017): hallazgos/señales presentes, orden, cap, turno con señal, `findings.every(penalizes)` y `weakSignals.every(!penalizes)`, candidato sin ancla ausente y doble ejecución idéntica. Depende de T017/T043.
- [X] T045 [US2] (writes: `src/Domains/Efficiency/Components/EfficiencyFindingCard.tsx`, `src/Domains/Efficiency/Components/EfficiencyFindings.tsx`) Crear la tarjeta (`ruleId`, severidad con texto + icono, `condition`, cita recortada a 120 code points con `Disclosure` “Ver cita completa” que monta el texto completo **solo** al expandir, recomendación; sin tooltip ni copia) y la sección (2–5 hallazgos por impacto, `Disclosure` “Ver N hallazgos más”, señales débiles en “Señales (no restan)”, vacíos “Sin hallazgos”/“Sin señales débiles”). Depende de T002/T004.
- [X] T046 [P] [US2] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyFindingCard.spec.tsx`, `src/Domains/Efficiency/Components/specs/EfficiencyFindings.spec.tsx`) Crear los specs: condición/severidad/cita/recomendación; cita recortada y completa solo al expandir; señales separadas y sin alterar nota; cap y “Ver N más”; sin ancla no hay tarjeta. Depende de T045.
- [X] T047 [US2] (writes: `src/Domains/Efficiency/Components/EfficiencyReport.tsx`, `src/Domains/Efficiency/Components/index.ts`) Montar `EfficiencyFindings` en `EfficiencyReport` y exportar `EfficiencyFindingCard`/`EfficiencyFindings` desde el barrel; el informe conserva veredicto/factores/cómo se calcula/totales. Depende de T045/T028.
- [X] T048 [US2] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyReport.spec.tsx`) Extender el spec del informe: hallazgos y señales visibles, vacíos explícitos, cap/“Ver N más” y ninguna sección duplicada. Depende de T047.
- [X] T049 [US2] (writes: `src/Infrastructure/specs/integration/efficiencyFindingsEvidence.integration.spec.tsx`) E2E U1↔U3 (engine §6 + overlay §5.3): con fixture real, comprobar que cada regla emitida tiene su tarjeta (las 2–5 primeras visibles y el resto bajo “Ver N más”) con `ruleId`, condición, severidad, cita con turno/mensaje/herramienta/hora y recomendación; débiles en su sección y nota intacta; cita >120 code points completa solo al expandir. Negativo: candidato sin `evidence.messageId` ⇒ no se emite ni aparece; cita sin ancla no se inventa. Depende de T043/T047.

**Checkpoint**: US1 y US2 funcionan juntas sin romper la nota.

---

## Phase 5: User Story 3 - Tabla de turno a respuesta para localizar el reproceso (Priority: P2)

**Goal**: tabla cronológica de turnos con pedido, aclaraciones, resultado, coste, tiempo y señales,
con expansión del prompt/evidencia (FR-031…FR-035, escritorio).

**Independent Test**: `pnpm test -- EfficiencyTurnTable.spec.tsx EfficiencyTurnDetail.spec.tsx` y T054: filas en orden, campos esenciales, expansión con prompt completo y evidencia; un solo turno ⇒ “muestra insuficiente” y el turno visible.

### Implementación de US3

- [X] T050 [US3] (writes: `src/Domains/Efficiency/Components/EfficiencyTurnDetail.tsx`, `src/Domains/Efficiency/Components/EfficiencyTurnTable.tsx`) Crear el detalle (prompt completo, cita/evidencia y señales del turno, montados **solo** al expandir) y la tabla (`<caption>` “Turnos de la sesión”, `scope="col"`, columnas Turno/Pedido/Aclaraciones/Resultado/Coste/Tiempo/Señales, orden por `index`, botón “Ver detalle”/“Ocultar detalle” con `aria-expanded`/`aria-controls`, prompt recortado a 120 code points, prompt corto sin botón, turno abierto marcado y tiempo “—” si no hay `now`, “no disponible” en coste ausente). Depende de T002/T004/T008.
- [X] T051 [P] [US3] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyTurnDetail.spec.tsx`, `src/Domains/Efficiency/Components/specs/EfficiencyTurnTable.spec.tsx`) Crear los specs: caption/scope, orden, columnas, expansión, prompt corto sin botón, prompt largo recortado/expandido, prompt completo solo en el detalle, turno abierto marcado y coste/tiempo ausentes como “no disponible”. Depende de T050.
- [X] T052 [US3] (writes: `src/Domains/Efficiency/Components/EfficiencyReport.tsx`, `src/Domains/Efficiency/Components/index.ts`) Montar la tabla de turnos en `EfficiencyReport` (escritorio) y exportar `EfficiencyTurnDetail`/`EfficiencyTurnTable` desde el barrel; sin mezclar turnos de subagentes como pedidos humanos. Depende de T050/T047.
- [X] T053 [US3] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyReport.spec.tsx`) Extender el spec del informe: tabla presente con turnos, vacío “Sin turnos”, un solo turno visible y sin nota. Depende de T052.
- [X] T054 [US3] (writes: `src/Infrastructure/specs/integration/efficiencyTurnsLifecycle.integration.spec.tsx`) E2E U1↔U3 (data-model §2.5 + overlay §5.4): con informe real, filas cronológicas y expandibles, prompt completo solo al expandir, señales del turno y turno abierto marcado; un solo turno ⇒ “muestra insuficiente” sin nota y sin inventar denominadores. Negativo: prompt corto sin botón de expansión; turno abierto no cuenta para `<2` cerrados; sin `now` el tiempo es “—”. Depende de T016/T052.

**Checkpoint**: US1–US3 independientes y combinables.

---

## Phase 6: User Story 4 - Saber cuándo el panel no puede puntuar (Priority: P2)

**Goal**: declarar en curso, muestra insuficiente, cobertura <60 %, sin mensajes, parcial y error
sin inventar una nota; conservar datos previos ante un fallo de actualización (FR-013/FR-018/FR-036/FR-037/FR-046).

**Independent Test**: `pnpm test -- EfficiencyReport.spec.tsx EfficiencyOverlay.spec.tsx` y T059–T061: en curso, un turno y cobertura <60 % no muestran nota y sí estado/métricas crudas; sin mensajes ⇒ vacío; error sin datos ⇒ error; error con datos ⇒ banner y datos; parcial ⇒ banner.

### Implementación de US4

- [X] T055 [US4] (writes: `src/Domains/Efficiency/Components/EfficiencyReport.tsx`) Implementar los estados de guarda en el informe: `in_progress` ⇒ banner `role="status"` “Sesión en curso: sin nota”; `insufficient` ⇒ banner “Muestra insuficiente” + motivo (turnos y/o cobertura); en ambos, ocultar nota, valores de dimensión y hallazgos, y mostrar cobertura, dimensiones omitidas, conteos y totales crudos; `no_data` no se renderiza como informe. Depende de T052.
- [X] T056 [US4] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyReport.spec.tsx`) Extender el spec: en curso sin nota/valores/hallazgos con métricas crudas; insuficiente por <2 turnos y por cobertura <60 con el motivo correcto; `no_data` no monta veredicto. Depende de T055.
- [X] T057 [US4] (writes: `src/Infrastructure/Components/EfficiencyOverlay.tsx`) Implementar la precedencia completa de overlay §4: cerrado (Radix no monta contenido), carga (`isLoading && !report`), error sin datos (`EmptyScreenError` “No se pudo cargar la sesión.”), vacío (`report.status === 'no_data'` ⇒ `EmptyState` “Sin mensajes”), en curso/insuficiente/ok (pasa el informe), parcial (`isPartial` ⇒ banner `role="status"` “Análisis parcial: N sesiones sin datos”), no actualizado (`isError && report` ⇒ banner “No se pudieron actualizar los datos; se muestra el último análisis.”) y truncado del grafo (nota “El grafo está truncado: faltan agentes del subárbol.”). El header y “Cerrar” sobreviven a todos los estados. Depende de T055/T031.
- [X] T058 [US4] (writes: `src/Infrastructure/Components/specs/EfficiencyOverlay.spec.tsx`) Extender el spec: carga/error/vacío/datos, banner parcial, banner no actualizado con informe conservado, truncado, y error sin datos nunca se confunde con vacío. Depende de T057.
- [X] T059 [US4] (writes: `src/Infrastructure/specs/integration/efficiencyGraphProjection.integration.spec.tsx`) E2E U4↔U1 (data-model §1.2/§5.2/§5.3 + engine §4): montar el workspace con el arnés y sembrar grafo/caché; con `buildEfficiencySessions` real y `analyzeSession`, un hijo activo ⇒ `in_progress`/sin nota; un hijo sin mensajes ⇒ `isPartial` + `missingSessionIds` + confianza baja, con informe y banner; una sesión en `messagesBySession` fuera de `sessions` se analiza y se anota, sin ceros. Negativo: raíz inexistente/404 ⇒ `no_data`, sin informe inventado; arista a nodo ausente no crea sesión. Depende de T016/T035.
- [X] T060 [US4] (writes: `src/Infrastructure/specs/integration/efficiencyOverlayStates.integration.spec.tsx`) E2E U2↔U5 (overlay §4): montar el workspace y recorrer la precedencia cerrado → carga → error → vacío → en curso → insuficiente → ok → parcial → truncado → no actualizado; el header/“Cerrar” siguen en todos. Negativo: error/404 sin informe ⇒ `EmptyScreenError`, **nunca** “Sin mensajes”; error con informe previo ⇒ banner y datos conservados; subárbol parcial o grafo truncado ⇒ banner y veredicto visibles. Depende de T035/T057.
- [X] T061 [US4] (writes: `src/Infrastructure/specs/integration/efficiencyTotalsAvailability.integration.spec.tsx`) E2E U1↔U3↔U7 (engine §7 + overlay §5.6/R8): montar `WorkspacePage` con el arnés y comprobar totales derivados y `TEfficiencyReference` real de `summary.metrics`; coste y latencia como contexto, sin alterar nota. Negativo: sesión sin tokens/coste ⇒ “no disponible”, nunca 0/100; referencia distinta ⇒ nota de compactación; sin latencia ⇒ “no disponible”. Depende de T035/T055.

**Checkpoint**: los estados de no-puntuación y los fallos parciales son explícitos y seguros.

---

## Phase 7: User Story 5 - El mismo análisis en móvil (Priority: P3)

**Goal**: mismas cifras y hallazgos, turnos como tarjetas, sin scroll horizontal a 320 px (FR-034/FR-044, SC-010).

**Independent Test**: `pnpm test -- EfficiencyTurnCards.spec.tsx EfficiencyTurns.spec.tsx` y T066: con `seedDevice(client, true)` cada turno es un `<article>` expandible, sin tabla ancha; la nota/banda/cobertura/hallazgos coinciden con escritorio.

### Implementación de US5

- [X] T062 [US5] (writes: `src/Domains/Efficiency/Components/EfficiencyTurnCards.tsx`, `src/Domains/Efficiency/Components/EfficiencyTurns.tsx`) Crear las tarjetas (`<article>` por turno, mismos campos esenciales y botón de expansión, `min-w-0`/`break-words`, sin tabla ancha) y `EfficiencyTurns` como selector presentacional `isMobile ? <EfficiencyTurnCards/> : <EfficiencyTurnTable/>`; una sola fuente de datos, dos presentaciones, sin `md:hidden`. Depende de T050/T002.
- [X] T063 [P] [US5] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyTurnCards.spec.tsx`, `src/Domains/Efficiency/Components/specs/EfficiencyTurns.spec.tsx`) Crear los specs: tarjeta con campos/expansión/prompt completo, `article` por turno, sin tabla en móvil, tabla en escritorio y misma información en ambas. Depende de T062.
- [X] T064 [US5] (writes: `src/Domains/Efficiency/Components/EfficiencyReport.tsx`, `src/Domains/Efficiency/Components/index.ts`) Reemplazar el montaje directo de la tabla por `EfficiencyTurns` con `isMobile`, y exportar tarjetas/selector desde el barrel; el resto de secciones no cambia. Depende de T062/T055.
- [X] T065 [US5] (writes: `src/Domains/Efficiency/Components/specs/EfficiencyReport.spec.tsx`) Extender el spec: `isMobile:true` ⇒ tarjetas y `false` ⇒ tabla, con la misma nota/cobertura/hallazgos; sin `md:hidden` ni duplicación de secciones. Depende de T064.
- [X] T066 [US5] (writes: `src/Infrastructure/specs/integration/efficiencyResponsiveParity.integration.spec.tsx`) E2E U3↔U7 (overlay §5.4/§7 + FR-034/SC-010): con el mismo informe y el arnés (`seedDevice`), comparar escritorio y móvil y comprobar igualdad de nota/banda/cobertura/hallazgos; en móvil, tarjetas y no tabla ancha; expansión con prompt completo. Negativo: a 320 px no hay scroll horizontal de página (aserción estructural de contenedores `min-w-0`/`break-words` y ausencia de anchos fijos; la medición visual queda como deuda); prompt corto sin botón. Depende de T035/T064.

**Checkpoint**: las cinco historias cooperan; solo cambia la presentación.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: verificación final, rendimiento, accesibilidad/temas y superficie congelada.

- [X] T067 (writes: `specs/015-session-efficiency-panel/verification.md`) Ejecutar y registrar en `verification.md`: `pnpm test -- src/Domains/Efficiency`, los specs de Infrastructure, los diez E2E, `pnpm tsc`, `pnpm tsc:node`, `pnpm lint`, `pnpm test:coverage`; comprobar cobertura `lib` ≥90 % líneas / ≥85 % ramas, hook y secciones ≥80 %, fixture de 200 mensajes <1 000 ms y ausencia de peticiones de red al abrir. Auditar en el DOM: 0 comparaciones/rankings/percentiles, 0 puntuación de longitud/idioma/gramática/tono/cortesía, 0 hallazgos sin ancla/cita y 0 datos ausentes mostrados como 0/100. Anexar `git diff --exit-code` de la superficie congelada y confirmar 0 dependencias/claves/rutas nuevas. Depende de T037–T066.
- [X] T068 (writes: `specs/015-session-efficiency-panel/verification.md`) Anexar la revisión manual/deuda: teclado completo (abrir, recorrer, expandir, cerrar, volver al disparador), 320 px sin scroll horizontal, temas claro/oscuro/`forced-colors`, contraste 4.5:1/3:1, `prefers-reduced-motion`, objetivos táctiles y ausencia de `dangerouslySetInnerHTML`. Cerrar con el veredicto de la compuerta de constitución (I–VIII) y el `git rev-parse HEAD` final. Depende de T067.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001; **bloquea** US1–US5. Incluye el motor completo
  (T008–T017) y el hook observador (T018–T019); sin ellos no hay informe.
- **US1 (Phase 3)**: depende de Foundational; es el MVP.
- **US2 (Phase 4)**: depende de Foundational (T016) y de US1 (T028/T030); puede empezar en paralelo
  con US3 salvo los ficheros serializados.
- **US3 (Phase 5)**: depende de Foundational y de US1 (T028/T030); comparte
  `EfficiencyReport.tsx`/barrel con US2 (orden T047 → T052).
- **US4 (Phase 6)**: depende de US1 (overlay/report) y de US2/US3 para ocultar secciones con datos
  completos; comparte report/overlay (T055/T057).
- **US5 (Phase 7)**: depende de US3 (tabla/detalle) y US4 (report estable).
- **Polish (Phase 8)**: depende de todas las historias y de sus E2E.

### User Story Dependencies

- **US1 (P1)**: independiente tras Foundational; entrega el panel y el veredicto.
- **US2 (P1)**: requiere US1; añade hallazgos sin cambiar score.
- **US3 (P2)**: requiere US1; añade turnos sin cambiar score.
- **US4 (P2)**: requiere US1–US3; declara estados y conserva datos.
- **US5 (P3)**: requiere US3; misma fuente, otra presentación.

### Within Each User Story

- Tests primero (rojo) y luego producto, salvo los E2E de frontera, que se escriben cuando las dos
  unidades que cruzan ya existen y deben fallar antes del último cableado si falta un caso.
- Foundational: tipos/constantes → texto → hechos/turnos → score → factores/omisiones → informe →
  hook. US1: componentes → overlay → cableado → E2E.
- Un fichero serializado (tabla superior) se edita en el orden indicado; nunca en paralelo.

### Parallel Opportunities

- Foundational: T002–T005 en paralelo; T006/T007 en paralelo; T010/T012 en paralelo tras T002/T008;
  T014 tras T012; T016 tras T014; T018 tras T016; T020/T022 en paralelo tras T018; T021/T023 en
  paralelo tras T020/T022.
- US1: T024/T026 en paralelo (ficheros distintos); T028 tras T024/T026; T030/T031 tras T028; T033/
  T035 en paralelo tras T031 (T035 depende de T031); specs T034/T036 en paralelo; T037–T040 en
  paralelo entre sí.
- US2/US3: T041/T045/T050 en paralelo; los specs T042/T046/T051 en paralelo; **no** paralelizar
  T047/T052 (mismo `EfficiencyReport.tsx`/barrel).
- US4: T055/T057 en secuencia; T059/T060/T061 en paralelo tras T057.
- US5: T062/T063 en secuencia; T064/T065; T066 al final.

---

## Parallel Example: User Story 1

```bash
# Producto en paralelo (ficheros distintos):
Task: "T024 EfficiencyVerdict.tsx + EfficiencyFactors.tsx"
Task: "T026 EfficiencyHowCalculated.tsx + EfficiencyTotals.tsx"

# Specs en paralelo, después de sus productos:
Task: "T025 EfficiencyVerdict.spec.tsx + EfficiencyFactors.spec.tsx"
Task: "T027 EfficiencyHowCalculated.spec.tsx + EfficiencyTotals.spec.tsx"

# Cableado en secuencia (T028 es el punto de composición):
Task: "T030 barrels del dominio + T033 GraphPane/WorkspaceView/WorkspaceLayout"
Task: "T031 EfficiencyOverlay.tsx (tras T030)"
Task: "T035 WorkspacePage + useWorkspaceEscape (tras T031/T033)"
Task: "T037–T040 E2E de fronteras de US1 (tras T035)"
```

## Parallel Example: User Story 3 / US5

```bash
# US3 producto y specs:
Task: "T050 EfficiencyTurnDetail.tsx + EfficiencyTurnTable.tsx"
Task: "T051 specs de turno"
Task: "T052 montar tabla en EfficiencyReport"

# US5 producto y specs (después de US3):
Task: "T062 EfficiencyTurnCards.tsx + EfficiencyTurns.tsx"
Task: "T063 specs de tarjetas/selector"
Task: "T066 E2E de paridad responsive"
```

## Parallel Example: User Story 2

```bash
# Motor y presentación en paralelo (ficheros distintos):
Task: "T041 rules.ts"
Task: "T045 EfficiencyFindingCard.tsx + EfficiencyFindings.tsx"

# Specs en paralelo, después de sus productos:
Task: "T042 rules.spec.ts"
Task: "T046 specs de tarjeta/sección"

# Secuencia de integración:
Task: "T043 analyzeSession (rules) → T044 spec"
Task: "T047 EfficiencyReport + barrel → T048 spec"
Task: "T049 E2E de hallazgos/evidencia"
```

## Parallel Example: User Story 4

```bash
# Estados del informe y del overlay (ficheros distintos, en secuencia por dependencia):
Task: "T055 EfficiencyReport (guardas) → T056 spec"
Task: "T057 EfficiencyOverlay (precedencia) → T058 spec"

# E2E de frontera en paralelo, tras T057:
Task: "T059 proyección grafo → sesiones"
Task: "T060 precedencia de estados del overlay"
Task: "T061 totales y referencia"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 (baseline) → Phase 2 Foundational (T002–T023).
2. Phase 3 US1 (T024–T040).
3. **STOP and VALIDATE**: ejecutar el *Independent Test* de US1 y T037–T040; abrir el panel con una
   sesión cerrada real y comprobar nota/banda/cobertura/confianza/factores/foco.
4. Demo del MVP; US2–US5 no son necesarias para la primera entrega.

### Incremental Delivery

1. Foundational + US1 → MVP desplegable.
2. US2 → hallazgos con evidencia; validar T049 y que la nota no cambia.
3. US3 → tabla de turnos; validar T054.
4. US4 → estados de no-puntuación/parcial/error; validar T059–T061.
5. US5 → móvil; validar T066 y la paridad de cifras.
6. Polish → cobertura, rendimiento, accesibilidad/temas y superficie congelada.

### Parallel Team Strategy

- Un equipo completa Setup + Foundational.
- Después: **A** = US2 (rules/findings), **B** = US3 (turnos), **C** = US1 (veredicto/cableado).
  Los tres comparten `EfficiencyReport.tsx`, `Components/index.ts` y `analyzeSession.ts`: un único
  integrador aplica T043/T047/T052 en orden; los demás no tocan esos ficheros.
- US4 y US5 se asignan al integrador y a un segundo desarrollador tras estabilizar US3; los E2E
  T059–T061/T066 se reparten por fichero (sin solapamiento).

---

## Notes

- `[P]` = ficheros distintos y dependencias completas; nunca aplica a la tabla de ficheros
  serializados.
- Cada tarea es producto **o** test, nunca ambos.
- Los E2E de frontera son los dueños de la tabla de la instrucción del run: si una frontera cambia,
  su spec E2E y su caso negativo se actualizan en la misma tarea.
- Verificar que los tests fallen antes de implementar (quickstart §0/§3).
- No hay `data-testid` público nuevo, `localStorage`, exportación, copia ni comparación entre
  sesiones.
- **Resumen**: 68 tareas — Setup 1; Foundational 22; US1 17 (incluye 4 E2E); US2 9 (1 E2E); US3 5
  (1 E2E); US4 7 (3 E2E); US5 5 (1 E2E); Polish 2. E2E de frontera: 10, todas con caso negativo.

## Phase 9: Convergence

- [X] T069 Añadir `truncated?: boolean` a `TEfficiencyInput` y pasarlo desde `useSessionEfficiency` a `analyzeSession` para que `isPartial` (y por tanto `confidence`) sea verdadero con el grafo truncado; actualizar `data-model.md` §1.1/§3/§4.6 y `contracts/efficiency-engine-contract.md` §2/§5.3 (aditivo). Specs: `analyzeSession.spec.ts` (cobertura ≥85, doble muestra, sin `missingSessionIds`, `truncated:true` ⇒ `confidence:'baja'`; `false` ⇒ `'alta'`), `useSessionEfficiency.spec.tsx` y `efficiencyOverlayStates.integration.spec.tsx` (veredicto + banner truncado, confianza baja). Criterio: ningún informe `ok` con grafo truncado declara confianza alta; specs verdes. per R7/R12 + data-model §3/§4.6 (partial)
- [X] T070 En `src/Domains/Efficiency/lib/rules.ts`, elegir la evidencia de RES-2 del reintento con `attempt` máximo (desempate por `at` y `messageId`), no el último de `facts.retries`, para que cita y `turnIndex` coincidan con el `maxAttempt` de la condición; extender `rules.spec.ts` con reintentos `[3,1]` y comprobar `evidence.messageId` del intento 3. Criterio: cita/condición apuntan al mismo reintento y el orden sigue determinista. per engine §6.1/FR-029 (partial)
- [X] T071 Unificar la fuente de copy y umbrales de turnos: mover `OUTCOME_LABEL` y las etiquetas comunes (`open`, `turn`, `prompt`, `clarifications`, `outcome`, `cost`, `time`, `signals`, `expand`, `collapse`, `empty`, no disponibles) a `lib/labels.ts`; usar `PROMPT_TRUNCATE_CODE_POINTS` en `EfficiencyTurnTable`/`EfficiencyTurnCards` y como default de `truncateCodePoints`; mover `QUESTION_REPEAT_SIMILARITY` a `lib/thresholds.ts`. Criterio: una sola definición de `OUTCOME_LABEL`/copy y ningún literal 120/0,7 fuera de `thresholds.ts`; specs de tabla, tarjetas y thresholds verdes. per U18 + T003/T050/T062 (partial)
