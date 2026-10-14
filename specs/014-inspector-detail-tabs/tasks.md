---

description: "Task list for 014-inspector-detail-tabs"
---

# Tasks: Detalle del nodo por secciones (tablist) en el Inspector

**Input**: Design documents from `/specs/014-inspector-detail-tabs/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/inspector-section-tabs-contract.md](./contracts/inspector-section-tabs-contract.md),
[quickstart.md](./quickstart.md), `.specify/memory/constitution.md`

**Tests**: SÍ solicitados — la spec/plan los exige (Principio VIII: specs `specs/` junto al código; el plan
declara «Se amplía el spec del primitivo con fixture anidado y se añaden specs de hook y componente»), las
siete historias tienen *Independent Test* explícito y `quickstart.md` §0 fija el ciclo rojo → verde. Toda
tarea de test crea un fichero nuevo o reescribe el bloque de un spec existente listado en el plan.

**Organization**: por historia de usuario (US1/US2/US3 P1 = el reorden que pide la petición; US4/US5/US6 P2
= teclado, ancho y estados; US7 P3 = contraste forzado).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable — fichero propio sin conflicto de escritura con otra tarea; se lanza en el mismo lote
  una vez satisfechos sus prerrequisitos (los specs de sección y los nueve E2E de frontera dependen de la
  implementación de las unidades que cruzan, y solo entonces entran en el lote).
- **[Story]**: US1…US7 en las fases de historia. Setup, Foundational y Polish no llevan etiqueta.
- Cada descripción lleva las rutas exactas de los ficheros que escribe (`writes:`) y lo que debe quedar
  cierto; no hay tareas vagas ni pasos implícitos.

## Instrucción adicional del run ($ARGUMENTS) — integración E2E de fronteras

> «por cada cadena de estado de `contracts/` que cruce dos unidades, añade una tarea de integración de
> extremo a extremo con su spec, incluido el caso negativo (dato inexistente / 404); ninguna frontera entre
> unidades queda sin dueño».

**Unidades de esta feature**: **U1** = `src/Application/Components/ui/tabs.tsx` (primitivo compartido
`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`); **U2** = `src/Domains/Inspector/Hooks/`
(`useInspectorSectionTabs`, más `useInspectorData`/`useContextMetrics` como fuentes de estado); **U3** =
`src/Domains/Inspector/Components/InspectorSectionTabs.tsx` (tablist interno); **U4** =
`src/Domains/Inspector/Components/` (`InspectorPanel` orquestador + las siete secciones); **U5** =
`src/Infrastructure/Components/InspectorPane.tsx` (tablist externo `Detalle | Chat` + cabecera); **U6** =
`src/Domains/Inspector/*.service.ts` (`useSessionMessages`, `useSessionDiff`, `useSessionForms`,
`useSessionPermissions`, `useSessionInbox`, `useSessionContext`).

Toda cadena de estado de `contracts/inspector-section-tabs-contract.md` que cruza dos unidades tiene **un
dueño E2E** con caso negativo (dato inexistente / 404). La columna «Dueño E2E» apunta a la tarea cuyo
`writes:` crea el spec de integración correspondiente. Ninguna frontera queda sin dueño:

| Frontera | Cadena de estado (contracts) | Dueño E2E | Caso negativo |
|---|---|---|---|
| U2 ↔ U3 | §3/§4 — `useInspectorSectionTabs` (`tab`/`setTab`/`tabs`) → pestaña activa del tablist interno | T009 | `setTab` con id inexistente ⇒ sigue `subagents` y una sola pestaña activa |
| U4 ↔ U3 | §4 — límite de montaje: inicial `subagents`, se mantiene al cambiar de nodo, se reinicia al cerrar/reabrir | T011 | `node = null` ⇒ tablist desmontado (prompt), 0 `role=tablist` |
| U4 ↔ U3 | §1/§3 — `Record<TInspectorSectionTab, ReactNode>` y props literales de las siete secciones | T014 | nodo inexistente/`null` ⇒ ninguna sección y ningún tablist, sin errores |
| U1 ↔ U3 | §6/§5 — alto automático + envoltura del primitivo → tablist interno con 7 paneles | T022 | paneles inactivos `hidden` **sin hijos**: 0 secciones duplicadas |
| U1 ↔ U5 | §6/§7 — corrección del primitivo → tablist externo `Detalle \| Chat` sin regresión | T034 | lista de 2 sin restricción de ancho: no envuelve ni cambia de alto |
| U5 ↔ U4/U3 | §1/§2 — anidamiento de dos tablists con `aria-label` propios | T019 | sin nodo seleccionado ⇒ solo existe el tablist externo |
| U6 ↔ U2 ↔ U4 | §5 — `useSessionMessages` (`isLoading`/`isError`) → `useInspectorData` → Subagentes, Herramientas, Respuestas y Errores | T030 | `getSessionMessages` rechaza (sesión inexistente / 404) ⇒ error, **nunca** vacío |
| U6 ↔ U4 | §5 — `useSessionDiff` → Archivos; `useSessionForms` + `useSessionPermissions` + `useSessionInbox` → Preguntas y permisos | T031 | diff/forms/permisos/inbox en 404 ⇒ error, **nunca** vacío |
| U6 ↔ U2 ↔ U4 | §5 — `useContextMetrics` (contexto/latencia) → Latencia completa (FR-009) | T015 | contexto inexistente (404) ⇒ `EmptyScreenError` en Latencia con la pestaña montada (**nunca** vacío) |

Los nueve specs viven en `src/Infrastructure/specs/integration/` (misma convención de suites E2E de frontera
de unidades que `012-refactor-workspace-enrichment`) y reutilizan el arnés
`src/Infrastructure/specs/integration/harness.tsx` **sin modificarlo** (`seedSessions`, `seedSubtree`,
`seedMessages`, `seedPermissions`, `seedForms`, `seedQueryData`, `serviceMock`/`resetServiceMock`,
`renderWorkspace`). Los E2E que montan el panel real **no** aplican `mockInspectorBarrel` (el panel real es
el sujeto); sí reutilizan `mockGraphBarrel`/`mockSessionsBarrel`/`mockChatBarrel`/`mockHistoryBarrel` y
siembran `sessions.list/roots/status`, `graph.for(directory, sessionId)`, `sessions.messages(id)` y las
claves del `queryKeys` que necesite su frontera (`seedQueryData` para `diff`/`inbox`/`context`).

> **Desviación documentada respecto a `plan.md`**: el plan no listaba specs en
> `src/Infrastructure/specs/integration/`; los nueve ficheros de la tabla anterior son una adición exigida
> por la instrucción del run. No contradicen el plan (no tocan su superficie) y quedan registrados aquí.

## Ficheros intocables (superficie congelada — contract §7)

| Fichero / zona | Motivo |
|---|---|
| `src/Domains/queryKeys.ts` | sin claves nuevas ni renombradas (FR: Constraints del plan) |
| `src/Domains/Inspector/Inspector.service.ts` (API pública) | sin consultas nuevas; solo se consumen sus hooks |
| `src/Domains/Inspector/Inspector.entity.ts`, `Graph.entity.ts` | tipos del SDK/dominio intactos (Principio IV) |
| `src/Infrastructure/Routes.tsx`, `*.routes.ts` | sin rutas nuevas |
| `src/Infrastructure/Components/InspectorPane.tsx` | `Detalle \| Chat` no cambia (FR-011): solo se **consumen** sus specs |
| `src/Domains/Inspector/Components/AdvancedSection.tsx` | se **elimina** (T012), nunca se edita |
| `.specify/**`, `.opencode/commands/speckit.*.md` | fuera del alcance de la feature |

---

## Phase 1: Setup (línea base de no regresión)

**Purpose**: fijar el verde de partida y acotar la superficie del primitivo compartido antes de tocarlo
(SC-004 «cero regresiones»). Sin esta fase no hay contra qué comparar.

- [X] T001 (writes: `specs/014-inspector-detail-tabs/baseline.md`) Ejecutar la línea base de pruebas y registrarla: `pnpm test` (suite completa) y, por separado,
  `pnpm test -- src/Domains/Inspector`, `pnpm test -- tabs.a11y`, `pnpm test -- InspectorPane.spec`,
  `pnpm test -- WorkspaceLayout.spec`, `pnpm test -- WorkspaceMobileTabs.spec`; crear
  `specs/014-inspector-detail-tabs/baseline.md` con la tabla (suite, fichero, nº de tests, duración,
  verde/rojo), el total y el `git rev-parse HEAD` de partida.
- [X] T002 (writes: `specs/014-inspector-detail-tabs/baseline.md`) Fijar la línea base de compuertas y acotar el primitivo, anexándolo a `baseline.md`: · depende de T001
  `pnpm tsc`, `pnpm tsc:node`, `pnpm lint` (0 errores, 0 warnings) y la comprobación de consumidores de
  `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (`rg "TabsList" src` ⇒ solo `InspectorPane.tsx` y los
  specs del primitivo hoy), más el recordatorio de que `min-h-control` se genera con el `@theme` de
  `src/index.css` (research R3). Depende de T001 (mismo fichero).

**Checkpoint**: baseline verde y firmada; recién ahora se puede tocar código.

---

## Phase 2: Foundational (prerrequisitos bloqueantes de todas las historias)

**Purpose**: la definición única del tablist de secciones (ids, orden, etiquetas, guarda, estado efímero)
de la que dependen US1–US7 y los nueve dueños E2E. Sin el hook no existe ninguna pestaña que renderizar ni
que probar.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta completar esta fase.

- [X] T003 [P] (writes: `src/Domains/Inspector/Hooks/useInspectorSectionTabs.ts`) Crear el hook puro `src/Domains/Inspector/Hooks/useInspectorSectionTabs.ts` espejo de
  `useDetailTabs`: `INSPECTOR_SECTION_TABS = ['subagents','files','tools','answers','questions','errors','latency'] as const`
  (orden exacto de FR-001), `INSPECTOR_SECTION_TAB_ID = 'subagents'` (FR-003),
  `TInspectorSectionTab`/`TInspectorSectionTabItem`, `INSPECTOR_SECTION_TAB_ITEMS` con las siete etiquetas
  literales (Subagentes, Archivos, Herramientas, Respuestas, Preguntas y permisos, Errores, Latencia; FR-005
  sin renombrar), `INSPECTOR_SECTION_TABS_ARIA_LABEL = 'Secciones técnicas del nodo'` (FR-013),
  `INSPECTOR_SECTION_TABS_LIST_CLASSNAME = 'w-full justify-start gap-1'`, la guarda
  `isInspectorSectionTab` y `useInspectorSectionTabs(initialTab = INSPECTOR_SECTION_TAB_ID)` con `useState`
  efímero y `setTab` que **ignora** ids inválidos. Sin persistencia, sin efectos, sin datos del dominio.
- [X] T004 [P] (writes: `src/Domains/Inspector/Hooks/specs/useInspectorSectionTabs.spec.tsx`) Crear el spec `src/Domains/Inspector/Hooks/specs/useInspectorSectionTabs.spec.tsx`: siete
  items con su orden exacto de etiquetas, `tab === 'subagents'` por defecto y con `initialTab` explícito,
  `setTab` cambia y **ignora** un id inválido (guarda), `tabs` referencialmente estable entre renders y
  `INSPECTOR_SECTION_TABS_ARIA_LABEL` distinto del externo (`'Vistas del panel de detalle'`). Debe fallar
  antes de T003 (quickstart §0).
- [X] T005 (writes: `src/Domains/Inspector/Hooks/index.ts`) Exportar el hook y sus constantes desde `src/Domains/Inspector/Hooks/index.ts` · depende de T003
  (`export * from './useInspectorSectionTabs'`), sin reordenar ni tocar los exports existentes. Depende de
  T003.

**Checkpoint**: definición del tablist lista; US1–US7 y los nueve E2E arrancan sobre una sola fuente de ids.

---

## Phase 3: User Story 1 - Abrir cada sección técnica por separado (Priority: P1) 🎯 MVP

**Goal**: el detalle termina con un tablist de siete pestañas nombradas y, al elegir una, solo esa sección
queda visible (FR-001, FR-002, FR-005, FR-013).

**Independent Test**: `pnpm test -- InspectorSectionTabs.spec` y `-- useInspectorSectionTabs.spec` verdes:
montado el componente con secciones stub, hay siete `tab`s con las etiquetas exactas, exactamente una
`aria-selected`, un solo `tabpanel` con hijos y seis `hidden` sin hijos; no queda `aria-expanded` ni
`role="region"`.

### Implementación de US1

- [X] T006 [US1] (writes: `src/Domains/Inspector/Components/InspectorSectionTabs.tsx`) Crear `src/Domains/Inspector/Components/InspectorSectionTabs.tsx`: componente de · depende de T003
  **presentación pura** con `sections: Record<TInspectorSectionTab, ReactNode>` (exhaustivo por tipo);
  consume el hook (T003) y rinde `Tabs`/`TabsList` (con `aria-label={INSPECTOR_SECTION_TABS_ARIA_LABEL}` y
  `className={INSPECTOR_SECTION_TABS_LIST_CLASSNAME}`) / siete `TabsTrigger` (solo etiqueta, sin badges) /
  siete `TabsContent` con `className="min-w-0 cursor-default mt-3"` y **sin** utilidades de `display`
  (contract §2/§3); `data-testid="inspector-section-tabs"` en la lista y `data-testid="inspector-section-panel"`
  en cada panel; prohibido `id`/ARIA manuales (Radix los genera) y prohibido `role="region"`. Depende de T003.
- [X] T007 [US1] (writes: `src/Domains/Inspector/Components/specs/InspectorSectionTabs.spec.tsx`) Crear `src/Domains/Inspector/Components/specs/InspectorSectionTabs.spec.tsx` con secciones · depende de T006
  stub identificables: siete pestañas en orden y con sus etiquetas, un único `tabpanel` con hijos y seis
  `getAllByRole('tabpanel', { hidden: true })` `hidden` **sin hijos**, `aria-controls`/`aria-labelledby`
  ligados, `aria-label` propio y distinto del externo, `data-testid`, ausencia de badges/counters, guardia de
  que ningún `className` de `TabsContent` lleva `block`/`flex`/`grid`, y ausencia de `aria-expanded`. Usa
  `setupRadixUser()` (`src/test/radix.ts`) para el puntero sobre Radix. Depende de T006.
- [X] T008 [US1] (writes: `src/Domains/Inspector/Components/index.ts`) Exportar `InspectorSectionTabs` desde · depende de T006
  `src/Domains/Inspector/Components/index.ts` (+`export * from './InspectorSectionTabs'`) sin tocar el resto
  de exports. Depende de T006.
- [X] T009 [P] [US1] (writes: `src/Infrastructure/specs/integration/inspectorSectionTabState.integration.spec.tsx`) E2E frontera **U2↔U3** (contract §3/§4) — cadena `useInspectorSectionTabs` →
  pestaña activa: crear `src/Infrastructure/specs/integration/inspectorSectionTabState.integration.spec.tsx`
  montando el **componente real** (`InspectorSectionTabs` de `@app/Domains/Inspector`) con el hook real y
  secciones stub dentro de `renderWithProviders` + `createIntegrationQueryClient` del arnés; comprobar que
  clic y ←/→/Inicio/Fin cambian la sección montada (un solo panel con hijos). **Caso negativo (dato
  inexistente)**: un disparo con id fuera de la unión (`setTab`/`onValueChange` inválido) deja la pestaña
  activa en `subagents`, sigue habiendo exactamente una `aria-selected="true"` y ningún panel huérfano ni
  vacío de contenido.

**Checkpoint**: US1 verificable por sí sola: siete secciones, una visible, sin desplegable.

---

## Phase 4: User Story 2 - Llegar al contenido técnico sin un paso previo (Priority: P1)

**Goal**: el detalle monta el tablist al final del scroll y la sección activa inicial es Subagentes,
efímera: se mantiene al cambiar de nodo y vuelve a Subagentes al cerrar y reabrir (FR-003).

**Independent Test**: `pnpm test -- inspectorSectionTabLifecycle.integration` verde: con nodo, la pestaña
activa es Subagentes y su contenido está montado sin ninguna acción; cambiar de nodo la conserva y
`node = null` la reinicia.

### Implementación de US2

- [X] T010 [US2] (writes: `src/Domains/Inspector/Components/InspectorPanel.tsx`) Reescribir `src/Domains/Inspector/Components/InspectorPanel.tsx`: construir el · depende de T006, T008
  `Record<TInspectorSectionTab, ReactNode>` con las siete secciones y montar
  `<InspectorSectionTabs sections={…} />` como **último** bloque del `Container` (`overflow-auto p-4`), sin
  `sticky` ni `key` ni efectos de reset (research R1); mover las props **literalmente**
  (`FileChanges` con `diff.changes/isError/isLoading`; `ToolHistory tools`; `AnswersSection
  entries/showReasoning/onToggleReasoning/onOpenHistory/sessionId/renderCompactionContext`;
  `QuestionsSection permissions/questions/queuedTurns/isError/isLoading`; `ErrorsSection errors`;
  `SubagentsSection tasks/parallelPeers`; `LatencySection latency/threshold/onThresholdChange/isError/isLoading`)
  y actualizar los comentarios del archivo para que describan el tablist (el desplegable deja de citarse).
  Depende de T006 y T008.
- [X] T011 [P] [US2] (writes: `src/Infrastructure/specs/integration/inspectorSectionTabLifecycle.integration.spec.tsx`) E2E frontera **U4↔U3** (contract §4 / data-model §2) — límite de montaje: crear · depende de T010
  `src/Infrastructure/specs/integration/inspectorSectionTabLifecycle.integration.spec.tsx` montando el
  `InspectorPanel` real dentro de `renderWithProviders` + `createIntegrationQueryClient` con el SDK mockeado
  (arnés: `serviceMock`/`resetServiceMock`) y caché sembrada (`sessions.messages(id)`); comprobar el camino
  feliz: nodo recién abierto ⇒ `Subagentes` activa con su contenido visible sin acción previa, cambiar de
  nodo A→B conserva la pestaña elegida y el re-render no la resetea. **Caso negativo (dato inexistente)**:
  `node = null` ⇒ `InspectorEmptyPrompt`, cero `role="tablist"` en el documento; y la reapertura del detalle
  vuelve a `subagents` (sin persistencia). Depende de T010.

**Checkpoint**: US1 y US2 juntas: sección inicial correcta, efímera y resistente al cambio de nodo.

---

## Phase 5: User Story 3 - El resumen del nodo sigue leyéndose como una secuencia continua (Priority: P1)

**Goal**: Identidad → Modelo → Métricas → Contexto (Paralelismo + Aporte al padre) → Recursos → Duración
mediana por herramienta como recorrido continuo sin pestañas, sin duplicados y sin el desplegable
"Avanzado" (FR-004, FR-009, FR-010).

**Independent Test**: `pnpm test -- InspectorPanel.spec` y `-- LatencySection.spec` verdes: el orden del
resumen no cambia, ninguna sección aparece dos veces ni dentro del área de pestañas, Latencia conserva
umbral/control/anomalías y `rg AdvancedSection src` no devuelve código de producto.

### Implementación de US3

- [X] T012 [US3] (writes: `src/Domains/Inspector/Components/AdvancedSection.tsx`, `src/Domains/Inspector/Components/specs/AdvancedSection.spec.tsx`, `src/Domains/Inspector/Components/index.ts` — los dos primeros se borran) Eliminar `AdvancedSection` y su export: borrar · depende de T010
  `src/Domains/Inspector/Components/AdvancedSection.tsx` y
  `src/Domains/Inspector/Components/specs/AdvancedSection.spec.tsx`, y quitar
  `export * from './AdvancedSection'` de `src/Domains/Inspector/Components/index.ts` (mismo fichero que T008:
  depende de él). `Disclosure` **no** se elimina (lo usa `ToolHistory`). Depende de T010.
- [X] T013 [US3] (writes: `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx`) Reescribir el bloque del desplegable "Avanzado" de · depende de T010, T012
  `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx` (líneas ~206-420): sustituir
  `aria-expanded`/`role="region"` y la expansión por consultas `getByRole('tab', { name })` /
  `getByRole('tabpanel')` / `data-testid`, verificar el orden del resumen (Identidad → Modelo → Métricas →
  Contexto → Recursos → ToolStats) seguido del tablist, que **Contexto permanece**, que ninguna sección
  aparece dos veces y que cada sección recibe sus props literalmente con stubs (`renderCompactionContext`
  invocado; `threshold`/`onThresholdChange` conectados al store del umbral; `sessionId` =
  `node.data.sessionId`). Depende de T010 y T012.
- [X] T014 [P] [US3] (writes: `src/Infrastructure/specs/integration/inspectorSectionsRecordWiring.integration.spec.tsx`) E2E frontera **U4↔U3** (contract §1/§3) — `Record` y props literales: crear · depende de T010, T012
  `src/Infrastructure/specs/integration/inspectorSectionsRecordWiring.integration.spec.tsx` montando el
  `InspectorPanel` real con caché sembrada; comprobar las siete entradas del mapa montadas por turno (una
  sola a la vez), que el `Record` es exhaustivo (las siete secciones existen al recorrer las pestañas) y que
  las props llegan literales. **Caso negativo (dato inexistente)**: `node = null` ⇒ ninguna sección y ningún
  tablist (0 `role="tablist"`), sin errores de render ni secciones huérfanas. Depende de T010 y T012.
- [X] T015 [P] [US3] (writes: `src/Infrastructure/specs/integration/inspectorLatencyChain.integration.spec.tsx`) E2E frontera **U6↔U2↔U4** (contract §5, FR-009) — contexto/latencia → Latencia: · depende de T010
  crear `src/Infrastructure/specs/integration/inspectorLatencyChain.integration.spec.tsx` montando el
  `InspectorPanel` real con `sessions.context(id)` sembrado por `seedQueryData`; camino feliz: la pestaña
  Latencia muestra la referencia de umbral, el control del umbral y el listado de respuestas medidas con sus
  anomalías, y las anomalías **no** filtran ni deshabilitan la sección. **Caso negativo (dato inexistente /
  404)**: `serviceMock.getSessionContext` rechaza ⇒ el panel de Latencia resuelve **error** mostrando
  `EmptyScreenError` (**nunca** vacío ni datos falsos) y la **pestaña permanece montada** (el tablist de 7
  sigue operativo y Latencia sigue siendo seleccionable). Con error **no** se exige que la referencia y el
  control de umbral sigan montados: el §5 del contrato manda error → `EmptyScreenError` en los siete paneles
  (el error sustituye todo el contenido de la sección). Depende de T010.
- [X] T016 [P] [US3] (writes: `specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md`, `specs/010-context-metrics-insights/contracts/context-panel-contract.md`, `src/Application/Components/Molecules/Disclosure.tsx`) Limpieza documental acotada de FR-010 (y solo esa): actualizar
  `specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md` (§1 ítem 7, §2.1-2.3, §3.1
  `AdvancedSection` y §5:157) y `specs/010-context-metrics-insights/contracts/context-panel-contract.md:58`
  para que dejen de describir el desplegable "Avanzado" y remitan al contrato nuevo
  (`specs/014-inspector-detail-tabs/contracts/inspector-section-tabs-contract.md`); además, los comentarios
  que citan "Avanzado" en `src/Application/Components/Molecules/Disclosure.tsx`. **No** reescribir el resto
  de documentos de `specs/004`/`specs/010` (histórico). Debe aterrizar en el mismo cambio que T010/T012.

**Checkpoint**: el resumen queda continuo y sin duplicados; el desplegable ya no existe en código ni en
contratos vigentes.

---

## Phase 6: User Story 4 - Recorrer y elegir sección con el teclado (Priority: P2)

**Goal**: foco visible y navegación con ←/→ e Inicio/Fin en el tablist, sin depender de `box-shadow`
(FR-007, FR-013).

**Independent Test**: `pnpm test -- tabs.a11y` verde con el fixture anidado de siete pestañas: `Inicio`/`Fin`
saltan a primera/última, ←/→ mueven y activan, el foco se marca con `outline` y sobrevive en
`forced-colors`.

### Implementación de US4

- [X] T017 [US4] (writes: `src/Application/Components/ui/tabs.tsx`) Corregir el foco del primitivo compartido en `src/Application/Components/ui/tabs.tsx`:
  en `TabsTrigger` y `TabsContent` quitar `focus-visible:outline-none` y el foco por
  `ring`/`ring-offset` (`box-shadow`, invisible en contraste forzado) y aplicar el patrón del proyecto
  (`src/Application/Components/ui/input.tsx:14`): `focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-ring forced-colors:focus-visible:outline-[Highlight]`. No cambiar tokens de color ni
  el resto de clases.
- [X] T018 [US4] (writes: `src/Application/Components/ui/specs/tabs.a11y.spec.tsx`) Ampliar `src/Application/Components/ui/specs/tabs.a11y.spec.tsx`: añadir el **fixture
  anidado** (dos tablists con `aria-label` distintos e ids únicos, el externo con dos pestañas y el interno
  con siete) y los casos de `Inicio`/`Fin` sobre siete pestañas, guardia de foco (los triggers y el panel
  activo llevan `outline-2`/`outline-ring` y `forced-colors:outline-[Highlight]`, sin
  `focus-visible:outline-none` ni `ring-*`) y roving tabindex con siete pestañas. Conservar los cinco casos
  APG existentes.
- [X] T019 [P] [US4] (writes: `src/Infrastructure/specs/integration/inspectorNestedTablists.integration.spec.tsx`) E2E frontera **U5↔U4/U3** (contract §1/§2, FR-013) — anidamiento de tablists: crear · depende de T010
  `src/Infrastructure/specs/integration/inspectorNestedTablists.integration.spec.tsx` montando
  `WorkspacePage` con `renderWorkspace` + arnés (graph/sessions/chat/history mockeados, **panel real**),
  sembrando `sessions.list/roots/status` + `graph.for(directory, sessionId)` con al menos un nodo +
  `sessions.messages(id)` y seleccionando el nodo con el botón «Seleccionar nodo» del marcador `agent-graph`;
  comprobar dos `role="tablist"` con `aria-label` propios y distintos (`Vistas del panel de detalle` /
  `Secciones técnicas del nodo`), ids únicos entre ambos y que el interno navega con ←/→ sin mover el
  externo. **Caso negativo (dato inexistente)**: sin nodo seleccionado sólo existe el tablist externo (1) y
  el detalle muestra el prompt; ninguna consulta global por rol queda ambigua. Depende de T010.

**Checkpoint**: la lista se recorre entera con teclado y el patrón anidado no se rompe.

---

## Phase 7: User Story 5 - Leer todas las pestañas en cualquier ancho del panel (Priority: P2)

**Goal**: la lista envuelve en filas, no recorta etiquetas ni exige scroll horizontal, y conserva el alto del
tablist externo (FR-006).

**Independent Test**: `pnpm test -- tabs.a11y` y `-- inspectorSectionTabsPrimitive.integration` verdes: la
lista lleva `min-h-control` + `flex-wrap` (sin `h-control`), los triggers `whitespace-nowrap` y ninguna
etiqueta se trunca.

### Implementación de US5

- [X] T020 [US5] (writes: `src/Application/Components/ui/tabs.tsx`) Corregir el alto y la envoltura en `src/Application/Components/ui/tabs.tsx`: en `TabsList`
  pasar de `inline-flex h-control` a `inline-flex min-h-control flex-wrap` (conservando
  `items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground`), de modo que una lista en una
  sola fila mantenga el alto de control al píxel y una lista restringida envuelva; **no** duplicar el override
  de alto desde el call site (research R3, Principio VIII).
- [X] T021 [US5] (writes: `src/Application/Components/ui/specs/tabs.a11y.spec.tsx`) Añadir a `src/Application/Components/ui/specs/tabs.a11y.spec.tsx` las guardias de clase del
  contrato §6: `flex-wrap` y `min-h-control` en la lista, ausencia de `h-control`, `whitespace-nowrap` en los
  triggers, y la prohibición de utilidades de `display` en el `className` de un `TabsContent` (la que anularía
  `[hidden]` y expondría los siete paneles).
- [X] T022 [P] [US5] (writes: `src/Infrastructure/specs/integration/inspectorSectionTabsPrimitive.integration.spec.tsx`) E2E frontera **U1↔U3** (contract §6/§5) — primitivo → tablist interno: crear · depende de T010, T012, T020
  `src/Infrastructure/specs/integration/inspectorSectionTabsPrimitive.integration.spec.tsx` montando el
  `InspectorPanel` real (caché sembrada, SDK mockeado) con el panel en anchos mínimo y máximo simulados;
  comprobar que la lista de secciones lleva `flex-wrap`/`min-h-control`, las siete etiquetas completas
  (`whitespace-nowrap`, sin truncado), un solo `tabpanel` con hijos y seis `hidden` **sin hijos**. **Caso
  negativo (dato inexistente)**: ningún panel inactivo tiene hijos montados y ninguna sección aparece dos
  veces entre el resumen y las pestañas (0 duplicados, SC-002/SC-003). Depende de T010, T012 y T020.

**Checkpoint**: ninguna etiqueta se corta en ningún ancho y el tablist externo conserva su alto.

---

## Phase 8: User Story 6 - No confundir "sin datos" con "cargando" (Priority: P2)

**Goal**: Subagentes, Herramientas, Respuestas y Errores resuelven error → carga → vacío → datos con
`isLoading`/`isError` de `useInspectorData`, sin falsos vacíos (FR-008, SC-005, Principio VI).

**Independent Test**: `pnpm test -- SubagentsSection.spec -- ToolHistory.spec -- AnswersSection.spec --
ErrorsSection.spec` verdes: con `isError` se ve error (nunca vacío), con `isLoading` se ve carga (nunca
vacío) y el vacío legítimo sigue tras resolverse la fuente.

### Implementación de US6

- [X] T023 [P] [US6] (writes: `src/Domains/Inspector/Components/SubagentsSection.tsx`) Añadir `isLoading?: boolean` / `isError?: boolean` (por defecto `false`) a
  `src/Domains/Inspector/Components/SubagentsSection.tsx` y pasarlos a `SectionFrame` (prioridad
  error → carga → vacío → datos), conservando el encabezado "Subagentes", el `isEmpty` actual y
  `parallelPeers`.
- [X] T024 [P] [US6] (writes: `src/Domains/Inspector/Components/ToolHistory.tsx`) Añadir `isLoading`/`isError` a `src/Domains/Inspector/Components/ToolHistory.tsx` y
  pasarlos a `SectionFrame`, conservando encabezado, `useToolHistory`, el control "Ver N más" y el estado
  vacío "Sin actividad de herramientas todavía.".
- [X] T025 [P] [US6] (writes: `src/Domains/Inspector/Components/AnswersSection.tsx`) Añadir `isLoading`/`isError` a `src/Domains/Inspector/Components/AnswersSection.tsx` y
  resolver el área de lista de forma explícita reutilizando los nodos por defecto (`EmptyScreenError`,
  `ListSkeleton`), manteniendo el `isEmpty` no excluyente ("Sin respuestas todavía" puede convivir con
  entradas solo-herramientas) y dejando **montados** en los cuatro estados la cabecera con el toggle de
  razonamiento y el botón "Ver histórico completo" (research R7).
- [X] T026 [P] [US6] (writes: `src/Domains/Inspector/Components/ErrorsSection.tsx`) Añadir `isLoading`/`isError` a `src/Domains/Inspector/Components/ErrorsSection.tsx` y
  pasarlos a `SectionFrame`, conservando el encabezado "Errores" y el vacío "Sin errores.".
- [X] T027 [P] [US6] (writes: `src/Domains/Inspector/Components/specs/SubagentsSection.spec.tsx`, `src/Domains/Inspector/Components/specs/ToolHistory.spec.tsx`) Ajustar los specs `src/Domains/Inspector/Components/specs/SubagentsSection.spec.tsx` y · depende de T023, T024
  `src/Domains/Inspector/Components/specs/ToolHistory.spec.tsx`: `isError` ⇒ error y **no** vacío; `isLoading`
  ⇒ carga (skeleton) y **no** vacío; vacío legítimo tras resolverse la fuente; los casos existentes sin las
  props nuevas siguen intactos. Depende de T023/T024 (el spec del primitivo no se toca aquí).
- [X] T028 [P] [US6] (writes: `src/Domains/Inspector/Components/specs/AnswersSection.spec.tsx`, `src/Domains/Inspector/Components/specs/ErrorsSection.spec.tsx`) Ajustar los specs `src/Domains/Inspector/Components/specs/AnswersSection.spec.tsx` y · depende de T025, T026
  `src/Domains/Inspector/Components/specs/ErrorsSection.spec.tsx`: mismos tres estados, y en
  `AnswersSection` además que el toggle de razonamiento y "Ver histórico completo" siguen montados y
  operativos durante carga y error. Depende de T025/T026.
- [X] T029 [US6] (writes: `src/Domains/Inspector/Components/InspectorPanel.tsx`) Pasar `isLoading`/`isError` de `useInspectorData` a las cuatro secciones en el `Record` de · depende de T010, T023, T024, T025, T026
  `src/Domains/Inspector/Components/InspectorPanel.tsx` (`SubagentsSection`, `ToolHistory`, `AnswersSection`,
  `ErrorsSection`), y solo a ellas: Archivos, Preguntas y permisos y Latencia conservan sus fuentes actuales.
  Depende de T010 y T023–T026 (mismo fichero que T010: requiere su reescritura).
- [X] T030 [P] [US6] (writes: `src/Infrastructure/specs/integration/inspectorSectionsMessagesStates.integration.spec.tsx`) E2E frontera **U6↔U2↔U4** (contract §5, FR-008/SC-005) — mensajes → cuatro secciones: · depende de T029
  crear `src/Infrastructure/specs/integration/inspectorSectionsMessagesStates.integration.spec.tsx` montando
  el `InspectorPanel` real con el SDK mockeado y `sessions.messages(id)` pendiente/ sembrado; camino feliz:
  `isLoading` visible en Subagentes, Herramientas, Respuestas y Errores y, con datos, sus listados.
  **Caso negativo (dato inexistente / 404)**: `serviceMock.getSessionMessages` rechaza (sesión inexistente) ⇒
  las cuatro muestran error y **nunca** el texto de vacío; y tras resolver sin mensajes ⇒ vacío legítimo
  (nunca antes de resolver). Depende de T029.
- [X] T031 [P] [US6] (writes: `src/Infrastructure/specs/integration/inspectorSectionsServiceStates.integration.spec.tsx`) E2E frontera **U6↔U4** (contract §5) — diff/forms/permisos/inbox → Archivos y Preguntas · depende de T010
  y permisos: crear `src/Infrastructure/specs/integration/inspectorSectionsServiceStates.integration.spec.tsx`
  montando el `InspectorPanel` real con `sessions.diff` e `sessions.questions` + `permissions.for` +
  `sessions.inbox` sembrados (`seedQueryData`/`seedPermissions`/`seedForms`); camino feliz: Archivos muestra
  los cambios y Preguntas y permisos las tres fuentes. **Caso negativo (dato inexistente / 404)**:
  `serviceMock.getSessionDiff` y `listSessionForms` rechazan ⇒ error visible en ambas secciones y nunca
  vacío, sin romper el resto del panel. Depende de T010.

**Checkpoint**: ningún panel afirma "sin datos" mientras su fuente carga o falla; las cuatro secciones
coinciden con el resto del panel.

---

## Phase 9: User Story 7 - Mantener activo y foco distinguibles en alto contraste (Priority: P3)

**Goal**: la pestaña activa tiene un indicador con separación ≥3:1 perceptible en `forced-colors` y el foco
sigue distinguiéndose, sin tocar tokens de color (FR-007).

**Independent Test**: `pnpm test -- tabs.a11y` y `-- detailChatTablistRegression.integration` verdes: el
trigger activo lleva el indicador de borde (no `box-shadow`), el foco se marca con `outline` y
`forced-colors:outline-[Highlight]`, y `Detalle | Chat` no cambia de aspecto ni de comportamiento.

### Implementación de US7

- [X] T032 [US7] (writes: `src/Application/Components/ui/tabs.tsx`) Añadir el indicador de estado activo en `src/Application/Components/ui/tabs.tsx`:
  `border border-transparent` en la base del `TabsTrigger` y `data-[state=active]:border-foreground` junto a
  la píldora existente (`data-[state=active]:bg-background data-[state=active]:text-foreground
  data-[state=active]:shadow` se conservan); **prohibido** `ring`/`box-shadow` como único indicador y
  prohibido tocar tokens de color compartidos.
- [X] T033 [US7] (writes: `src/Application/Components/ui/specs/tabs.a11y.spec.tsx`) Añadir a `src/Application/Components/ui/specs/tabs.a11y.spec.tsx` la guardia del indicador
  activo (clase de contraste en `data-[state=active]`, `border` presente en activo e inactivo para no
  provocar salto de layout) y la del respaldo `forced-colors:outline-[Highlight]` en el foco.
- [X] T034 [P] [US7] (writes: `src/Infrastructure/specs/integration/detailChatTablistRegression.integration.spec.tsx`) E2E frontera **U1↔U5** (contract §6/§7/§8, FR-011/SC-004) — regresión del tablist · depende de T032
  externo: crear `src/Infrastructure/specs/integration/detailChatTablistRegression.integration.spec.tsx`
  montando `WorkspacePage` con `renderWorkspace` (arnés) y siembra mínima; comprobar que `Detalle | Chat`
  conserva etiqueta, orden, `aria-label="Vistas del panel de detalle"`, roving tabindex y
  `ChatAttentionBadge` cuando hay pendientes. **Caso negativo (dato inexistente)**: con dos pestañas y sin
  restricción de ancho la lista no envuelve ni cambia de alto (sigue el alto de control), y sin
  `onToggleFullscreen` el control de pantalla completa no se monta; ninguna pestaña pierde su etiqueta.
  Depende de T032.

**Checkpoint**: activo y foco se distinguen en todos los entornos y el tablist externo queda intacto.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: cerrar la validación de la feature con evidencia comparable contra la línea base, auditar la
superficie congelada y registrar lo que no es automatizable.

- [X] T035 (writes: `specs/014-inspector-detail-tabs/verification.md`) Correr [quickstart.md](./quickstart.md) §0–§6 completa (incluidos los `pnpm test -- <spec>` de
  §1–§5) y registrar en `specs/014-inspector-detail-tabs/verification.md` la tabla de escenarios con el
  veredicto de SC-001…SC-006 y la comparación de conteos/duración contra `baseline.md`.
- [X] T036 (writes: `specs/014-inspector-detail-tabs/verification.md`) Ejecutar las compuertas completas `pnpm tsc && pnpm tsc:node && pnpm lint && pnpm test` y anexar · depende de T035
  a `verification.md` el resultado (0 errores, 0 warnings nuevos, total de tests y duración frente a
  T001/T002). Depende de T035 (mismo fichero).
- [X] T037 (writes: `specs/014-inspector-detail-tabs/verification.md`) Auditar la superficie congelada del contract §7 y anexar el checklist a `verification.md`: · depende de T036
  `rg AdvancedSection src` sin resultados de producto, `git diff` vacío en `src/Domains/queryKeys.ts`,
  `Inspector.service.ts`, `Inspector.entity.ts`, `src/Infrastructure/Routes.tsx` y
  `InspectorPane.tsx`, y confirmación de que `Disclosure` sigue exportado y usado por `ToolHistory`.
  Depende de T036 (mismo fichero).
- [X] T038 (writes: `specs/014-inspector-detail-tabs/verification.md`) Registrar en `verification.md` los dos hallazgos latentes aceptados y su alcance (FR-005/FR-007): · depende de T037
  el contraste del texto inactivo en tema claro (4.39:1, por debajo de 4.5:1, sin tocar ningún token
  compartido) y el encabezado interno de cada sección como rótulo de texto, no promovido a encabezado
  semántico. Depende de T037 (mismo fichero).
- [X] T039 (writes: `specs/014-inspector-detail-tabs/verification.md`) Cerrar la deuda explícita de [quickstart.md](./quickstart.md) §7 (Escenario 7): ejecutar · depende de T038
  `pnpm dev` y validar a mano panel a **280 px** y **720 px** (siete etiquetas completas, envoltura sin
  scroll horizontal), tema oscuro y claro (indicador activo; se confirma el 4.39:1 en claro), contraste
  forzado del sistema (activo y foco distinguibles pestaña a pestaña), revisión visual de `Detalle | Chat`
  y recorrido de teclado completo; anexar el veredicto a `verification.md`. Depende de T038 (mismo fichero);
  ninguna tarea de código queda pendiente por este escenario.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; T002 depende de T001 (mismo `baseline.md`).
- **Foundational (Phase 2)**: depende del Setup; **bloquea** US1–US7 y los nueve dueños E2E. T003 y T004 son
  paralelos; T005 depende de T003.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP y no depende de ninguna otra historia.
- **US2 (Phase 4)**: depende de US1 (T010 monta T006/T008). Habilita los E2E de US3, US4, US5 y US6 que
  montan el `InspectorPanel` completo.
- **US3 (Phase 5)**: depende de US2 (T012/T013/T014 necesitan el panel reescrito).
- **US4 (Phase 6)**, **US5 (Phase 7)** y **US7 (Phase 9)**: comparten `ui/tabs.tsx` y
  `tabs.a11y.spec.tsx`, así que se ejecutan **en ese orden** (foco → envoltura → indicador). US4 y US5 no
  dependen de US2/US3; sus E2E (T019, T022) sí necesitan el panel montado.
- **US6 (Phase 8)**: las cuatro secciones y sus specs son independientes de todo lo anterior; T029 depende de
  T010 y T023–T026; T030 depende de T029.
- **Polish (Phase 10)**: depende de US1–US7; T035 → T036 → T037 → T038 → T039 por compartir
  `verification.md`.

### Within Each Story

- US1: T006 → (T007, T008, T009).
- US2: T010 → T011.
- US3: T012 y T013 (ambos dependen de T010) → T014/T015/T016 en paralelo.
- US4/US5/US7: cambio del primitivo → guardias de su spec → E2E de su frontera.
- US6: T023–T026 y T027/T028 en paralelo → T029 → T030/T031.
- Los nueve E2E dependen de la **unión de las dos unidades que cruzan** (ver tabla de fronteras).

### Ficheros compartidos (por eso NO llevan `[P]` entre sí)

| Fichero | Tareas (en orden) |
|---|---|
| `specs/014-inspector-detail-tabs/baseline.md` | T001 → T002 |
| `src/Domains/Inspector/Components/index.ts` | T008 → T012 |
| `src/Domains/Inspector/Components/InspectorPanel.tsx` | T010 → T029 |
| `src/Application/Components/ui/tabs.tsx` | T017 → T020 → T032 |
| `src/Application/Components/ui/specs/tabs.a11y.spec.tsx` | T018 → T021 → T033 |
| `specs/014-inspector-detail-tabs/verification.md` | T035 → T036 → T037 → T038 → T039 |

`src/Infrastructure/specs/integration/harness.tsx` **no** se escribe en ninguna tarea: se consume tal cual.

---

## Parallel Example: User Story 1

```bash
# Foundational en paralelo (2 ficheros nuevos sin solape):
Task: "T003 useInspectorSectionTabs.ts"
Task: "T004 specs/useInspectorSectionTabs.spec.tsx"
# Luego, en US1:
Task: "T006 InspectorSectionTabs.tsx"
# Tras T006, en paralelo:
Task: "T007 specs/InspectorSectionTabs.spec.tsx"
Task: "T008 Components/index.ts (+export)"
Task: "T009 inspectorSectionTabState.integration.spec.tsx"
```

## Parallel Example: User Story 6

```bash
# Las cuatro secciones y sus specs, en paralelo (8 ficheros distintos):
Task: "T023 SubagentsSection.tsx"
Task: "T024 ToolHistory.tsx"
Task: "T025 AnswersSection.tsx"
Task: "T026 ErrorsSection.tsx"
Task: "T027 specs de Subagentes y Herramientas"
Task: "T028 specs de Respuestas y Errores"
# Tras T023–T026: T029 (InspectorPanel) y luego T030/T031 (E2E de las dos fronteras) en paralelo.
```

## Parallel Example: las nueve fronteras E2E

```bash
# Todas son ficheros nuevos en src/Infrastructure/specs/integration/ (sin solape entre ellas):
Task: "T009 inspectorSectionTabState.integration.spec.tsx (U2↔U3)"
Task: "T011 inspectorSectionTabLifecycle.integration.spec.tsx (U4↔U3)"
Task: "T014 inspectorSectionsRecordWiring.integration.spec.tsx (U4↔U3)"
Task: "T015 inspectorLatencyChain.integration.spec.tsx (U6↔U2↔U4)"
Task: "T019 inspectorNestedTablists.integration.spec.tsx (U5↔U4/U3)"
Task: "T022 inspectorSectionTabsPrimitive.integration.spec.tsx (U1↔U3)"
Task: "T030 inspectorSectionsMessagesStates.integration.spec.tsx (U6↔U2↔U4)"
Task: "T031 inspectorSectionsServiceStates.integration.spec.tsx (U6↔U4)"
Task: "T034 detailChatTablistRegression.integration.spec.tsx (U1↔U5)"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Phase 1 (T001–T002): línea base registrada.
2. Phase 2 (T003–T005): hook + constantes + spec.
3. US1 (T006–T009): el tablist de siete secciones.
4. US2 (T010–T011): el panel lo monta y la sección activa es efímera.
5. US3 (T012–T016): resumen continuo y retirada del desplegable.
6. **STOP & VALIDATE**: quickstart §0–§4 verde; el detalle ya no tiene desplegable ni duplicados. Este es el
   incremento entregable (todo P1).

### Incremental Delivery

1. Setup + Foundational → definición del tablist lista.
2. US1 → US2 → US3 → validar (MVP, las tres P1).
3. US4 → US5 → US7 → el primitivo compartido queda corregido (teclado, ancho, contraste) sin regresión de
   `Detalle | Chat`.
4. US6 → las cuatro secciones dejan de mostrar falsos vacíos.
5. Polish → quickstart, compuertas, superficie congelada, hallazgos y deuda de navegador registrados.

### Notas

- Ninguna tarea escribe los ficheros de la tabla «Ficheros intocables»; T037 los verifica por `git diff` y
  `rg`.
- Los nueve E2E reutilizan el arnés existente y **no** aplican `mockInspectorBarrel`: el panel real es el
  sujeto de la frontera.
- Commit por tarea o grupo lógico con Conventional Commits (`feat(inspector): …`, `fix(tabs): …`,
  `test(inspector): …`, `docs(specs): …`).

---

## Phase 11: Convergence

Evaluación de `converge` sobre el árbol ya implementado (T001–T039 marcadas) contra `spec.md`,
`plan.md`, `tasks.md`, el contrato de `specs/014` y la constitución (I–VIII), con el insumo
`.opencode/runs/014-inspector-detail-tabs/cambios_de_contrato.md`. **Dos hallazgos accionables**
(T040, T041); el resto de puntos abiertos del run se cierran como **deuda aceptada** o **no-gap**
(ver el resumen de convergencia): el criterio «referencia y control de umbral montados con 404» de
T015 contradice el §5 del contrato (corregido después en U03 del run `20261013-cierre-deudas`:
T015 ya no exige ese criterio) (error → `EmptyScreenError` en los siete paneles) y no tiene base
en FR-009, así que se mantiene el código; el mecanismo de foco (`outline` + `forced-colors`) ya está
descrito en el §6 del contrato; las constantes/props no listadas en `data-model.md` realizan valores
ya fijados en `tasks.md`/contrato; la deuda de navegador (§7), los hallazgos latentes H-L1/H-L2 y la
fragilidad de *timing* de `workspaceViewWiring` quedan como deuda aceptada sin tarea.

- [X] T040 (writes: `specs/014-inspector-detail-tabs/verification.md`) Actualizar el cuadre de T035/T036 al estado real del árbol: la evidencia registra **210 ficheros / 2078 tests** y «9 E2E / +30 tests», pero la suite vigente rinde **211 ficheros / 2085 tests** (2083 passed, 1 skipped, 0 fallos funcionales) porque `inspectorNestedTablists.integration.spec.tsx` pasó de 3 a 5 tests y existe un 10.º E2E (T041). Anexar a `verification.md` una nueva pasada de `pnpm tsc && pnpm tsc:node && pnpm lint && pnpm test` con el recuento corregido, el desglose por fichero de los E2E y la nota de carga (en la pasada de `converge`, con carga alta y 157.56 s, cayó por timeout `enrichmentSessionStatus.integration.spec.tsx` — spec ajeno a la feature y **no** modificado por ella —, mientras que la pasada limpia de T036 quedó verde). No reescribir el resto del documento (partial).

- [X] T041 (writes: `src/Infrastructure/specs/integration/inspectorSectionSourceStates.integration.spec.tsx`, `specs/014-inspector-detail-tabs/verification.md`) Trazar y justificar (o retirar) el 10.º E2E · depende de T040: `inspectorSectionSourceStates.integration.spec.tsx` (5 tests: carga del diff, error de cada una de las tres fuentes de Preguntas y permisos y carga de la latencia del padre) **no** figura en `plan.md`, `tasks.md`, `schedule.json` ni en `.opencode/runs/014-inspector-detail-tabs/cambios_de_contrato.md`, y se creó después de las compuertas. Si se conserva, registrar en `verification.md` su propósito, su dueño y su recuento como adición aceptada al contrato de regresión §8; si se retira, eliminarlo y dejar constancia del recuento corregido. No cambiar sus aserciones sin volver a pasar la compuerta de tests (unrequested).
