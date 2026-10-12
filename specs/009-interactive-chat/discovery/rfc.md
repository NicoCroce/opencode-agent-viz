# RFC — Chat interactivo por sesión (capa de escritura + streaming + atención)

> Decisión técnica con alternativas. Es entrada de `plan`; una vez que existe `plan.md`, manda este.

## Contexto
El visor consume `@opencode/client` en modo lectura: `opencodeClient.ts:23-34` compone interfaces `*ReadService` en `opencodeService` y un spec (`opencodeClient.spec.ts:11-44,56-60`) **blinda la fachada contra 25 nombres de escritura** (FR-016). El pipeline SSE (`EventStreamProvider.tsx:59-63` → `eventBatcher.ts:36-43`, flush ~100 ms = ~10/s → `applyReducedEvent.ts:27-44` → `eventReducer.ts:26-95`) hoy **descarta los deltas** de texto/razonamiento (`slices/ignored.ts:7-14`). No existe composer, ni `ui/tabs.tsx`, ni `useMutation` en el repo. El navegador no se autentica: el proxy `/oc` (`vite.config.ts:41-54`) inyecta Basic `opencode:<pass>` server-side (`vite.config.ts:15-18,49-51`); no valida Origin/Referer ni fija `server.host`. Pasar a escritura siempre activa convierte el acceso al dev server en ejecución en la máquina.

## Propuesta
1. **Capa de escritura hermana**: nuevo `session.write.service.ts` (prompt, interrupt, form.reply/cancel, permission.reply, switchAgent, switchModel) exportado como singleton hermano desde `opencodeClient.ts`, **sin tocar `opencodeService`**; validación runtime con **Zod** antes del SDK.
2. **Streaming**: quitar `session.text.delta`/`session.reasoning.delta` de `IGNORED_EVENT_TYPES` y añadir un slice `reduceChatStream` que escribe en una **clave raíz separada `['chatStream', id]`**. Durante el delta se renderiza **texto plano** etiquetado 'En curso'; al `*.ended` se usa `RichText` sobre la parte consolidada (`slices/messages.ts:64-86`). Un `useChatController` proyecta el timeline (`buildHistory` + buffer) y guarda el draft.
3. **Atención**: slice nuevo `attention` que combina el estado de nodo (waiting-input/permission) del subárbol con `permissions.list()`; alimenta badge en sesión y pestaña, banner (`Alert`), toast y pulso en el nodo afectado.
4. **UI**: pestañas Detalle|Chat con Radix Tabs (APG completo); en escritorio segmented control en la columna del detalle; en móvil `chat` como tab de primer nivel. **Bandeja de pendientes sobre el composer** (accionable, cubre subagentes) con `ChatInputRequest` **inline** y `ChatSelector`.
5. **Hardening dev server**: validar Origin/Referer en el proxy y forzar bind loopback (127.0.0.1 + guard); documentarlo en `start.sh`.

## Alternativas consideradas
| Alternativa | Pros | Contras | Descartada porque |
|---|---|---|---|
| Cuarta columna para el chat | Chat y detalle visibles a la vez | Rompe el layout de 3 columnas y el ancho (280-720 px) | Decisión cerrada: chat dentro del detalle |
| Chat por-agente/nodo | Contexto fino por subagente | Múltiples composers, estado cruzado | No-objetivo; el chat es de sesión `:id` |
| Toggle de escritura | "Seguridad" percibida | Fricción; no mitiga el vector real (dev server) | Se mitiga por hardening, no por toggle |
| `['sessions','stream',id]` (plan §2) | Consistencia de claves | `invalidateQueries(sessions.all)` (`EventStreamProvider.tsx:56`) pisa el buffer | Elegido: clave raíz `['chatStream',id]` |
| Buffer en store fuera de React Query | Sin invalidación por prefijo | Reimplementa caché/notificación | React Query ya resuelve el batch |
| `RichText` en vivo | Markdown en tiempo real | `react-markdown` re-parsea texto creciente ~10/s (`RichText.tsx:1-3,78`) | Riesgo de long tasks; elegido texto plano |
| Coalescing 200 ms por defecto | Menos renders | Optimización sin evidencia | Diferido hasta perfilar (`perf.ts`) |
| Ampliar `opencodeService` | Un solo objeto | Rompe `opencodeClient.spec.ts:56-60` (FR-016) | Elegido servicio hermano |
| `writeClient.ts` como fachada aparte | Aislamiento total | Duplica resolución de client/baseUrl | Elegido export hermano en `opencodeClient.ts` |
| RHF + Zod en el composer | Formularios complejos | Sin canon de RHF en repo | Elegido Zod local; menos superficie |
| Ampliar slices `messages`/`permissions` | Menos archivos | Acopla chat y grafo | Elegidos slices nuevos `attention`/`chatStream` |
| ToggleGroup para Detalle|Chat | Ya existe (`ui/toggle-group.tsx`) | Rol radiogroup/toolbar, no tablist | Elegido Radix Tabs (APG) |
| Indicador de tab `border-accent` | Coherente con `SessionCard` | ~1.1:1, solo color (1.4.1/1.4.11) | Elegido token ≥3:1 + marca no-color |
| Modal para responder | Reusa `ui/dialog.tsx` | Foco secuestrado, peor flujo inline | Elegido inline + foco + `role=status` |
| `aria-live` por delta | "Todo" anunciado | Spam a AT | Elegido anuncio solo inicio/fin |
| Corregir a11y solo en Chat | Cambio acotado | Deja deuda preexistente en el visor | Elegido repo-wide (tokens/foco) |
| Listar/cancelar inbox en v1 | No "perder" prompts | Amplía superficie | Diferido a v2 |

## Impacto por área
- **UX:** pestañas Detalle|Chat en la columna del detalle; en móvil `chat` top-level (4 tabs, `WorkspacePage.constants.ts:9`, `WorkspaceMobileTabs.tsx:32-47`). Timeline reusa `HistoryEntry` (franjas, full-width; cabe a 280 px). Bandeja de pendientes sobre el composer (la request de subagente **no** está en el timeline del root → región dedicada). Esc del composer no debe cerrar fullscreen (`WorkspacePage.tsx:90-98`).
- **Seguridad:** HIGH CSRF/Origin y HIGH exposición de red = ejecución local; controles: validar Origin/Referer + bind loopback (`vite.config.ts:41-54`, `scripts/start.sh:26-28,37-40`). Validación Zod de `text`/`decision`/ids; IDs de permiso/form **desde estado pendiente**, no del usuario; revalidar pendiente; invalidar queries tras responder. Preservar `rehype-sanitize` (`RichText.tsx:78`) y `QuestionBlock` (auto-escape); nunca `.innerHTML`. La password nunca al bundle.
- **Rendimiento:** 1 `setQueryData` por flush (~10/s) a `['chatStream',id]`, no por delta; el grafo no se suscribe a esa clave → sin relayout (Principio VII, `executionKey.ts:10-32`). Texto plano durante el delta evita re-parse de markdown; `memo` en timeline/`RichText` por `text`. Perfilar con `perf.ts` antes de coalescar (umbral: >8-16 ms/flush o ≥1 long task/s).
- **Calidad:** `reduceEvent` es compartido; cambios **aditivos** (no romper `eventReducer.spec.ts`). Sin canon de `useMutation` → patrón de args exactos + invalidación (`opencodeClient.spec.ts:145-150`). Test puro: selector de atención por subárbol, buffer de stream (merge/clear por `assistantMessageID:ordinal`), mapeo `ModelInfo.variants`→opciones; fixtures `run.v2.ndjson`. Casos borde: sesión vacía/grande, reconexión, fallo de mutation, subagente que pregunta, no duplicar tras `*.ended`, permiso ya resuelto.
- **Accesibilidad:** Radix Tabs con `role=tablist/tab/tabpanel` + `aria-controls` + flechas + roving tabindex (hoy el tablist móvil es APG incompleto, `WorkspaceMobileTabs.tsx:30-37`). Anuncio de stream solo inicio/fin (`role=status`); `aria-busy` en Enviar/Detener (0 ocurrencias hoy). Foco programático + `role=status` al aparecer el pendiente; badge con `aria-label`. Correcciones repo-wide: `--destructive` dark ~2:1 (`index.css:100`), `--status-idle` como texto ~4.07:1 (`:119`), foco por box-shadow invisible en forced-colors (`ui/button.tsx:8`, `ui/input.tsx:14`, `ui/textarea.tsx:14`, `ui/select.tsx:30`, `ui/checkbox.tsx:13`) → migrar a outline con `@media (forced-colors)`; fijar `theme="dark"` en `ui/sonner.tsx:7`.

## Conflictos entre áreas y resolución
- **Performance vs UX (clave del stream):** UX/plan usaban `sessions.stream(id)`; Performance advierte que `invalidateQueries(sessions.all)` por prefijo la pisaría. → Resuelto (`chat-stream-key`): **clave raíz `['chatStream', id]`**, fuera del prefijo `['sessions']`.
- **Seguridad vs UX (hardening):** Seguridad exige Origin/Referer + loopback; UX teme fricción y romper túneles/LAN. → Resuelto (`hardening-dev-server`): **se aplican ambos controles**; la fricción (no usar la web remota) se acepta y se documenta; sin toggle de escritura.
- **Accesibilidad vs alcance de producto (tokens/foco):** A11y pedía corregir todo el visor; UX acotaba al chat. → Resuelto (`a11y-repo-wide-tokens-focus`): **corrección repo-wide** por ser deuda preexistente que afecta a todo el visor.
- **Accesibilidad/UX vs diseño inline/modal:** A11y ofrecía modal (foco gestionado) o inline; UX prefería inline; Seguridad exige ver qué se autoriza. → Resuelto (`attention-and-input-request`): **inline** en región dedicada sobre el composer, con foco programático y `role=status`; el modal queda solo para confirmar interrupción (`AlertDialog`).
- **Performance vs UX (render en vivo):** Performance pedía texto plano; UX quería reusar `RichText` pero etiquetado "En curso". → Resuelto (`streaming-render`): **texto plano durante el delta**, `RichText` al `*.ended`; así se respeta FR-006 sin el hot spot.
- **Calidad vs UX/plan (slice y requests hijas):** plan sugería listar requests inline; UX advirtió que la request hija no está en el timeline del root. → Resuelto: **región dedicada** + slice `attention` nuevo; el `ChatInputRequest` usa el `sessionID` que generó la pregunta.
- **Calidad vs plan (fuente de atención):** doble fuente posible (estado de nodo vs `permissions.list()`). → Resuelto: slice `attention` **agrega** ambas; única fuente para badges.

## Archivos y contratos afectados
- `vite.config.ts` — validar Origin/Referer en `configure`; `server.host:'127.0.0.1'` + guard de remoteAddress.
- `scripts/start.sh` — loopback y documentación del riesgo.
- `src/Infrastructure/Services/opencodeClient.ts` — export hermano `sessionWriteService` (no tocar `opencodeService`).
- `src/Infrastructure/Services/session.write.service.ts` — **nuevo**: métodos de escritura + Zod.
- `src/Domains/queryKeys.ts` — añadir `chatStream`, `attention`, `models`.
- `src/Domains/Graph/lib/eventReduce/slices/{chatStream,attention}.ts` — **nuevos**; editar `ignored.ts`, `eventReducer.ts` (aditivo).
- `src/Domains/Chat/**` — **nuevo dominio** (entity/service/hooks/Components/Pages).
- `src/Domains/Inspector/Components/{QuestionsSection,PermissionRow,QuestionRow}.tsx` — variantes accionables/reuso.
- `src/Application/Components/ui/tabs.tsx` — **nuevo** (Radix Tabs); `ui/{button,input,textarea,select,checkbox}.tsx` — foco outline/forced-colors; `ui/sonner.tsx` — `theme="dark"`.
- `src/Application/Components/Molecules/*` y `Organisms/HistoryEntry/*` — `ChatComposer`, `ChatSelector`, `ChatInputRequest`, `ChatAttentionBanner`, `memo`.
- `src/Application/Hooks/useChatController` (+ `useDetailTabs`, `useSessionAttention`) — **nuevos**.
- `src/Infrastructure/Components/{WorkspaceLayout,WorkspaceMobileTabs,InspectorPane}.tsx`, `WorkspacePage.constants.ts` — pestañas y tab móvil.
- `src/index.css` — tokens `--destructive`/`--status-idle` y foco.
- `opencodeClient.spec.ts` — **sin cambios** (FR-016); nuevos specs en `Domains/Chat/specs` y `session.write.service.spec`.

## Riesgos
- Escritura siempre activa = ejecución local: **mitigación** hardening loopback + Origin/Referer (residual: aceptar la web en la máquina del operador).
- Desmontaje móvil pierde draft/scroll (`WorkspaceMobileTabs.tsx:49-53`): **mitigación** draft/scroll en `useChatController`.
- `reduceEvent` compartido con el grafo: **mitigación** slice aditivo + extender specs sin romperlos.
- `RichText` en vivo como hot spot: **mitigación** texto plano durante delta + `memo`.
- Interrupción poco descubrible: **mitigación** estado "generando…" y botón Detener en el mismo slot.
- Concurrencia con el TUI (prompt encolado sin aviso): **mitigación** documentar; inbox diferido a v2.
- `OPENCODE_URL` remoto filtraría las creds Basic: **mitigación** no soportar host remoto en `start.sh`.
- No duplicar texto tras `*.ended`: **mitigación** reemplazo por parte consolidada (`slices/messages.ts`).

## Decisiones
`sddorch/20261010-chat-interactivo/decision/{hardening-dev-server, chat-stream-key, chat-mobile-top-level-tab, a11y-repo-wide-tokens-focus, inbox-deferred-v2, write-facade-sibling, tabs-radix, streaming-render, composer-validation, attention-and-input-request}`

## Preguntas abiertas
- Orden/prioridad de señales de atención (pestaña + banner + toast + pulso): recomendada pestaña+banner+toast, pulso solo en el nodo afectado; impacto: carga visual.
- Confirmación explícita al autorizar permiso "siempre" (persistente): recomendada mostrar el recurso autorizado en el control; impacto: pasos y seguridad percibida.
- Umbral exacto de coalescing del stream: recomendado perfilar primero; impacto: rendimiento bajo texto largo.
