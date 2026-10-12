---

description: "Task list — Chat interactivo por sesión"
---

# Tasks: Chat interactivo por sesión

**Input**: Design documents from `/specs/009-interactive-chat/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: SÍ se incluyen. El plan, `research.md`, `contracts/` y `quickstart.md §2` enumeran specs explícitas (puras, de hooks y de componentes) en carpetas `specs/` junto al código (Principio VIII).

**Organization**: Tareas agrupadas por historia de usuario (US1–US7) para implementación y prueba independientes. Prioridades de `spec.md`: US1/US2/US3 = P1, US4/US5 = P2, US6/US7 = P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias sobre tareas incompletas).
- **[Story]**: US1–US7 en las fases de historia; sin etiqueta en Setup, Foundational y Polish.
- Rutas de archivo concretas en cada descripción.

## Path Conventions

Single project (SPA). Todo bajo `src/`. Specs junto al código en `specs/` de cada carpeta.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Andamiaje del dominio nuevo `Chat`, tipos de vista, claves de caché, esquemas y endurecimiento del dev server.

- [X] T001 [P] Crear el andamiaje del dominio `Chat` y su barrel en `src/Domains/Chat/index.ts` (entity/service/routes/lib/Hooks/Components; **sin** `router.tsx` ni `Pages/`, es panel/pestaña — ver plan §Notas 3)
- [X] T002 [P] Definir los view-models `TChatTimelineEntry`, `TChatStreamBuffer`, `TChatStreamPart`, `TAttentionItem`, `TModelOption`, `TReasoningOption`, `TAgentOption`, `TChatSelection`, `TChatDraft` y el error tipado `TChatWriteError` en `src/Domains/Chat/Chat.entity.ts` (prefijo `T`, sobre tipos del SDK; Principio IV)
- [X] T003 [P] Crear las constantes de rutas del chat (destino de primer nivel) en `src/Domains/Chat/chat.routes.ts`
- [X] T004 [P] Extender `src/Domains/queryKeys.ts` con `chatStream.for(id) = ['chatStream', id]` (clave **raíz**, fuera de `['sessions']`) y `models.{all,list}`; reusar `permissions.*` y `sessions.forms(id)`
- [X] T005 [P] Extender `src/Infrastructure/Services/catalog.service.ts` con `listModels(directory?)` (`opencodeClient.model.list`) y `getDefaultModel(directory?)`
- [X] T006 [P] Endurecer `vite.config.ts`: `server.host: '127.0.0.1'`, guard de `remoteAddress` loopback en `proxy.configure` y validación de `Origin`/`Referer` de loopback (FR-018)
- [X] T007 [P] Endurecer y documentar `scripts/start.sh`: forzar bind loopback y documentar el riesgo (no soportar `OPENCODE_URL` remoto) (FR-018, contrato `dev-server-hardening`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fachada de escritura hermana, validación Zod y ruta aditiva de deltas al buffer. **Bloquea US1–US4.**

**⚠️ CRITICAL**: ninguna historia de escritura puede empezar hasta completar esta fase.

- [X] T008 [P] Crear los esquemas Zod (`sessionIdSchema`, `promptTextSchema`, `permissionDecisionSchema`, `replyPermissionSchema`, `formAnswerSchema`, `replyFormSchema`, `modelRefSchema`) en `src/Domains/Chat/lib/schemas.ts` con spec en `src/Domains/Chat/lib/specs/schemas.spec.ts` (FR-019; W3)
- [X] T009 [P] Implementar `sessionWriteService` (interfaz + `sendPrompt`/`interruptSession`/`replyPermission`/`replyForm`/`switchAgent`/`switchModel`) en `src/Infrastructure/Services/session.write.service.ts`, validando con Zod **antes** del SDK y lanzando `TChatWriteError`; spec en `src/Infrastructure/Services/specs/session.write.service.spec.ts` (mapeo 1:1: `session.prompt`/`session.interrupt`/`permission.reply`/`session.form.reply`/`session.switchAgent`/`session.switchModel`) (W2, W4–W6) — depende de T002, T004, T008
- [X] T010 Exportar `sessionWriteService` como **singleton hermano** en `src/Infrastructure/Services/opencodeClient.ts` **sin** tocar `opencodeService`; confirmar que `src/Infrastructure/Services/specs/opencodeClient.spec.ts` sigue verde sin cambios (FR-016; W1)
- [X] T011 [P] Crear el slice `reduceChatStream` en `src/Domains/Graph/lib/eventReduce/slices/chatStream.ts` (upsert por `ordinal`, reset al cambiar `assistantMessageID`) con spec en `src/Domains/Graph/lib/specs/chatStream.spec.ts` (S1, S2, S5)
- [X] T012 Ajustar de forma **aditiva** el reducer: quitar `session.text.delta`/`session.reasoning.delta` de `IGNORED_EVENT_TYPES` y del `case` de ignorados en `src/Domains/Graph/lib/eventReduce/slices/ignored.ts`, y enrutarlos a `reduceChatStream` en `src/Domains/Graph/lib/eventReducer.ts`; extender `src/Domains/Graph/lib/specs/eventReducer.spec.ts` sin romper el resto (S6) — depende de T011
- [X] T071 [P] Ajustar `src/Infrastructure/specs/applyReducedEvent.spec.ts`: `session.text.delta`/`session.reasoning.delta` ya NO son ignorados (producen un `set` en `['chatStream', id]`); conservar el caso de que la actividad sí se aplica para deltas (consecuencia aditiva de T012) — arreglo derivado de T012

**Checkpoint**: fachada de escritura usable y buffer de deltas enrutado; US1–US4 pueden empezar.

---

## Phase 3: User Story 1 - Enviar un prompt y ver la respuesta en vivo (Priority: P1) 🎯 MVP

**Goal**: enviar un texto no vacío a la sesión abierta, ver la respuesta progresiva "En curso" y su consolidación sin duplicar; alcanzable desde la pestaña Chat (desktop).

**Independent Test**: abrir una sesión en la pestaña Chat, enviar un texto y comprobar que el mensaje propio aparece y que el texto del agente crece hasta cerrarse como respuesta consolidada (sin duplicarse) (SC-001, SC-004).

### Tests for User Story 1

- [X] T013 [P] [US1] Spec pura del buffer en `src/Domains/Chat/lib/specs/mergeChatStream.spec.ts` (S1, S2) — primero debe fallar
- [X] T014 [P] [US1] Spec pura de la proyección en `src/Domains/Chat/lib/specs/buildChatTimeline.spec.ts` (provisional "En curso", dedupe tras `*.ended`; S3, S4)

### Implementation for User Story 1

- [X] T015 [P] [US1] Implementar la función pura `mergeChatStream` en `src/Domains/Chat/lib/mergeChatStream.ts`
- [X] T016 [P] [US1] Implementar la función pura `buildChatTimeline` (historial `buildHistory` + buffer + preguntas, con dedupe) en `src/Domains/Chat/lib/buildChatTimeline.ts`
- [X] T017 [US1] Implementar `useChatDraft(sessionId)` (texto en `localStorage['chat.draft.<id>']`, rehidratación, `isSubmitting`, `queued`) en `src/Domains/Chat/Hooks/useChatDraft.ts` con spec en `src/Domains/Chat/Hooks/specs/useChatDraft.spec.tsx` (FR-015 base)
- [X] T018 [US1] Crear `src/Domains/Chat/Chat.service.ts` con la mutation `useSendPrompt` (traduce `queue` → `delivery: 'queue'` si la sesión está `busy`; Zod ya en la fachada) e invalidación del timeline (FR-001, FR-020)
- [X] T019 [US1] Implementar `useChatController` (timeline desde `buildChatTimeline`; envío, estado `busy`, `delivery` steer/queue) en `src/Domains/Chat/Hooks/useChatController.ts` con spec en `src/Domains/Chat/Hooks/specs/useChatController.spec.tsx` (depende de T016, T017, T018)
- [X] T020 [P] [US1] Crear la molecule `src/Application/Components/Molecules/ChatComposer.tsx` (textarea + Enviar; Enter envía, Shift+Enter salta línea, respeta IME) con spec en `src/Application/Components/Molecules/specs/ChatComposer.spec.tsx` (FR-001, FR-023)
- [X] T021 [P] [US1] Crear `src/Domains/Chat/Components/ChatTimeline.tsx` (provisional en **texto plano** + etiqueta "En curso"; consolidado vía `HistoryEntry`/`RichText`) con spec en `src/Domains/Chat/Components/specs/ChatTimeline.spec.tsx` (FR-002, FR-003, SC-004)
- [X] T022 [US1] Aplicar `memo` a `src/Application/Components/Organisms/HistoryEntry/HistoryEntry.tsx` y `HistoryEntryBody.tsx` para que el timeline no re-renderice por cambios ajenos
- [X] T023 [US1] Crear el orquestador base `src/Domains/Chat/Components/ChatPanel.tsx` (compone timeline + composer sobre la sesión abierta) con spec en `src/Domains/Chat/Components/specs/ChatPanel.spec.tsx` (FR-014; los estados de pantalla completos se añaden en US6)
- [X] T024 [US1] Implementar `useDetailTabs` (estado y tablist Detalle|Chat) en `src/Infrastructure/Hooks/useDetailTabs.ts` con spec en `src/Infrastructure/Hooks/specs/useDetailTabs.spec.tsx`
- [X] T025 [US1] Envolver la columna del detalle en Radix Tabs (`ui/tabs.tsx`) con `Detalle | Chat` en `src/Infrastructure/Components/InspectorPane.tsx`; extender `src/Infrastructure/Components/specs/InspectorPane.spec.tsx` (APG: tablist/tab/tabpanel, flechas, roving tabindex; P1)
- [X] T026 [US1] Cablear `ChatPanel` + `useDetailTabs` en `src/Infrastructure/Components/WorkspaceLayout.tsx` y `src/Infrastructure/WorkspacePage.tsx`; extender `src/Infrastructure/specs/WorkspacePage.spec.tsx`
- [X] T027 [US1] Extender los barrels `src/Domains/Chat/index.ts` y `src/Application/Components/Molecules/index.ts`; verificar el no-relayout del grafo ante deltas (S7 — el grafo no se suscribe a `['chatStream', id]`)

**Checkpoint**: ciclo prompt→respuesta en vivo, sin duplicar y sin mover el grafo. MVP listo.

---

## Phase 4: User Story 2 - Interrumpir un turno en curso (Priority: P1)

**Goal**: detener el turno de la **sesión abierta** desde el chat, con estado de carga en el control; los subagentes siguen.

**Independent Test**: con un turno en curso, pulsar Detener y comprobar que el flujo se corta y que la interfaz vuelve a disponible (FR-004, SC-008).

### Tests for User Story 2

- [X] T028 [US2] Spec de la mutation de interrupción en `src/Infrastructure/Services/specs/session.write.service.spec.ts` (llama con el `sessionID` de la sesión abierta; W4) — primero debe fallar

### Implementation for User Story 2

- [X] T029 [US2] Añadir `useInterruptSession` en `src/Domains/Chat/Chat.service.ts` (solo disponible con `status === 'busy'`; `sessionID` de la sesión abierta)
- [X] T030 [US2] Añadir el control **Detener** al slot de Enviar en `src/Application/Components/Molecules/ChatComposer.tsx` (`enabled` solo si `busy`, `aria-busy` + estado de carga con `isPending`, confirmación `AlertDialog`) ; extender `src/Application/Components/Molecules/specs/ChatComposer.spec.tsx` (FR-004; P7)
- [X] T031 [US2] Exponer disponibilidad/`isPending` de interrupción desde `useChatController` y consumirla en `ChatPanel.tsx`; extender `src/Domains/Chat/Hooks/specs/useChatController.spec.tsx` (FR-004)

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Responder preguntas y permisos, incluidos de subagentes (Priority: P1)

**Goal**: bandeja de pendientes del subárbol sobre el composer, respuesta **inline**, con origen identificado, revalidación antes de enviar y decisión explícita; incluye pendientes de sesiones hijas.

**Independent Test**: provocar una pregunta/permiso (en la sesión raíz y en una hija), responderla desde el chat de la sesión abierta y comprobar que el pendiente se resuelve y desaparece (FR-005, FR-006, FR-007, SC-002).

### Tests for User Story 3

- [X] T032 [P] [US3] Spec de las mutations de respuesta en `src/Infrastructure/Services/specs/session.write.service.spec.ts` (mapeo de decisión `once/always/reject`, `answer` por `field.key`, ids no vacíos; W5, W6) — primero debe fallar
- [X] T033 [P] [US3] Spec de la respuesta inline en `src/Application/Components/Molecules/specs/ChatPendingRequest.spec.tsx` (tipo de campo desconocido no rompe; W8, W10) — primero debe fallar

### Implementation for User Story 3

- [X] T034 [US3] Añadir `useReplyPermission` y `useReplyForm` en `src/Domains/Chat/Chat.service.ts`: usan el `sessionID` de **origen** del pendiente (hija incluida), revalidan que siga abierto y, tras responder, invalidan `permissions.list()`, `permissions.for(originId)` y `sessions.forms(originId)` (FR-005, FR-006, FR-007, FR-011)
- [X] T035 [P] [US3] Crear la molecule pura reusable `src/Application/Components/Molecules/ChatPendingRequest.tsx` (permiso: `once`/`always`/`reject` mostrando `action`/`resources[]` antes de confirmar; pregunta: formulario mínimo por tipo de campo) reusando los view-models de `src/Application/Helpers/questionState.ts` (FR-005, FR-017, FR-023)
- [X] T036 [US3] Extender en modo accionable (opt-in) `src/Domains/Inspector/Components/PermissionRow.tsx`, `QuestionRow.tsx` y `QuestionsSection.tsx` para consumir la molecule promovida **sin** importar componentes de `Domains/Chat`; extender `src/Domains/Inspector/Components/specs/QuestionsSection.spec.tsx`
- [X] T037 [US3] Componer la bandeja de pendientes en `src/Domains/Chat/Components/ChatPanel.tsx` y el data-fetching accionable (origen del subárbol, revalidación, aviso accesible ante pendiente ya resuelto, error de escritura conserva estado) desde `useChatController`/`src/Infrastructure/WorkspacePage.tsx`; extender `src/Domains/Chat/Components/specs/ChatPanel.spec.tsx` y `src/Application/Components/Molecules/specs/ChatComposer.spec.tsx` (W8, W9; FR-022)

**Checkpoint**: US1, US2 y US3 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Elegir agente, modelo y razonamiento antes de enviar (Priority: P2)

**Goal**: selectores de agente, modelo y variante de razonamiento (acotada al modelo); la selección se aplica antes del envío.

**Independent Test**: cambiar la selección y comprobar que el siguiente envío usa esa combinación y que el razonamiento se acota al modelo elegido (FR-008).

### Tests for User Story 4

- [X] T038 [P] [US4] Spec pura del catálogo en `src/Domains/Chat/lib/specs/mapModelOptions.spec.ts` (variantes del modelo; sin variantes → lista vacía; P6) — primero debe fallar
- [X] T039 [P] [US4] Spec de la aplicación de selección antes del envío en `src/Domains/Chat/Hooks/specs/useChatController.spec.tsx` (`switchAgent`/`switchModel` solo si cambió, antes de `prompt`; W7) — primero debe fallar

### Implementation for User Story 4

- [X] T040 [P] [US4] Implementar la función pura `mapModelOptions(models)` (`ModelInfo[]` → `TModelOption[]` + `TReasoningOption[]` desde `ModelInfo.variants`) en `src/Domains/Chat/lib/mapModelOptions.ts`
- [X] T041 [US4] Añadir a `src/Domains/Chat/Chat.service.ts` las queries `useModelOptions`/`useAgentOptions` y `useSetSelection` (`switchAgent`/`switchModel`)
- [X] T042 [US4] Sembrar la selección desde el nodo abierto y aplicarla antes del envío (si `isDirty`) en `src/Domains/Chat/Hooks/useChatController.ts` (FR-008)
- [X] T043 [P] [US4] Crear la molecule `src/Application/Components/Molecules/ChatSelector.tsx` (agente + modelo + razonamiento) con spec en `src/Application/Components/Molecules/specs/ChatSelector.spec.tsx` (P6)
- [X] T044 [US4] Montar `ChatSelector` en `ChatComposer.tsx`/`ChatPanel.tsx` y extender sus specs

**Checkpoint**: US4 añade valor sin romper US1–US3.

---

## Phase 7: User Story 5 - Ser avisado de un pendiente y llegar a él (Priority: P2)

**Goal**: derivar la atención del subárbol + permisos y montar las cinco señales (badge en sesión, badge en pestaña/tab Chat, banner, aviso efímero, realce del nodo), con navegación a la request origen y limpieza al resolverse.

**Independent Test**: provocar un pendiente en una sesión no enfocada y comprobar la señal (indicador, banner, aviso accesible) y que la acción lleva a la request origen (FR-009, FR-010, FR-011, SC-005).

### Tests for User Story 5

- [X] T045 [P] [US5] Spec pura de la derivación en `src/Domains/Chat/lib/specs/deriveAttention.spec.ts` (nodo `waiting-*` + `permissions.list()`; origen hija; vacío sin pendientes; A1–A3) — primero debe fallar
- [X] T046 [P] [US5] Spec del toast deduplicado en `src/Domains/Chat/Hooks/specs/useAttentionNotifications.spec.tsx` (A5) — primero debe fallar
- [X] T047 [P] [US5] Spec del realce por contexto sin relayout en `src/Domains/Graph/Components/specs/AgentNode.spec.tsx` (A6) — primero debe fallar

### Implementation for User Story 5

- [X] T048 [P] [US5] Implementar la función pura `deriveAttention(graph, permissions)` (`TAttentionItem[]` ordenado por `at`) en `src/Domains/Chat/lib/deriveAttention.ts`
- [X] T049 [US5] Implementar `useSessionAttention(rootId, graph)` en `src/Domains/Chat/Hooks/useSessionAttention.ts` con spec en `src/Domains/Chat/Hooks/specs/useSessionAttention.spec.tsx` (depende de T048)
- [X] T050 [P] [US5] Implementar `useAttentionNotifications` (toast `sonner` live region, dedupe por `item.id`) en `src/Domains/Chat/Hooks/useAttentionNotifications.ts`
- [X] T051 [P] [US5] Crear la molecule `src/Application/Components/Molecules/ChatAttentionBanner.tsx` (`Alert`, resumen + acción a la request) con spec en `src/Application/Components/Molecules/specs/ChatAttentionBanner.spec.tsx`
- [X] T052 [P] [US5] Añadir el badge de pendiente a `src/Domains/Sessions/Components/SessionCard.tsx` (`aria-label` textual, no solo color) con spec en `src/Domains/Sessions/Components/specs/SessionCard.spec.tsx`
- [X] T053 [US5] Añadir el badge a la pestaña Chat (desktop y tab móvil): extender `src/Infrastructure/Components/InspectorPane.tsx` y `src/Domains/Chat/Components/ChatPanel.tsx` (token ≥3:1 + marca no-color) con specs
- [X] T054 [US5] Extender `src/Domains/Graph/Components/NodeFocusContext.tsx` y `AgentNode.tsx` para realzar **solo** el nodo afectado vía **contexto** (sin tocar `data`, sin relayout)
- [X] T055 [US5] Cablear las señales y la navegación a la request origen (seleccionar sesión/nodo de origen + abrir Chat) en `src/Infrastructure/WorkspacePage.tsx` y `ChatPanel.tsx`; extender `src/Infrastructure/specs/WorkspacePage.spec.tsx` (FR-010; A7)

**Checkpoint**: US5 funcional de forma independiente; todas las señales se limpian al resolverse el pendiente.

---

## Phase 8: User Story 6 - Estado claro cuando el stream no llega (Priority: P3)

**Goal**: `ChatPanel` con estados error → carga → vacío → datos y aviso de desconexión del canal en vivo.

**Independent Test**: abrir la pestaña Chat en estados de carga, error y vacío, y simular el stream desconectado, comprobando el mensaje correspondiente (FR-012, P2, P3).

- [X] T056 [US6] Completar los estados de pantalla de `src/Domains/Chat/Components/ChatPanel.tsx` (`EmptyScreenError` → skeleton → `EmptyState` → datos) con spec en `src/Domains/Chat/Components/specs/ChatPanel.spec.tsx` (Principio VI; P2)
- [X] T057 [US6] Añadir el aviso de desconexión/reconexión al enviar usando `useEventStreamConnection`/estado de conexión en `ChatPanel.tsx` con spec (FR-012; P3)

**Checkpoint**: el chat comunica con claridad su estado de datos y de conexión.

---

## Phase 9: User Story 7 - Usar el chat en móvil como una vista propia (Priority: P3)

**Goal**: chat como destino de primer nivel en móvil (sin tabbars anidadas), una sola fuente de lógica, y borrador que sobrevive a cambio de vista/rotación.

**Independent Test**: en viewport móvil, abrir el chat desde la navegación principal, escribir algo, cambiar de vista y volver: el borrador sigue ahí (FR-013, FR-014, FR-015, SC-006, SC-007).

- [X] T058 [US7] Extender `src/Infrastructure/WorkspacePage.constants.ts`: `WORKSPACE_TABS = ['sessions','graph','inspector','chat']`
- [X] T059 [US7] Extender `src/Infrastructure/Components/WorkspaceMobileTabs.tsx` para renderizar `ChatPanel` como panel propio (sin tablist anidado) con spec en `src/Infrastructure/Components/specs/WorkspaceMobileTabs.spec.tsx` (FR-013; P4)
- [X] T060 [US7] Ajustar `src/Infrastructure/Components/WorkspaceLayout.tsx` para **no** montar el tablist interno Detalle|Chat en móvil y alimentar ambas presentaciones con `useChatController` (sin `md:hidden`); extender `src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx` (FR-014; P4)
- [X] T061 [US7] Verificar la supervivencia del borrador al remontaje del panel y a la rotación en `src/Domains/Chat/Hooks/specs/useChatDraft.spec.tsx` y `src/Domains/Chat/Components/specs/ChatPanel.spec.tsx` (FR-015; P5, SC-006)
- [X] T062 [US7] Coordinar `Escape` (fullscreen > composer) en `src/Infrastructure/WorkspacePage.tsx` con `useEscapeKey` sin cerrar fullscreen ni limpiar selección; extender `src/Infrastructure/specs/WorkspacePage.spec.tsx`

**Checkpoint**: todas las historias independientemente funcionales.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: accesibilidad WCAG 2.2 AA repo-wide (FR-021, SC-008), tokens/foco, documentación y validación final.

- [X] T063 [P] Corregir tokens en `src/index.css`: `--destructive` dark y `--status-idle` usados como texto con contraste ≥4.5:1 / ≥3:1 (FR-021)
- [X] T064 [P] Migrar el foco de `box-shadow`/`ring` a `outline` con `@media (forced-colors)` en `src/Application/Components/ui/{button,input,textarea,select,checkbox}.tsx`; spec/inspección (P8)
- [X] T065 [P] Fijar `theme="dark"` en `src/Application/Components/ui/sonner.tsx` (FR-021)
- [X] T066 [P] Añadir specs a11y de teclado/roles en `src/Domains/Chat/Components/specs` y `src/Application/Components/ui/specs` (`aria-busy` en Enviar/Detener, `role="status"` de inicio/fin de turno, tablist APG; P7)
- [X] T067 [P] Extraer y testear el guard de Origin/Referer del proxy en una función pura para endurecer `vite.config.ts` (H2, H3)
- [X] T068 [P] Verificar que la password nunca llega al bundle (`vite.config.ts` inyecta Basic server-side) y que `opencodeClient.spec.ts` sigue **sin cambios** (H5, W1)
- [X] T069 [P] Actualizar documentación de la feature (nota de limitación de cola con el TUI en paralelo, acceso solo loopback) en `specs/009-interactive-chat/quickstart.md` o `AGENTS.md` según corresponda
- [X] T070 Recorrer la validación manual de `specs/009-interactive-chat/quickstart.md §3` (US1–US7 + edge cases + a11y) y registrar evidencia de SC-001..SC-008

---

## Archivos compartidos

Archivos que **varias** historias tocan; sus tareas asociadas **no** llevan `[P]` entre sí y deben serializarse:

| Archivo | Historias | Nota |
|---------|-----------|------|
| `src/Domains/Chat/Chat.service.ts` | US1, US2, US3, US4 | Cada historia añade sus mutations/queries; se edita en orden de fase |
| `src/Domains/Chat/Components/ChatPanel.tsx` | US1, US3, US5, US6 | Orquestador base en US1; bandeja (US3), señales (US5) y estados (US6) lo extienden |
| `src/Domains/Chat/Components/specs/ChatPanel.spec.tsx` | US1, US3, US6, US7 | Spec acumulativa |
| `src/Domains/Chat/Hooks/useChatController.ts` | US1, US2, US4 | Timeline/envío + interrupción + selección |
| `src/Domains/queryKeys.ts` | todas (Setup) | `chatStream` + `models` una sola vez |
| `src/Domains/Graph/lib/eventReducer.ts` y `slices/ignored.ts` | Foundational (US1/US6) | Cambio aditivo único |
| `src/Infrastructure/Components/InspectorPane.tsx` | US1, US5 | Tabs (US1) + badge de pestaña (US5) |
| `src/Infrastructure/Components/WorkspaceLayout.tsx` | US1, US7 | Cableado desktop (US1) + ajuste móvil (US7) |
| `src/Infrastructure/WorkspacePage.tsx` | US1, US3, US5, US7 | Wiring cross-domain acumulativo |
| `src/Application/Components/Molecules/index.ts` | US1, US3, US4, US5 | Barrel; se extiende por historia |
| `src/Application/Components/Organisms/HistoryEntry/*` | US1 | `memo` una vez |
| `src/index.css` y `src/Application/Components/ui/*` | Polish | Correcciones repo-wide |

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup; **bloquea US1–US4** (la fachada de escritura y el buffer).
- **User Stories (Phase 3–9)**: dependen de Foundational. US5 (atención) y US7 (móvil) pueden avanzar con menor acoplamiento a la fachada, pero consumen `ChatPanel`/`useChatController` de US1.
- **Polish (Phase 10)**: depende de las historias deseadas (las correcciones a11y repo-wide pueden empezar antes, pero se cierran al final).

### User Story Dependencies

- **US1 (P1)**: tras Foundational; **sin** dependencia de otras historias (MVP).
- **US2 (P1)**: tras Foundational; independiente; complementa el composer de US1.
- **US3 (P1)**: tras Foundational; independiente; comparte `ChatPanel` con US1.
- **US4 (P2)**: tras Foundational; independiente; usa `useChatController` de US1.
- **US5 (P2)**: tras Foundational; independiente de las historias de escritura.
- **US6 (P3)**: tras US1 (extiende `ChatPanel`).
- **US7 (P3)**: tras US1 (reusa `ChatPanel`/`useChatController`).

### Within Each User Story

- Specs **antes** de la implementación (deben fallar primero).
- Puras → service/hooks → componentes → integración/wiring.
- Historia completa antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- Setup: T001–T007 en paralelo (archivos distintos).
- Foundational: T008, T009, T011 en paralelo; T010 y T012 dependen (T010 de T009; T012 de T011).
- US1: T013/T014 specs en paralelo; T015/T016 puras en paralelo; T020/T021 componentes en paralelo.
- US3: T032/T033 specs en paralelo; T035 molecule en paralelo con T034.
- US5: T045/T046/T047 specs en paralelo; T048/T050/T051/T052 en paralelo tras la spec.
- Polish: T063–T069 en paralelo (archivos distintos).

---

## Parallel Example: User Story 1

```bash
# Specs de US1 juntas:
Task: "Spec pura del buffer en src/Domains/Chat/lib/specs/mergeChatStream.spec.ts"
Task: "Spec pura de la proyección en src/Domains/Chat/lib/specs/buildChatTimeline.spec.ts"

# Puras de US1 juntas:
Task: "Implementar mergeChatStream en src/Domains/Chat/lib/mergeChatStream.ts"
Task: "Implementar buildChatTimeline en src/Domains/Chat/lib/buildChatTimeline.ts"

# Molecules de US1 juntas:
Task: "Crear ChatComposer en src/Application/Components/Molecules/ChatComposer.tsx"
Task: "Crear ChatTimeline en src/Domains/Chat/Components/ChatTimeline.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup).
2. Completar Phase 2 (Foundational — **crítico**, bloquea la escritura).
3. Completar Phase 3 (US1).
4. **PARAR y VALIDAR**: probar US1 de forma independiente (envío + streaming sin duplicar).
5. Desplegar/demo si está listo.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → demo (MVP).
3. US2 → validar → demo.
4. US3 → validar → demo.
5. US4, US5 → validar → demo.
6. US6, US7 → validar → demo.
7. Polish (a11y repo-wide) → validación final con `quickstart.md`.

### Parallel Team Strategy

1. El equipo completa Setup + Foundational.
2. Con la base lista:
   - Dev A: US1 → US6
   - Dev B: US2 → US3
   - Dev C: US4 → US5
   - Dev D (cuando US1 esté): US7
3. Cada historia se valida y se integra de forma independiente; el orquestador corre las verificaciones globales.

---

## Notes

- `[P]` = archivos distintos, sin dependencias.
- `[Story]` mapea cada tarea a su historia para trazabilidad.
- Escribir las specs **antes** de implementar (deben fallar primero).
- `opencodeClient.spec.ts` **no** debe cambiar (FR-016; W1).
- El grafo **no** se suscribe a `['chatStream', id]` (FR-016; SC-003).
- Evitar: tareas vagas, conflictos del mismo archivo sin serializar, dependencias cruzadas que rompan la independencia.

---

## Preguntas abiertas

- **P1**: ¿La verificación manual de `quickstart.md §3` (T070) se acepta como evidencia textual en `tasks.md`/PR, o el orquestador exige capturas? Recomendada: evidencia textual + capturas opcionales. Impacto: bajo (solo formato de cierre).
- **P2**: ¿El guard de Origin/Referer del proxy (T067) debe extraerse a un módulo testeable con Vitest, o basta la revisión manual (H2/H3) al no haber suite de `vite.config`? Recomendada: extraer función pura + spec acotada. Impacto: medio (cobertura de FR-018).
- **P3**: El realce del nodo (T054) toca `Domains/Graph`, fuera de alcance de otras features activas; ¿se confirma que no hay trabajo concurrente sobre `NodeFocusContext.tsx`/`AgentNode.tsx` que fuerce serialización? Recomendada: serializar con `sddorch` antes de implementar. Impacto: bajo (orden de ejecución).

---

## Phase 11: Convergence

**Propósito**: cerrar los huecos detectados al contrastar `spec.md`/`plan.md`/`tasks.md` con el código actual. Solo añade trabajo pendiente para `/speckit.implement`; no reescribe ni renumera tareas previas.

- [X] T072 [US5] Cablear el **realce del nodo afectado del grafo** (hoy `AgentNode` lee `useNodeAttention`, pero `useGraphFocusModel`/`AgentGraph`/`GraphPane`/`WorkspacePage` nunca aportan `attentionNodeIds`, así que el realce es siempre inerte): derivar el `Set` de `nodeId` de `useSessionAttention` y pasarlo por `GraphPane` → `AgentGraph` → `useGraphFocusModel` hasta `NodeFocusProvider`; extender `src/Infrastructure/specs/WorkspacePage.spec.tsx` y `src/Domains/Graph/Components/specs/AgentGraph.spec.tsx` per FR-009 (partial)
- [X] T073 [US5] Cablear el **badge de pendiente en la tarjeta de sesión** (hoy `SessionCard.attentionCount` existe pero nadie lo aporta): derivar la atención por cada **sesión raíz** del rail —no solo el subárbol abierto— y pasarla por `WorkspacePage` → `SessionsRail` → `SessionList` → `SessionCard`; extender `src/Domains/Sessions/Components/specs/SessionList.spec.tsx` y `src/Infrastructure/specs/WorkspacePage.spec.tsx` per FR-009 (partial)
- [X] T074 [US3] Hacer **accionables las preguntas de sesiones hijas** (hoy la bandeja solo compone `useSessionForms(id)` de la sesión abierta, así que una pregunta de una hija aparece en la atención pero no puede responderse): cargar/derivar los formularios del subárbol y componerlos con su `originSessionId` en `src/Infrastructure/WorkspacePage.tsx`/`src/Domains/Chat/Components/ChatPanel.tsx`; extender sus specs per FR-007 (partial)
- [X] T075 [US5] Añadir el **badge de atención al tab móvil Chat** (hoy `WorkspaceMobileTabs` renderiza la etiqueta del tab sin `ChatAttentionBadge`): montarlo con el conteo de `useSessionAttention` ya disponible en `WorkspacePage`; extender `src/Infrastructure/Components/specs/WorkspaceMobileTabs.spec.tsx` per FR-009 (partial)
- [X] T076 [US5] Al actuar sobre una señal de atención, **abrir el chat también en móvil** (hoy `handleGoToRequest` solo hace `setDetailTab(CHAT_TAB_ID)`, tablist de escritorio no montado en móvil): cambiar además el tab de workspace a `chat` y extender `src/Infrastructure/specs/WorkspacePage.spec.tsx` per FR-010 (partial)

---

## Phase 13: Verify fixes

- [X] T079 Corregir los fallos de `pnpm lint` (11) y `pnpm tsc` (7): imports sin usar en `opencodeClient.ts` (redundantes con el `export … from`), `Chat.service.ts` (`TModelOption`), `ChatComposer.spec.tsx` (`AGENTS`/`MODELS`/`EMPTY_SELECTION`), `InspectorPane.spec.tsx` (`act`); `react-hooks/refs` en `useChatController.ts` (ref en render); `set-state-in-effect`/`exhaustive-deps`/aserción innecesaria en `ChatPendingRequest.tsx` y `ChatPendingRequest.spec.tsx`

## Phase 12: Convergence

**Propósito**: cerrar el hueco detectado al contrastar `spec.md`/`plan.md`/`tasks.md` con el código actual (segundo ciclo). Solo añade trabajo pendiente para `/speckit.implement`; no reescribe ni renumera tareas previas.

- [X] T077 [US4] **Cablear el directorio del catálogo al panel de chat** (hoy `WorkspacePage` monta `<ChatPanel sessionId={id} …>` sin la prop `directory`, que ya calcula; `ChatPanel` la usa con valor por defecto `null`, así que `useModelOptions`/`useAgentOptions` quedan deshabilitadas por `enabled: Boolean(directory)` y `ChatSelector` no recibe agentes/modelos/razonamiento): pasar `directory={directory}` en `src/Infrastructure/WorkspacePage.tsx`; extender `src/Infrastructure/specs/WorkspacePage.spec.tsx` para aseverar que el panel recibe el directorio de la sesión per FR-008 (partial)
- [X] T078 [US4] **Sembrar la selección activa desde el nodo de la sesión abierta** (hoy `useChatController(sessionId, seed)` define el `seed`/`baseline`, pero `ChatPanel` lo invoca sin él y no expone prop alguna, así que el baseline queda siempre `{null,null}` y el selector no refleja el agente/modelo vigentes): derivar `{ agent: node.data.agentName, model: node.data.model }` del nodo con `data.sessionId === id` en `src/Infrastructure/WorkspacePage.tsx` y pasarlo a `ChatPanel`; extender sus specs per FR-008 y data-model §2.5 (partial)
