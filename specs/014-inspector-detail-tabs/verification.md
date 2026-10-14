# Verificación — `014-inspector-detail-tabs`

**Feature**: `014-inspector-detail-tabs` | **Fecha**: 2026-10-13 | **Unidad**: U26 (T035, T036, T037); U27 (T038, T039)
**Plan**: [plan.md](./plan.md) | **Guía**: [quickstart.md](./quickstart.md) | **Línea base**: [baseline.md](./baseline.md)

Cierre de la feature: recorrido de `quickstart.md` §0–§6, compuertas completas y auditoría de la
superficie congelada del contrato §7. Todo contra la línea base firmada en `baseline.md`
(commit `19ceb5073d759ba641003734bcd77bf1f06c68b5`, **200 ficheros / 1992 tests: 1991 passed,
1 skipped / 82.88 s**, compuertas en exit 0).

- **Commit del árbol verificado**: `19ceb5073d759ba641003734bcd77bf1f06c68b5` (`git rev-parse HEAD`; los cambios de la feature están **sin commitear** en el working tree).
- **Entorno**: macOS (darwin), Node v22.12.0, pnpm, `vitest run` sobre `jsdom`.
- **Estado de partida**: T001–T034 marcadas; hook, primitivo, tablist, panel, specs y los 9 E2E de frontera ya en el árbol.
- Todos los comandos se ejecutan desde la raíz del repo.

---

## T035 · Quickstart §0–§6

### Escenarios

| § | comando | alcance | ficheros | tests | duración | veredicto |
|---|---|---|---|---|---|---|
| 0 | `pnpm test -- .../useInspectorSectionTabs.spec.tsx .../InspectorSectionTabs.spec.tsx` | estado previo (rojo esperado antes del código) | 2 | 31 | 5.76 s | **verde** (los dos specs existen y pasan) |
| 1 | mismo comando | US1, US2 / FR-001..FR-003, SC-001, SC-002 | 2 | 31 | 5.76 s | **verde** |
| 2 | `pnpm test -- .../InspectorSectionTabs.spec.tsx .../ui/specs/tabs.a11y.spec.tsx` | US4, US5, US7 / FR-006, FR-007, FR-013, SC-003, SC-006 | 2 | 29 | 6.79 s | **verde** |
| 3 | `pnpm test -- .../SubagentsSection.spec.tsx .../ToolHistory.spec.tsx .../AnswersSection.spec.tsx .../ErrorsSection.spec.tsx` | US6 / FR-008, SC-005 | 4 | 40 | 7.02 s | **verde** |
| 4 | `pnpm test -- .../InspectorPanel.spec.tsx .../LatencySection.spec.tsx` | US3 / FR-004, FR-005, FR-009, FR-010, SC-002 | 2 | 28 | 9.39 s | **verde** |
| 5 | `pnpm test -- .../InspectorPane.spec.tsx .../WorkspaceLayout.spec.tsx .../WorkspaceMobileTabs.spec.tsx .../useDetailTabs.spec.tsx` | FR-011, FR-012, SC-004 | 4 | 52 | 4.00 s (1.ª pasada 9.18 s) | **verde** |
| 6 | `pnpm tsc && pnpm tsc:node && pnpm lint && pnpm test` | FR-001..FR-013 (no regresión), SC-001..SC-006 | 210 | 2078 | 90.88 s | **verde** (2.ª pasada; ver nota de la 1.ª) |
| 7 | navegador (`pnpm dev`, 280/720 px, tema oscuro/claro, `forced-colors`, recorrido de teclado) | FR-006, FR-007, FR-011, SC-003, SC-006 | — | — | — | **pendiente** (deuda explícita del run; no ejecutable en este entorno) |

Detalle de §0 vs §1: §0 describe el estado **pre-implementación** (specs inexistentes, rojo). A la
hora de esta verificación el código ya está implementado, así que §0 no es reproducible
retrospectivamente; lo comprobable es el punto de llegada — los dos specs existen y pasan
(`useInspectorSectionTabs.spec.tsx` 16 tests, `InspectorSectionTabs.spec.tsx` 15 tests).

Detalle por fichero de los subconjuntos:

| fichero | tests | duración | estado |
|---|---|---|---|
| `Hooks/specs/useInspectorSectionTabs.spec.tsx` | 16 | 74 ms | verde |
| `Components/specs/InspectorSectionTabs.spec.tsx` | 15 | 876 ms / 1336 ms | verde |
| `Application/Components/ui/specs/tabs.a11y.spec.tsx` | 14 | 852 ms | verde |
| `Components/specs/SubagentsSection.spec.tsx` | 11 | 411 ms | verde |
| `Components/specs/ToolHistory.spec.tsx` | 10 | 674 ms | verde |
| `Components/specs/AnswersSection.spec.tsx` | 13 | 909 ms | verde |
| `Components/specs/ErrorsSection.spec.tsx` | 6 | 174 ms | verde |
| `Components/specs/InspectorPanel.spec.tsx` | 18 | 2482 ms | verde |
| `Components/specs/LatencySection.spec.tsx` | 10 | 458 ms | verde |
| `Infrastructure/Components/specs/InspectorPane.spec.tsx` | 24 | 510 ms | verde |
| `Infrastructure/Components/specs/WorkspaceLayout.spec.tsx` | 7 | 187 ms | verde |
| `Infrastructure/Components/specs/WorkspaceMobileTabs.spec.tsx` | 13 | 315 ms | verde |
| `Infrastructure/Hooks/specs/useDetailTabs.spec.tsx` | 8 | 21 ms | verde |

### Veredicto de los criterios de aceptación

| SC | criterio | evidencia | veredicto |
|---|---|---|---|
| SC-001 | siete secciones alcanzables con una sola acción: 0 desplegables, 0 pasos intermedios | §1 y §4 verdes; `InspectorSectionTabs.spec` (tablist de 7 con activa `subagents`) e `InspectorPanel.spec` (sin `aria-expanded` ni `role="region"` del desplegable); `rg AdvancedSection src` sin resultados (§T037) | **cubierto** (jsdom) |
| SC-002 | ninguna sección dos veces: 0 duplicados resumen/pestañas | §4 verde: orden Identidad → Modelo → Métricas → Contexto → Recursos → Duración mediana, Contexto presente, ninguna sección del resumen dentro del área de pestañas y `InspectorPanel.spec` 18 tests | **cubierto** (jsdom) |
| SC-003 | 7 etiquetas completas (0 recortes, 0 abreviaturas, 0 scroll horizontal) en ancho mín./máx. | §2 verde: guardias de clase del primitivo y del call site (`flex-wrap`, `min-h-control`, `whitespace-nowrap`, sin `truncate`); el render real a 280/720 px es §7 | **parcial**: guardias de clase sí, medición visual pendiente (§7) |
| SC-004 | 0 regresiones en `Detalle \| Chat` y navegación móvil | §5 verde (52 tests: InspectorPane 24, WorkspaceLayout 7, WorkspaceMobileTabs 13, useDetailTabs 8) + 9 E2E de frontera + suite completa verde | **cubierto** |
| SC-005 | 0 vacíos falsos en las cuatro secciones con estados hilados | §3 verde: con `isError` se ve el error y nunca el vacío; con `isLoading` se ve la carga y nunca el vacío; el vacío legítimo persiste; `AnswersSection` conserva cabecera, toggle de razonamiento y "Ver histórico completo" en los cuatro estados | **cubierto** |
| SC-006 | 100 % de secciones por teclado (flechas, Inicio/Fin) y puntero, con foco visible; en contraste forzado activo y foco distinguibles | §2 verde: APG con 7 pestañas, fixture anidado, foco por `outline` + `forced-colors:outline-[Highlight]`, indicador activo con clase de contraste; el `forced-colors` real es §7 | **parcial**: teclado/foco/guardias de clase sí, contraste forzado real pendiente (§7) |

### Comparación contra `baseline.md`

| medida | baseline (T001/T002) | verificación | delta |
|---|---|---|---|
| Suite completa · ficheros | 200 | **210** | +10 |
| Suite completa · tests | 1992 (1991 passed, 1 skipped) | **2078 (2077 passed, 1 skipped)** | +86 |
| Suite completa · duración | 82.88 s | **90.88 s** (2.ª pasada) | +8.00 s |
| Suite completa · fallos | 0 | **0** (2.ª pasada) | 0 |
| `pnpm test -- src/Domains/Inspector` | 27 ficheros / 196 tests / 11.27 s | **28 / 243 / 11.76 s** | +1 fichero / +47 tests / +0.49 s |
| `pnpm test -- tabs.a11y` | 5 tests / 1.35 s | **14 tests / 852 ms** | +9 tests |
| `pnpm test -- InspectorPane.spec` | 24 tests / 3.52 s | **24 tests / 510 ms** | 0 |
| `pnpm test -- WorkspaceLayout.spec` | 7 tests / 2.61 s | **7 tests / 187 ms** | 0 |
| `pnpm test -- WorkspaceMobileTabs.spec` | 13 tests / 4.80 s | **13 tests / 315 ms** | 0 |
| `pnpm test -- useDetailTabs.spec` | no figuraba en `baseline.md`; spec **sin cambios** en el árbol → conteo de `HEAD` | **8 tests / 21 ms** | 0 |
| `pnpm tsc` | exit 0, sin diagnósticos | **exit 0, sin diagnósticos** | 0 |
| `pnpm tsc:node` | exit 0, sin diagnósticos | **exit 0, sin diagnósticos** | 0 |
| `pnpm lint` | exit 0, 0 errores / 0 warnings | **exit 0, 0 errores / 0 warnings** | 0 |

**Cuadre de los deltas (+10 ficheros / +86 tests)**:

- Ficheros: 11 nuevos (2 specs del dominio + 9 E2E de frontera en
  `src/Infrastructure/specs/integration/`) − 1 eliminado (`AdvancedSection.spec.tsx`) = **+10**.
- Tests: **+47** en `src/Domains/Inspector` (31 nuevos: 16 + 15; +21 por ampliación de
  Subagents +6, ToolHistory +6, Answers +4, Errors +3, InspectorPanel +2; −5 del spec de
  `AdvancedSection` eliminado) **+9** en `tabs.a11y.spec.tsx` **+30** en los 9 E2E
  (`inspectorSectionsRecordWiring` 3, `inspectorSectionTabsPrimitive` 4, `inspectorNestedTablists` 3,
  `inspectorSectionsServiceStates` 2, `inspectorSectionTabState` 4, `inspectorLatencyChain` 3,
  `inspectorSectionsMessagesStates` 4, `detailChatTablistRegression` 3,
  `inspectorSectionTabLifecycle` 4) = **+86**.
- Duración: sin regresión atribuible a la feature (ver nota de carga de máquina en T036).

### Nota de §7 (pendiente)

La deuda de verificación en navegador del §7 (ratios renderizados, `forced-colors` real y ancho de
etiquetas a 280/720 px) **sigue abierta**: jsdom no puede medirla y este entorno no tiene navegador
interactivo. Es lo único que separa SC-003 y SC-006 de "cubierto". Queda registrado como deuda
explícita, no como fallo: los escenarios §0–§6 —el alcance pedido— están verdes.

---

## T036 · Compuertas completas

Comando único: `pnpm tsc && pnpm tsc:node && pnpm lint && pnpm test`.

| compuerta | comando | resultado | estado |
|---|---|---|---|
| TypeScript (app) | `pnpm tsc` | exit `0`, sin diagnósticos | verde |
| TypeScript (config Node) | `pnpm tsc:node` | exit `0`, sin diagnósticos | verde |
| ESLint | `pnpm lint` | exit `0`, **0 errores, 0 warnings** | verde |
| Batería completa | `pnpm test` (`vitest run`) | **210 ficheros / 2078 tests (2077 passed, 1 skipped) / 0 fallos / 90.88 s** | verde |

- `pnpm lint`: única salida, el aviso de configuración preexistente
  `Warning: React version not specified in eslint-plugin-react settings.` — no es un hallazgo sobre
  ficheros y ya estaba en `baseline.md`; **0 warnings nuevos**.
- `pnpm tsc` / `pnpm tsc:node`: **0 errores nuevos** (0 en total).
- Batería: `Start at 17:14:46` · `Duration 90.88 s (transform 7.86 s, setup 109.14 s, collect 111.70 s,
  tests 131.78 s, environment 191.07 s, prepare 29.77 s)`.

### Primera pasada de la batería: 1 fallo intermitente por timeout (no reproducido)

La 1.ª pasada (`Start at 17:12:07`) terminó con **1 fallo**:

```
FAIL src/Infrastructure/specs/integration/workspaceViewWiring.integration.spec.tsx
     > WorkspaceView — cableado de los cinco slots (T023, U2↔U3)
     > escritorio: los cinco slots llegan con sus props/data-testid y el attentionCount del subárbol
Error: Test timed out in 5000ms.
Test Files  1 failed | 209 passed (210)
     Tests  1 failed | 2076 passed | 1 skipped (2078)
Duration  136.01s
```

Análisis y descarte como regresión de la feature:

- El spec **no está modificado** por esta feature (`git status` limpio para ese fichero) y hace
  `vi.mock('@app/Domains/Inspector')`: el código del Inspector —lo único que esta feature toca en
  ese camino— no se ejecuta en él.
- **Aislado pasa**: `pnpm test -- src/Infrastructure/specs/integration/workspaceViewWiring.integration.spec.tsx`
  → 3 tests verdes, pero el caso de escritorio tarda **4524 ms** de un techo de **5000 ms**: es
  frágil al margen de la feature.
- La máquina estaba **muy cargada** al arrancar la 2.ª pasada: `load averages: 118.04 68.60 38.43`
  (el run 1 corrió con carga alta y sus fases se inflaron: `transform 17.64 s` vs 7.86 s,
  `tests 219.59 s` vs 131.78 s).
- La 2.ª pasada de la batería completa, con el **mismo árbol**, quedó **verde**.

**Conclusión**: fallo intermitente de *timing* bajo carga, en un spec ajeno a la feature; batería
completa verde en la pasada limpia. Se reporta como hallazgo para el orquestador (no bloquea el
cierre, pero conviene saber que ese spec vive a ~90 % de su timeout).

### Warnings de runtime (`act(...)`) — preexistentes salvo uno

`pnpm test` emite bloques `stderr` de `An update to … was not wrapped in act(...)` en
`tabs.a11y.spec.tsx` y `InspectorPane.spec.tsx`. No son warnings de compuerta (ni `tsc` ni `lint`),
pero se dejan contados:

- **3 preexistentes** en el describe `ui/tabs — patrón APG del tablist (T066, FR-021)` — los mismos
  tres tests que ya existían en la línea base (`git show 19ceb507:…/tabs.a11y.spec.tsx`).
- **1 preexistente** en `InspectorPane.spec.tsx` (spec sin cambios, `T025`).
- **1 nuevo** en el describe añadido por esta feature
  `ui/tabs — anidamiento, teclado y foco (US4, FR-013/FR-021) > salta al primero/último con Inicio/Fin
  sobre siete pestañas` (`ForwardRef(RovingFocusGroupImpl)`).

El nuevo es ruido de test (el test pasa), no un fallo funcional; se apunta para que el orquestador
decida si merece un arreglo de `act()` posterior.

---

## T037 · Auditoría de la superficie congelada (contrato §7)

| # | comprobación | comando | resultado | estado |
|---|---|---|---|---|
| 1 | `AdvancedSection` eliminado sin referencias de producto | `rg -n "AdvancedSection" src` | **exit 1, 0 resultados** (ni en `src/` ni en los specs de `src/`) | ✅ |
| 2 | `queryKeys.ts` sin cambios | `git diff -- src/Domains/queryKeys.ts` | **vacío** | ✅ |
| 3 | `Inspector.service.ts` sin cambios | `git diff -- src/Domains/Inspector/Inspector.service.ts` | **vacío** | ✅ |
| 4 | `Inspector.entity.ts` sin cambios | `git diff -- src/Domains/Inspector/Inspector.entity.ts` | **vacío** | ✅ |
| 5 | `Routes.tsx` sin cambios | `git diff -- src/Infrastructure/Routes.tsx` | **vacío** | ✅ |
| 6 | `InspectorPane.tsx` sin cambios | `git diff -- src/Infrastructure/Components/InspectorPane.tsx` | **vacío** | ✅ |
| 7 | `Disclosure` sigue exportado | `rg "export const Disclosure" src/Application/Components/Molecules/Disclosure.tsx` | `:53 export const Disclosure = ({` + reexport en `Molecules/index.ts:28` | ✅ |
| 8 | `Disclosure` sigue usado por `ToolHistory` | `rg "Disclosure" src/Domains/Inspector/Components/ToolHistory.tsx` | import en `:4`, uso en `:65` (`<Disclosure … "Ver N más / Ver menos">`) | ✅ |
| 9 | Barrels: fuera `AdvancedSection`, dentro `InspectorSectionTabs` | `git diff -- src/Domains/Inspector/Components/index.ts` | `-export * from './AdvancedSection'` / `+export * from './InspectorSectionTabs'` | ✅ |
| 10 | `AdvancedSection.spec.tsx` eliminado | `git status --porcelain` | `D src/Domains/Inspector/Components/specs/AdvancedSection.spec.tsx` | ✅ |
| 11 | Contratos de 004/010 dejan de describir "Avanzado" | `git diff --stat -- specs/004-…/contracts/inspector-layout-contract.md specs/010-…/contracts/context-panel-contract.md` | `inspector-layout-contract.md` 65 líneas (24 ins./46 del.) y `context-panel-contract.md` 5 líneas; el resto de `specs/004` intacto | ✅ |
| 12 | Copy/etiquetas de las secciones conservadas | `rg "Sin respuestas todavía\|Sin errores\|Sin subagentes\|Sin actividad de herramientas\|Sin permisos ni preguntas"` + diff de las cuatro secciones | Las 5 cadenas siguen presentes; en los diffs solo se añaden `isError`/`isLoading` y comentarios (la línea de "Sin respuestas todavía" que aparece como `-` en el diff se reubica dentro de la nueva rama de prioridades; sigue en `AnswersSection.tsx:114`) | ✅ |

### Nota sobre `Disclosure.tsx`

`Disclosure.tsx` **aparece como modificado** en `git status`, pero el diff es **solo de comentarios**
(`index 6c585b4..8a9a00f`): se retiran las menciones a `AdvancedSection` del JSDoc y de
`DISCLOSURE_BUTTON_CLASSNAME`. **No cambia props, comportamiento, export ni el patrón de
`aria-expanded`/`aria-controls`/`role="region"`**; el contrato §7 pide conservarlo y se conserva
(el comportamiento queda cubierto por los specs de `ToolHistory`, verdes).

### Fuera del alcance congelado que sí cambió (esperado por la feature)

`ui/tabs.tsx` (primitivo), `InspectorPanel.tsx`, `AnswersSection.tsx`, `ErrorsSection.tsx`,
`SubagentsSection.tsx`, `ToolHistory.tsx`, `Hooks/index.ts`, `Components/index.ts` y los specs
correspondientes, más los 11 ficheros nuevos. La evidencia de que el cambio del primitivo **no
regresó** al consumidor externo: `InspectorPane.spec.tsx` verde con 24 tests (mismo conteo que la
línea base) y `detalleChatTablistRegression.integration.spec.tsx` (3 tests verdes).

---

## T038 · Hallazgos latentes aceptados (FR-005 / FR-007)

Dos hallazgos conocidos y **aceptados explícitamente** en las clarificaciones de `spec.md`
(sesión 2026-10-13), registrados aquí con alcance y con lo que **queda fuera** de este cambio. Ninguno
es un fallo de la feature: son deuda asumida, decidida con el usuario y con la opción recomendada.

### H-L1 · Contraste del texto inactivo en tema claro — 4.39:1 (FR-007)

- **Hecho**: el texto de las pestañas **inactivas** en tema **claro** rinde **4.39:1**, por debajo
  del **4.5:1** de WCAG 2.2 AA (1.4.3). En el tema **oscuro servido** cumple. Evidencia:
  `research.md:71` (R4) y `discovery/rfc.md:65,138`; el token responsable es
  `text-muted-foreground`, aplicado en `TabsList` (`tabs.tsx:15`) y heredado por los
  `TabsTrigger` (solo el activo lo anula con `data-[state=active]:text-foreground`).
- **Decisión (opción B)**: se deja **latente**. **No** se ha modificado `text-muted-foreground` ni
  **ningún token compartido de color**; el runtime siempre añade `dark` (`src/main.tsx:15`), así que
  hoy el fallo no se sirve.
- **Alcance**: solo el label **inactivo** en claro, del primitivo compartido de pestañas; **no** afecta
  al estado activo (indicador `data-[state=active]:border-foreground`, ≥3:1 por 1.4.11) ni al foco
  (`outline`), ni a las etiquetas de pestaña (todas legibles). Tampoco hay cambio de contraste en
  `Detalle | Chat` (comparte primitivo y token).
- **Cubierto hoy por specs**: guardias de **clase** de que no se tocó ningún token/color del primitivo
  (`tabs.a11y.spec.tsx:334-389`), y la no regresión del consumidor externo
  (`detailChatTablistRegression.integration.spec.tsx`). **No** hay medición de ratio: jsdom no
  computa contraste, es el punto 2 de §7 (abajo).

### H-L2 · Encabezado interno de cada sección como rótulo de texto (FR-005)

- **Hecho**: el encabezado interno de cada sección es un `<span>` de versalitas
  (`src/Application/Components/Molecules/SectionHeading.tsx:23`:
  `text-[11px] font-medium uppercase tracking-wide text-muted-foreground`), **no** un encabezado
  semántico de nivel de título (`h3`). Los paneles quedan **sin** encabezado semántico interno.
- **Decisión (opción A)**: se **mantiene como está**; **no** se promueve a `h3` y **no** se toca el
  componente de encabezado compartido (lo usan `Inspector` y `Application/History`, más consumidores
  fuera de esta feature). Evidencia: `spec.md:15,152` y `discovery/rfc.md:65`.
- **Alcance**: es una limitación de semántica interna del panel, no de nomenclatura (FR-005 exige
  conservar denominaciones y eso se cumple). El **tabpanel sí está nombrado**: Radix le pone
  `aria-labelledby` apuntando a su pestaña, de modo que la sección activa tiene nombre accesible y
  no queda huérfana. Lo que falta es un encabezado de nivel dentro del contenido.
- **Cubierto hoy por specs**: el nombre accesible del `tabpanel` y el orden de las 7 pestañas
  (`InspectorSectionTabs.spec.tsx`, `inspectorSectionTabsPrimitive.integration.spec.tsx`). **No**
  cubierto: la promoción a encabezado semántico, que exigiría un cambio aparte sobre `SectionHeading`
  (fuera del alcance de la feature).

### Hallazgo heredado (no es regresión de esta feature)

- **`workspaceViewWiring.integration.spec.tsx` — caso de escritorio a ~90 % de su timeout.** El test
  `escritorio: los cinco slots llegan con sus props/data-testid y el attentionCount del subárbol`
  tarda **~4524 ms** contra un techo de **5000 ms** y puede caer por **timeout** bajo carga alta
  (ocurrió una vez en la 1.ª pasada de T036, con `load averages: 118.04`; ver esa sección). El spec
  **no está modificado** por la feature y hace `vi.mock('@app/Domains/Inspector')`, así que el código
  del Inspector no se ejecuta en él.
- **Constancia, no arreglo**: `src/Infrastructure/specs/integration/workspaceViewWiring.integration.spec.tsx`
  queda **fuera** de los `writes` de U27, así que **no se toca**. Se deja registrado como fragilidad
  de *timing* preexistente y **ajena** a la feature, para que el orquestador decida si merece un
  follow-up (aislar/optimizar el caso o subir su timeout). No bloquea el cierre de esta feature: la
  batería completa quedó verde en la pasada limpia.

---

## T039 · Cierre de la deuda explícita de §7 (verificación en navegador)

**Veredicto: la deuda de §7 queda registrada como deuda abierta y explícita, no ejecutada en este
entorno.** `quickstart.md` §7 pide `pnpm dev` y validación **a mano** en navegador real (280/720 px,
tema claro/oscuro, `forced-colors` del sistema, revisión visual de `Detalle | Chat` y recorrido de
teclado). Este entorno es **headless** (vitest/`jsdom`, sin navegador interactivo ni motor de layout),
así que los cinco puntos **no son ejecutables aquí**. No hay ninguna tarea de **código** pendiente
por este escenario: lo que queda es comprobación visual/medición de ratios en un navegador.

Alcance punto a punto y qué **queda cubierto** por los specs de clase/texto (§2–§5):

| # | punto de §7 | cubierto hoy (clase/texto) | no cubierto (requiere navegador) |
|---|---|---|---|
| 1 | 280 px y 720 px: 7 etiquetas completas, envuelve sin scroll horizontal | `tabs.a11y.spec.tsx:281-304` (`min-h-control`+`flex-wrap`, **sin** `h-control`; 7 triggers `whitespace-nowrap`, sin `truncate`); `inspectorSectionTabsPrimitive.integration.spec.tsx:122,256-278` (descarta `truncate`/`text-ellipsis`/`line-clamp`/`overflow-hidden`); `detailChatTablistRegression.integration.spec.tsx:182-226` | envoltura **real** en filas y ausencia de scroll horizontal medidos a 280/720 px |
| 2 | tema oscuro y claro: indicador activo distinguible; en claro se confirma el 4.39:1 | clase del indicador `data-[state=active]:border-foreground` (≥3:1 por 1.4.11) en `tabs.a11y.spec.tsx:334-389`; H-L1 registrado arriba | ratio **renderizado** de activo/inactivo y la confirmación visual del **4.39:1** en claro |
| 3 | contraste forzado del sistema: activo y foco distinguibles pestaña a pestaña | guardias `forced-colors:focus-visible:outline-[Highlight]` en `TabsTrigger` (`tabs.tsx:30`) y `TabsContent` (`tabs.tsx:45`), asertadas en `tabs.a11y.spec.tsx:220-243,366-389` | `forced-colors` **real** del SO aplicado al primitivo |
| 4 | revisión visual de `Detalle \| Chat` tras cambiar el primitivo | `detailChatTablistRegression.integration.spec.tsx` (3 tests: etiqueta, orden, `aria-label`, roving tabindex, badge, `min-h-control`/`flex-wrap`/`whitespace-nowrap`) | aspecto **visual** (hug, etiquetas, badge) sin regresión perceptible |
| 5 | recorrido de teclado completo (Tab entra, ←/→/Inicio/Fin, foco visible) | APG con 7 pestañas + `Inicio`/`Fin` + fixture anidado + foco por `outline` (`tabs.a11y.spec.tsx`, `InspectorSectionTabs.spec.tsx`) | orden de tabulación y foco **reales** en navegador |

- **Consecuencia sobre los SC**: SC-003 (etiquetas completas a ancho mín./máx.) y SC-006
  (teclado/puntero + activo y foco en contraste forzado) quedan **parcialmente** cubiertos —guardias
  de clase y texto verdes— y **pendientes de la medición en navegador**. SC-001, SC-002, SC-004 y
  SC-005 no dependen de §7 y están **cubiertos**.
- **Qué haría falta para cerrarla**: navegador interactivo (Chrome/Playwright) con emulación de
  `forced-colors` y `prefers-color-scheme`, o una pasada manual; el resultado se anexaría a esta
  sección sustituyendo el veredicto "no ejecutable". No se añade como tarea de código.

---

## Firma

- **T035**: quickstart §0–§6 recorrida, **todos los escenarios verdes**; SC-001, SC-002, SC-004 y
  SC-005 cubiertos; SC-003 y SC-006 cubiertos en lo verificable con jsdom y **pendientes del §7**
  (navegador).
- **T036**: `pnpm tsc`, `pnpm tsc:node` y `pnpm lint` en **exit 0** (lint: 0 errores, 0 warnings,
  0 nuevos); `pnpm test` **210 ficheros / 2078 tests (2077 passed, 1 skipped) / 0 fallos / 90.88 s**
  frente a **200 / 1992 (1991 passed, 1 skipped) / 82.88 s** de la línea base. Deltas explicados:
  +10 ficheros y +86 tests, todos de la feature.
- **T037**: superficie congelada del contrato §7 **auditada y respetada** (12/12 comprobaciones ✅).
- **T038**: los **dos hallazgos latentes aceptados** quedan registrados con su alcance (FR-005/FR-007):
  contraste del texto inactivo en tema claro **4.39:1** sin tocar ningún token (H-L1) y encabezado
  interno de sección como **rótulo de texto** no promovido a encabezado semántico (H-L2); más el
  hallazgo **heredado** de *timing* de `workspaceViewWiring.integration.spec.tsx` (~4524 ms /
  5000 ms), ajeno a la feature y **no** arreglado (fuera de `writes`).
- **T039**: deuda de `quickstart.md` §7 **no ejecutable en este entorno** (headless, sin navegador);
  se anexa el veredicto con alcance punto a punto y la cobertura sustituta por specs de clase/texto.
  Registrada como **deuda abierta explícita**, no como fallo.
- **Deuda abierta**: escenario §7 (navegador: anchos 280/720 px, tema claro, `forced-colors` real);
  los hallazgos latentes H-L1/H-L2; y el hallazgo de *timing* de
  `workspaceViewWiring.integration.spec.tsx` (4524 ms / 5000 ms, ajeno a la feature).

---

## T040 · Cuadre del recuento de la suite (anexo de `converge`, U01)

Anexo posterior a las compuertas de T035/T036: **corrige** su cuadre, no reescribe el histórico de
arriba. La evidencia de §6/T036 registraba **210 ficheros / 2078 tests (2077 passed, 1 skipped)** y
«9 E2E / +30 tests», pero el árbol vigente rinde **211 / 2085** porque (a)
`inspectorNestedTablists.integration.spec.tsx` pasó de 3 a **5** tests y (b) existe un **10.º E2E**
(`inspectorSectionSourceStates.integration.spec.tsx`, 5 tests; ver T041).

Comando único: `pnpm tsc && pnpm tsc:node && pnpm lint && pnpm test`.

| compuerta | comando | resultado | estado |
|---|---|---|---|
| TypeScript (app) | `pnpm tsc` | exit `0`, sin diagnósticos | verde |
| TypeScript (config Node) | `pnpm tsc:node` | exit `0`, sin diagnósticos | verde |
| ESLint | `pnpm lint` | exit `0`, **0 errores, 0 warnings** | verde |
| Batería completa | `pnpm test` (`vitest run`) | **211 ficheros / 2085 tests (2084 passed, 1 skipped) / 0 fallos / 153.49 s** | verde |

- `pnpm lint`: única salida el aviso de configuración preexistente
  `Warning: React version not specified in eslint-plugin-react settings.` (ya en `baseline.md`; **0
  warnings nuevos**).
- Batería: `Start at 17:39:55` · `Duration 153.49 s (transform 14.58 s, setup 179.69 s, collect
  180.47 s, tests 185.71 s, environment 326.86 s, prepare 59.15 s)` · `Test Files 211 passed (211)`.
- Carga de la máquina en esta pasada: `load averages: 12.86 14.97 20.87`.

### Recuento corregido y delta contra `baseline.md`

| medida | baseline (T001/T002) | verificación (T036) | **cuadre T040** | delta real |
|---|---|---|---|---|
| Suite · ficheros | 200 | 210 | **211** | +11 |
| Suite · tests | 1992 (1991 passed, 1 skipped) | 2078 (2077 passed, 1 skipped) | **2085 (2084 passed, 1 skipped)** | +93 |
| Suite · fallos | 0 | 0 | **0** | 0 |
| Suite · duración | 82.88 s | 90.88 s | **153.49 s** | ver nota de carga |

**Cuadre de los deltas (+11 ficheros / +93 tests)**:
- Ficheros: 12 nuevos (2 specs del dominio + **10 E2E de frontera**) − 1 eliminado
  (`AdvancedSection.spec.tsx`) = **+11**.
- Tests: **+47** en `src/Domains/Inspector` (31 nuevos + 21 de ampliación − 5 del spec eliminado)
  **+9** en `tabs.a11y.spec.tsx` **+37** en los **10** E2E = **+93**.

### Desglose por fichero de los 10 E2E de frontera (37 tests)

| # | fichero (`src/Infrastructure/specs/integration/`) | tests | estado |
|---|---|---|---|
| 1 | `inspectorSectionsRecordWiring.integration.spec.tsx` | 3 | verde |
| 2 | `inspectorSectionTabsPrimitive.integration.spec.tsx` | 4 | verde |
| 3 | `inspectorNestedTablists.integration.spec.tsx` | **5** (era 3) | verde |
| 4 | `inspectorSectionsServiceStates.integration.spec.tsx` | 2 | verde |
| 5 | `inspectorSectionTabState.integration.spec.tsx` | 4 | verde |
| 6 | `inspectorLatencyChain.integration.spec.tsx` | 3 | verde |
| 7 | `inspectorSectionsMessagesStates.integration.spec.tsx` | 4 | verde |
| 8 | `inspectorSectionSourceStates.integration.spec.tsx` | **5** (10.º E2E, ver T041) | verde |
| 9 | `detailChatTablistRegression.integration.spec.tsx` | 3 | verde |
| 10 | `inspectorSectionTabLifecycle.integration.spec.tsx` | 4 | verde |
| — | **total** | **37** | verde |

### Nota de carga (intermitencia, no regresión de la feature)

En la pasada de `converge` (carga alta, **157.56 s**) cayó por **timeout**
`enrichmentSessionStatus.integration.spec.tsx` — spec **ajeno** a esta feature y **no** modificado
por ella (T030, frontera U6↔U5) —, mientras que la pasada limpia de T036 y esta pasada de T040
quedaron **verdes**. Es la misma clase de fragilidad de *timing* bajo carga ya registrada en T036
para `workspaceViewWiring.integration.spec.tsx` (~4524 ms / 5000 ms): **no** bloquea el cierre y
**no** es un fallo funcional de la feature. La duración de esta pasada (153.49 s) supera los 90.88 s
de T036 por carga de máquina, no por tests nuevos.

---

## T041 · Trazado del 10.º E2E de frontera (anexo de `converge`, U01)

**Decisión: se CONSERVA.** `inspectorSectionSourceStates.integration.spec.tsx` (5 tests) no figuraba
en `plan.md`, `spec.md` ni `quickstart.md` ni en las olas previas de `schedule.json`, y se creó en la
fase `tests` (`sddorch-tester`) **después** de las compuertas de T035/T036; `converge` lo marcó como
no trazado (F2). No se retira: **cubre huecos reales** del contrato §5 que ninguna otra suite ejercía.

- **Propósito (contrato §5, Principio VI / SC-005)** — las ramas de **carga** y de **fallo de una
  sola fuente** en tres secciones, montando el `InspectorPanel` **real** y dejando **una sola**
  fuente en el estado ejercido (las demás resueltas en vacío, sin sembrar caché):
  1. «Archivos»: `sessions.diff` pendiente ⇒ `Skeleton`, nunca el vacío.
  2. «Preguntas y permisos»: `permissions.for` en 404 (con `questions` y `sessions.inbox` resueltas)
     ⇒ error, nunca vacío — el OR de tres fuentes.
  3. «Preguntas y permisos»: `sessions.inbox` en 404 ⇒ error, nunca vacío.
  4. «Preguntas y permisos»: `questions` pendiente ⇒ carga, nunca vacío.
  5. «Latencia»: mensajes del padre (`invokedBy`) pendientes ⇒ carga, nunca vacío.
  En los cinco, el tablist de 7 pestañas sigue íntegro y operativo.
- **Dueño**: fase `tests` del run `20261013-inspector-detail-tabs` (`sddorch-tester`); registrado en
  `.opencode/runs/014-inspector-detail-tabs/cambios_de_contrato.md` (sección «Fase `tests` y
  `converge`»).
- **Recuento**: **5 tests**, verdes en la compuerta de T040 (y en su ejecución aislada).
- **Estatus contractual**: **adición aceptada** al contrato de regresión **§8** de
  `contracts/inspector-section-tabs-contract.md` (complementa
  `inspectorSectionsServiceStates`/`inspectorSectionsMessagesStates` en las ramas de carga y fallo
  por fuente de §5).
- **Sin cambios de aserciones** (T041 `unrequested`): el fichero queda **sin tocar**; la compuerta de
  tests de T040 pasa con él en el árbol.

Consecuencia sobre el recuento: es el **10.º E2E** y el responsable de los +5 tests que separan los
2078 de T036 de los 2085 vigentes (los otros +2 son de `inspectorNestedTablists`).
