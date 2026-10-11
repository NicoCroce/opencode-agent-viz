# Implementation Plan: Chat interactivo por sesión

**Branch**: `009-interactive-chat` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-interactive-chat/spec.md` (+ [discovery/rfc.md](./discovery/rfc.md) y [discovery/prd.md](./discovery/prd.md))

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Llevar el visor de **solo lectura** a **modo interactivo** sobre una sola superficie: la columna del detalle. La feature añade, sin salir de la web:

1. **Composer y streaming** (US1): enviar un prompt a la sesión abierta y ver la respuesta **progresivamente** ("En curso"), consolidada sin duplicarse al cerrar el turno.
2. **Interrupción** (US2): detener el turno en curso de la sesión abierta (sin tocar subagentes), con estado de carga en el control.
3. **Responder preguntas y permisos** (US3), incluidas las generadas por **sesiones hijas**: bandeja de pendientes sobre el composer, respuesta **inline**, revalidación del pendiente antes de enviar.
4. **Selectores de agente, modelo y razonamiento** (US4): la variante de razonamiento proviene del modelo elegido.
5. **Señal de atención** (US5): badge en sesión y pestaña Chat, banner, aviso efímero accesible, realce del nodo afectado y navegación a la request origen.
6. **Estados de pantalla y móvil** (US6/US7): error→carga→vacío→datos + aviso de desconexión; en móvil el chat es un destino de primer nivel; el borrador sobrevive.

El enfoque técnico evita las trampas de recon y se apoya en el SDK **V2** ya instalado (`@opencode/client` 2.0.22), que **sí expone** las operaciones de escritura:

- **Capa de escritura hermana**: nuevo `session.write.service.ts` exportado como singleton hermano de `opencodeService` desde `opencodeClient.ts` (no se toca `opencodeService`, que sigue blindado contra nombres de escritura en `opencodeClient.spec.ts`). Validación runtime con **Zod** antes del SDK.
- **Streaming en clave raíz separada** `['chatStream', id]` (fuera de `['sessions']`, que `EventStreamProvider` invalida por prefijo en reconexión): se dejan de ignorar `session.text.delta`/`session.reasoning.delta`, un slice nuevo acumula el buffer y la proyección deduplica contra la parte consolidada del histórico. Texto plano durante el delta (sin re-parse de markdown ~10/s); `RichText` al consolidar.
- **Atención derivada**: un **selector puro** combina el estado del subárbol (`waiting-input`/`waiting-permission`) con `permissions.list()` (única fuente para badges/banner/toast/pulso).
- **Cola nativa**: el SDK acepta `delivery: 'steer' | 'queue'` en el prompt; FR-020 (encolar mientras el agente trabaja) se resuelve pidiendo `queue` cuando la sesión está ocupada, sin inbox propio (diferido a v2).
- **Endurecimiento del dev server**: validar Origin/Referer y forzar loopback, porque pasar a escritura convierte el acceso al dev server en ejecución en la máquina (FR-018).
- **A11y repo-wide**: tokens `--destructive`/`--status-idle` y foco `outline` con `@media (forced-colors)`; Radix Tabs (APG) para Detalle|Chat; sonner `theme="dark"`.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict`) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4 + shadcn/ui (Radix, incluye `@radix-ui/react-tabs`), `@xyflow/react` 12 + `@dagrejs/dagre`, `lucide-react`, `sonner` 2, `react-markdown` + `rehype-sanitize`, `@opencode/client` 2.0.22, **`zod` 4 (ya presente)**. **No se añaden dependencias**: todas las piezas (Tabs, Toaster, Zod, markdown saneado) ya están instaladas.

**Storage**: `localStorage` para **una** preferencia de UI: el borrador del compositor por sesión (`chat.draft.<sessionId>`), que sobrevive al cambio de pestaña/vista y a la rotación (FR-015). El resto es estado de vista en memoria (TanStack Query + estado local). La **escritura** va dirigida al agente vía el servidor de OpenCode; **no** muta datos propios del visor (Principio I enmendado).

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII); `renderWithProviders` / `QueryClientProvider` para hooks y componentes; fixtures de eventos reales (`src/Domains/Graph/lib/__fixtures__/run.ndjson`); tests **puros** para el buffer de stream, la proyección del timeline, la derivación de atención, el mapa de modelos→razonamiento y los esquemas Zod.

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil, igual que el resto de la app.

**Project Type**: Aplicación web single-page (solo frontend; el backend es el servidor de OpenCode existente, ahora con operaciones de escritura **dirigidas al agente**).

**Performance Goals**: SC-003 — la recepción de texto en vivo **no** reposiciona el grafo (el grafo no se suscribe a `['chatStream', id]`; mismo principio que `executionKey`): **0 relayouts** durante un turno. SC-004 — el primer texto se percibe inmediato (un `setQueryData` por flush ~10/s, no por delta). Durante el delta se renderiza **texto plano** para evitar el hot spot de `react-markdown` sobre texto creciente. Se perfila con `perf`/DevTools antes de añadir coalescing (umbral acordado: >8-16 ms/flush o ≥1 long task/s).

**Constraints**: SDK **solo** desde `*.service.ts` y datos vía hooks (Principio III); tipos con prefijo `T` (Principio IV); lógica de negocio en hooks/funciones puras, **no** en componentes (AGENTS §4); orden error→carga→vacío→datos (Principio VI); el grafo ignora deltas y no se re-layouta (Principio VII); escritura dirigida al agente, sin mutar datos del visor, y acceso al dev server restringido (Principio I); `Container`/tokens en vez de `div`/hex (AGENTS §8); una sola fuente de lógica, dos presentaciones (AGENTS §9); validación de entrada con Zod (AGENTS §10); WCAG 2.2 AA en los flujos principales (FR-021, SC-008).

**Scale/Scope**: una sesión raíz abierta a la vez y su subárbol (típico ~50 nodos, techo ~150-200). Dominios tocados: **Chat** (nuevo), `Domains/Graph` (slices `chatStream`, realce por contexto, sin tocar layout/plan), `Domains/Inspector` (reuso accionable de preguntas/permisos), `Domains/Sessions` (badge en la tarjeta), `Infrastructure` (servicio de escritura, layout/pestañas, hardening), `Application` (composer/selectores/banner, tabs, tokens/foco). Sin cambios de contrato del SDK ni del batching SSE.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador **con modo interactivo** | ✅ PASS | La escritura (`prompt`/`interrupt`/`form.reply`/`permission.reply`/`switchAgent`/`switchModel`) se **dirige al agente** y no muta datos propios del visor. El acceso queda restringido: bind loopback (`server.host`) + validación Origin/Referer en el proxy y en `scripts/start.sh` (FR-018); no se expone a la red. Sin toggle de escritura (decisión `hardening-dev-server`). |
| II | Arquitectura por dominios funcionales | ✅ PASS | El chat y la atención son un **dominio nuevo** `Domains/Chat/**` (entity/service/routes/Hooks/Components). El buffer de stream es un **slice aditivo** del reducer compartido (`Domains/Graph/lib/eventReduce`). El reuso accionable de preguntas/permisos vive en `Domains/Inspector`. El cableado cross-domain queda en `Infrastructure/WorkspacePage` y en hooks. Sin imports de componentes de otro dominio desde un componente. |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | Las escrituras pasan por `session.write.service.ts` (hermano de `opencodeService`), nunca desde componentes. Las lecturas nuevas (`model.list`, `agent.list`, `permission.list`, `form.list`) siguen por hooks de dominio. El borrador en `localStorage` es preferencia local, no dato de servidor. |
| IV | Tipos derivados del SDK | ✅ PASS | Los datos crudos siguen siendo tipos del SDK (`ModelInfo`, `ModelVariant`, `AgentInfo`, `FormInfo`/`FormDetail`, `PermissionRequest`, `SessionStatus`). Los nuevos son **view-models** con prefijo `T` (`TChatTimelineEntry`, `TChatStreamBuffer`, `TAttentionItem`, `TModelOption`, `TAgentOption`, `TChatSelection`). No se redefine nada del SDK. |
| V | Lógica pura y testeable | ✅ PASS | Puras: `mergeChatStream` (buffer), `buildChatTimeline` (proyección+dedupe), `deriveAttention` (subárbol + permisos), `mapModelOptions` (variantes→opciones) y los esquemas Zod. Se testean sin React con fixtures de eventos reales. |
| VI | Estados de pantalla obligatorios | ✅ PASS | `ChatPanel` renderiza error→carga→vacío→datos y expone el estado de conexión (`useEventStream`) para avisar cuando el stream no llega (FR-012); no duplica la lógica de estados del resto del visor. |
| VII | Rendimiento en tiempo real | ✅ PASS | El buffer vive en clave raíz `['chatStream', id]` (fuera de `['sessions']`), con **un** `setQueryData` por flush (~10/s); el grafo **no** se suscribe a esa clave ni reacciona a los deltas → sin relayout (FR-016, SC-003). Texto plano durante el delta; el batching SSE no cambia. |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint/TypeScript strict; sin dependencias nuevas; tokens en vez de hex; validación de entrada con Zod. |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere *Complexity Tracking*.

**Re-check post-diseño (Phase 1)**: 8/8 PASS. Los contratos confirman: escritura al agente con acceso restringido (I); dominio `Chat` nuevo + slice aditivo en `Graph` + reuso en `Inspector` (II); SDK solo desde services y borrador en `localStorage` (III); view-models `T` sobre tipos del SDK (IV); cinco piezas puras con specs propias (V); estados de pantalla y conexión explícitos (VI); clave raíz separada y sin relayout (VII); specs junto al código y Zod (VIII). Las salvaguardas explícitas del recon son: (a) `['chatStream', id]` fuera del prefijo `['sessions']`; (b) texto plano durante el delta + `memo`; (c) `permission.reply`/`form.reply` revalidan el pendiente; (d) el realce del nodo fluye por **contexto**, no por `data`, para no alterar la identidad de render.

**Nota fuera de alcance (D1)**: como en 006/007/008, la Constitución (Principios II/IV) menciona la carpeta `entity/` y el paquete `@opencode-ai/sdk`, mientras el repositorio usa `lib/` y `@opencode/client`. Deriva **preexistente** y ajena a esta feature; no se corrige aquí.

## Project Structure

### Documentation (this feature)

```text
specs/009-interactive-chat/
├── plan.md              # This file (/speckit.plan command output)
├── discovery/
│   ├── prd.md           # Entrada de specify (ya existe)
│   └── rfc.md           # Propuesta técnica (entrada de plan, ya existe)
├── research.md          # Phase 0 output (decisiones técnicas resueltas)
├── data-model.md        # Phase 1 output (view-models y reglas)
├── quickstart.md        # Phase 1 output (guía de validación end-to-end)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output
│   ├── README.md
│   ├── write-facade-contract.md
│   ├── chat-stream-contract.md
│   ├── attention-contract.md
│   ├── chat-panel-contract.md
│   └── dev-server-hardening-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.css                                   # (ajustar) tokens --destructive dark + --status-idle como texto; foco no-color
│
├── Application/
│   ├── Components/
│   │   ├── Molecules/
│   │   │   ├── ChatComposer.tsx                # NUEVO composer (textarea + Enviar/Detener + IME)
│   │   │   ├── ChatSelector.tsx                # NUEVO selector agente/modelo/razonamiento
│   │   │   ├── ChatPendingRequest.tsx          # NUEVO pendiente accionable inline (permiso/form)
│   │   │   ├── ChatAttentionBanner.tsx         # NUEVO banner en el panel (Alert)
│   │   │   ├── index.ts                        # (extender) barrel
│   │   │   └── specs/                          # NUEVO specs de molecules
│   │   ├── Organisms/HistoryEntry/
│   │   │   ├── HistoryEntry.tsx                # (ajustar) memo; reuso como franja del chat
│   │   │   └── HistoryEntryBody.tsx            # (ajustar) memo
│   │   └── ui/
│   │       ├── tabs.tsx                        # (existe) Radix Tabs — se consume, no se crea
│   │       ├── sonner.tsx                      # (ajustar) theme="dark" fijo (FR-021)
│   │       ├── button.tsx / input.tsx / textarea.tsx / select.tsx / checkbox.tsx
│   │       │                                   # (ajustar) foco `outline` + @media (forced-colors)
│   │       └── specs/                          # (extender) foco/tabs/sonner
│   ├── Hooks/
│   │   ├── useEscapeKey.ts                     # (reusar) prioridad fullscreen > composer
│   │   └── index.ts
│   └── Helpers/
│       └── (reuso) questionState.ts            # view-models de pregunta compartidos
│
├── Domains/
│   ├── queryKeys.ts                            # (extender) chatStream, models; reuso permissions/sessions.forms
│   │
│   ├── Chat/                                    # NUEVO dominio
│   │   ├── Chat.entity.ts                       # TChatTimelineEntry, TChatStreamBuffer, TAttentionItem, TModelOption, TAgentOption, TChatSelection
│   │   ├── Chat.service.ts                      # mutations (useSendPrompt/useInterrupt/useReplyPermission/useReplyForm/useSetSelection) + queries (useModelOptions/useAgentOptions)
│   │   ├── chat.routes.ts                       # constantes de rutas del chat (destino de primer nivel)
│   │   ├── lib/
│   │   │   ├── mergeChatStream.ts               # NUEVO (puro) upsert del buffer por messageId:ordinal
│   │   │   ├── buildChatTimeline.ts             # NUEVO (puro) historial + buffer → timeline sin duplicar
│   │   │   ├── deriveAttention.ts               # NUEVO (puro) nodos waiting-* + permissions.list() → pendientes
│   │   │   ├── mapModelOptions.ts               # NUEVO (puro) ModelInfo.variants → opciones de razonamiento
│   │   │   ├── schemas.ts                        # NUEVO esquemas Zod (texto, decisión, respuesta/ids, selección)
│   │   │   └── specs/                            # NUEVO specs puros
│   │   ├── Hooks/
│   │   │   ├── useChatController.ts              # NUEVO timeline + envío + interrupción + delivery
│   │   │   ├── useChatDraft.ts                   # NUEVO borrador persistido por sesión (localStorage)
│   │   │   ├── useSessionAttention.ts            # NUEVO selector de atención del subárbol
│   │   │   ├── useAttentionNotifications.ts      # NUEVO toast accesible ante pendiente nuevo
│   │   │   └── specs/                            # NUEVO specs de hooks
│   │   ├── Components/
│   │   │   ├── ChatPanel.tsx                     # NUEVO orquestador (estados + bandeja + timeline + composer)
│   │   │   ├── ChatTimeline.tsx                  # NUEVO timeline reusando HistoryEntry
│   │   │   └── specs/                            # NUEVO specs de componentes
│   │   └── index.ts                              # NUEVO barrel
│   │
│   ├── Graph/
│   │   ├── lib/eventReduce/
│   │   │   ├── slices/
│   │   │   │   ├── chatStream.ts                 # NUEVO slice (deltas → ['chatStream', id])
│   │   │   │   └── ignored.ts                    # (ajustar) dejar de ignorar text/reasoning delta
│   │   │   ├── eventReducer.ts                   # (ajustar, aditivo) ruta de deltas → chatStream
│   │   │   └── specs/
│   │   │       ├── chatStream.spec.ts            # NUEVO
│   │   │       └── eventReducer.spec.ts          # (extender) deltas ya no ignorados; sin romper el resto
│   │   └── Components/
│   │       ├── NodeFocusContext.tsx              # (extender) ids con pendiente para realce (sin tocar data)
│   │       ├── AgentNode.tsx                     # (extender) lee realce de atención del contexto
│   │       └── specs/                            # (extender) realce sin relayout
│   │
│   ├── Inspector/
│   │   └── Components/
│   │       ├── QuestionsSection.tsx              # (extender) modo accionable (opt-in) reusado por el chat
│   │       ├── PermissionRow.tsx                 # (extender) decisiones (una vez/siempre/rechazar)
│   │       ├── QuestionRow.tsx                    # (extender) formulario inline
│   │       └── specs/                            # (extender)
│   │
│   └── Sessions/
│       ├── Components/SessionCard.tsx            # (extender) badge de pendiente (atención)
│       └── specs/                                # (extender)
│
└── Infrastructure/
    ├── Services/
    │   ├── opencodeClient.ts                     # (extender) export hermano sessionWriteService (no toca opencodeService)
    │   ├── session.write.service.ts              # NUEVO (prompt/interrupt/form.reply/permission.reply/switch*) + Zod
    │   ├── catalog.service.ts                    # (extender) listModels/getDefaultModel
    │   └── specs/
    │       ├── session.write.service.spec.ts     # NUEVO
    │       └── opencodeClient.spec.ts            # SIN cambios (FR-016; blindaje intacto)
    ├── Components/
    │   ├── WorkspaceLayout.tsx                   # (extender) pestañas Detalle|Chat en el detalle (desktop) + nodo chat (móvil)
    │   ├── WorkspaceMobileTabs.tsx               # (extender) 4º tab 'chat' de primer nivel
    │   ├── InspectorPane.tsx                     # (extender) hospeda las pestañas desktop
    │   └── specs/                                # (extender) pestañas y móvil
    ├── Hooks/
    │   ├── useDetailTabs.ts                      # NUEVO estado/tablist de Detalle|Chat (desktop)
    │   └── specs/                                # NUEVO
    ├── WorkspacePage.tsx                         # (extender) cablea Chat + atención + Escape del composer
    ├── WorkspacePage.constants.ts                # (extender) WORKSPACE_TABS con 'chat'
    └── specs/                                    # (extender) wiring de chat/atención
```

Hardening (raíz del repo):

```text
vite.config.ts                                   # (ajustar) server.host='127.0.0.1' + guard remoteAddress + validar Origin/Referer en configure
scripts/start.sh                                 # (ajustar) forzar loopback y documentar el riesgo (no soportar host remoto)
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding `entity/service/routes/Hooks/Components/index` de `AGENTS.md`. La feature se reparte por responsabilidad: (a) **Chat** es un dominio nuevo porque la escritura, el streaming proyectado, la atención y los selectores forman una superficie propia que no pertenece a Graph ni a Inspector; (b) **Graph** solo recibe un **slice aditivo** (`chatStream`) en el reducer compartido y un realce por **contexto** (para no alterar la identidad de render ni relayout); (c) **Inspector** aporta las piezas de pregunta/permiso en modo accionable; el chat **no** importa `@app/Domains/Inspector` desde sus componentes: la UI reutilizable se promueve a una molecule en `Application/Components` y el data-fetching accionable se compone desde `Infrastructure` (WorkspacePage) vía hooks (ver *Notas de la compuerta plan-check* §1); (d) **Sessions** muestra el badge de atención en la tarjeta; (e) **Infrastructure** posee el servicio de escritura, las pestañas y el wiring; (f) **Application** aporta las molecules de chat, los tabs compartidos y las correcciones de tokens/foco. El borrador y la pestaña activa se cablean en `WorkspacePage`/hooks, no en componentes de presentación.

**Nota sobre la fábrica de escritura**: `sessionWriteService` es un **export hermano** en `opencodeClient.ts` (no se fusiona en `opencodeService`), para preservar el blindaje `opencodeClient.spec.ts` (FR-016) y separar el acceso de escritura. La password nunca viaja al bundle: la inyecta el proxy `/oc` server-side.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Notas de la compuerta plan-check

Cierra tres riesgos 🟡 de documentación señalados por la compuerta, sin alterar el resto del plan.

### 1. Punto de composición cross-domain (Principio II)

- **Ningún componente de `Domains/Chat` importa `@app/Domains/Inspector`** (ni al revés). El encapsulamiento por dominio se mantiene (AGENTS §8.3): el reuso de preguntas/permisos **no** es un import de componente a componente.
- La **UI reutilizable** (`PermissionRow`/`QuestionRow` en modo accionable) se promueve a una **molecule en `Application/Components`** (presentación pura, sin service de dominio) y es consumida por `ChatPendingRequest` y por `QuestionsSection` por igual.
- El **data-fetching** accionable y el wiring cross-domain (leer el pendiente del subárbol, responder con el `sessionID` de origen, invalidar tras responder) se componen desde **`Infrastructure/WorkspacePage` o vía hooks** de `Infrastructure`/`Domains/Chat`, nunca desde un componente de otro dominio.
- Con esto se afina la formulación previa ("Inspector reusado por el chat"): lo que se reusa es la **presentación pura** y los **view-models** (`Application/Helpers/questionState`), **no** componentes ni services de `Domains/Inspector`.

### 2. "Modo interactivo habilitado" = always-on (Principio I)

- La lectura "always-on" de "modo interactivo habilitado" es la **correcta y deliberada**: la escritura está **siempre activa** (no hay toggle), como fija el PRD/spec (no-objetivo "sin toggle de escritura").
- Esa decisión **satisface** el Principio I (no lo reinterpreta) porque va acompañada de su compensación explícita: el **hardening del dev server FR-018** (bind loopback + validación Origin/Referer) y la invariante "la escritura se dirige al agente y **nunca** muta datos propios del visor". El principio se cumple por **control de acceso**, no por un interruptor de escritura.

### 3. Excepción de scaffolding del dominio `Chat` (Principio II)

- `Domains/Chat` **no define `router.tsx` ni `Pages/`** (solo `chat.routes.ts` para constantes de rutas, si aplica). El chat es un **panel/pestaña dentro de la columna del detalle** (desktop) y un **tab de primer nivel del workspace** (móvil), **no** una ruta propia.
- La excepción es **coherente con `Inspector`**, que tampoco tiene `router.tsx` ni `Pages/` por la misma razón (panel sin ruta). El scaffolding `entity/service/routes/Hooks/Components/index` se aplica en todo lo demás; `router.tsx`/`Pages` solo existen en dominios con ruta propia (p. ej. `Sessions`).
