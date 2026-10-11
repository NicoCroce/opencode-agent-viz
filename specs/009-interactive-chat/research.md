# Research — Chat interactivo por sesión

**Feature**: `009-interactive-chat`
**Date**: 2026-10-10
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [discovery/rfc.md](./discovery/rfc.md), [discovery/prd.md](./discovery/prd.md)

La spec está cerrada con clarificaciones (checklist de requisitos al 100 %): **no quedan `NEEDS CLARIFICATION`**. Este documento resuelve las decisiones técnicas de implementación apoyándose en el código existente y en las operaciones que **sí** expone `@opencode/client` 2.0.22. **No se añaden dependencias** (Tabs, Toaster, Zod y markdown saneado ya están instalados). El contrato del SDK no cambia: solo se **empiezan a usar** sus métodos de escritura desde una fachada nueva.

---

## Diagnóstico verificado (base de las decisiones)

1. **La fachada de lectura está blindada** — `opencodeClient.ts:23-34` compone `opencodeService` con interfaces `*ReadService`, y `opencodeClient.spec.ts:12-44` prohíbe 25 nombres de escritura (`prompt`, `abort`, `interrupt`, `respondPermission`, `formReply`, …). Cualquier intento de ampliar `opencodeService` rompe esos specs → la escritura va en una **fachada hermana**.
2. **El reducer descarta los deltas** — `eventReduce/slices/ignored.ts:7-14` incluye `session.text.delta` y `session.reasoning.delta`; `eventReducer.ts:69-75` los enruta a `reduceIgnored` (devuelve `null`). Para el streaming hay que **dejar de ignorarlos** y darles un slice propio.
3. **La invalidación por prefijo pisa el buffer** — `EventStreamProvider.tsx:56` hace `invalidateQueries({ queryKey: queryKeys.sessions.all })` al reconectar. Una clave `['sessions', 'stream', id]` se perdería; por eso el buffer vive en **clave raíz separada** `['chatStream', id]`.
4. **El reducer de mensajes ya consolida** — `slices/messages.ts:64-86` maneja `session.text.ended`/`reasoning.ended` con `upsertContentPart(prev, assistantMessageID, ordinal, part)`, y `slices/messages.ts:35-52` maneja `session.step.started/ended/failed`. El chat **no** necesita reimplementar la consolidación: solo proyectar sobre ella.
5. **El SDK V2 sí tiene escritura** — `client.d.ts` expone `session.prompt` (`SessionPromptInput` con `text.delivery: 'steer' | 'queue'`), `session.interrupt` (`SessionInterruptResponse = { interrupted: boolean }`), `session.form.reply`/`cancel`, `permission.reply` (`decision: 'once' | 'always' | 'reject'`), `session.switchAgent`, `session.switchModel`, `model.list` (`ModelInfo.variants: ModelVariant[]`) y `agent.list` (`AgentInfo[]`). **Toda la superficie funcional que pide la spec existe y se puede usar sin inventar endpoints.**
6. **La atención ya está casi reducida** — `slices/permissions.ts:16-28` mantiene **global** `permissions.list()` con `upsertPermission`/`removePermission` (incluye permisos de sesiones hijas, porque el evento trae `sessionID`). `slices/formsInbox.ts:31-38` invalida `sessions.forms(id)` en `form.created/replied/cancelled`. Los estados `waiting-input`/`waiting-permission` se derivan del subárbol (`TNodeStatus`, `nodeStatus.ts`).
7. **No hay `useMutation` en el repo** — el canon vigente es "args exactos + invalidación" (`opencodeClient.spec.ts:145-150`). El chat introduce las primeras mutations; se sigue ese canon.
8. **El texto en vivo como hot spot** — `RichText` usa `react-markdown` (`RichText.tsx`); re-parsear texto creciente ~10/s arriesga long tasks. El delta se pinta en **texto plano**.
9. **El desmontaje móvil pierde estado** — `WorkspaceMobileTabs.tsx:49-53` renderiza solo el panel activo (los demás se desmontan). El borrador debe sobrevivir al cambio de tab → persistencia por sesión.
10. **El dev server no se autentica en el browser** — `vite.config.ts:41-54` inyecta Basic `opencode:<pass>` server-side; no fija `server.host` ni valida `Origin`/`Referer`. Con escritura activa esto equivale a ejecución local: hay que endurecerlo.

---

## R1. Capa de escritura hermana + validación Zod (US1/US2/US3 · FR-001/F004/F005/F006/F019/F022 · Principio I/III)

**Decision**: Nuevo `Infrastructure/Services/session.write.service.ts` que exporta `sessionWriteService`, compuesto como **singleton hermano** en `opencodeClient.ts` (sin tocar `opencodeService`):

```ts
// Infrastructure/Services/session.write.service.ts
export interface SessionWriteService {
  sendPrompt(input: TSendPromptInput): Promise<SessionInboxUser>;
  interruptSession(sessionID: string): Promise<SessionInterruptResponse>;
  replyPermission(input: TReplyPermissionInput): Promise<void>;
  replyForm(input: TReplyFormInput): Promise<void>;
  switchAgent(sessionID: string, agent: string): Promise<void>;
  switchModel(sessionID: string, model: ModelRef): Promise<void>;
}
```

- Cada método **valida con Zod** su entrada (`lib/schemas.ts`) **antes** de llamar al SDK; un fallo de validación lanza un error tipado `TChatWriteError` y **no** toca la red (FR-019).
- Las llamadas usan exactamente los métodos del SDK: `session.prompt`, `session.interrupt`, `session.form.reply`, `permission.reply`, `session.switchAgent`, `session.switchModel`.
- Los **ids** de permiso/form provienen del **estado pendiente** reducido (no de texto libre del usuario); el `sessionID` que se usa para responder un pendiente es **el que generó la pregunta** (sesión hija incluida), no el de la sesión abierta (FR-007).
- Tras responder, las mutations **invalidan** `permissions.list()`, `permissions.for(originId)` y `sessions.forms(originId)` para que el pendiente desaparezca de forma fiable (FR-011).

**Rationale**:
- Preserva el blindaje `opencodeClient.spec.ts` (FR-016): `opencodeService` sigue sin nombres de escritura.
- Zod es la herramienta ya exigida por AGENTS §10; valida texto no vacío, decisión de permiso y selección de modelo (FR-019).
- Aislar la escritura en un servicio hace que los componentes/hook no conozcan el SDK (Principio III) y que el test de la fachada sea directo (spies sobre `opencodeClient.*`, como el canon existente).

**Alternatives considered**:
- **Ampliar `opencodeService`**: descartado; rompe `opencodeClient.spec.ts:56-60` (FR-016).
- **`writeClient.ts` como fachada aparte con su propio `baseUrl`**: descartado; duplica la resolución del client (`client.ts`) y el manejo del proxy.
- **Validar en el componente/hook con `useState`**: descartado; la validación de entrada de usuario es lógica de negocio (AGENTS §4) y debe ser testable pura.

---

## R2. Streaming del chat: clave raíz separada + texto plano durante el delta + dedupe (US1/US6 · FR-002/F003/F012/F016 · SC-003/SC-004 · Principio VII)

**Decision**: Un slice aditivo `chatStream` acumula los deltas en la clave raíz **`['chatStream', id]`** y la proyección deduplica contra la parte consolidada del histórico:

- `queryKeys.chatStream.for(id)` = `['chatStream', id]` (raíz propia, **fuera** de `['sessions']`).
- `slices/ignored.ts` deja de incluir `session.text.delta` y `session.reasoning.delta` (se conservan `tool.input.delta`, `tool.progress`, `compaction.delta` como ignorados).
- `slices/chatStream.ts` (nuevo) maneja **solo** los dos deltas: mantiene por sesión `{ assistantMessageID, parts: Record<ordinal, { kind: 'text'|'reasoning'; text: string }> }`. En cada delta, si `assistantMessageID` cambia **resetea** el buffer (acota memoria a un único mensaje en curso) y, si no, **upsertea** el ordinal concatenando. `eventReducer.ts` enruta los deltas a este slice (cambio **aditivo**).
- `lib/buildChatTimeline.ts` (puro) combina el histórico (`buildHistory(messages)`) con el buffer:
  - una parte del buffer cuyo clave `assistantMessageID:ordinal` **ya existe consolidada** en el histórico se **descarta** (evita duplicar tras `*.ended`);
  - las partes del buffer sin consolidar se agregan al final como entradas **provisionales** con `isComplete: false` y etiqueta "En curso".
- Presentación: durante el delta, el timeline pinta **texto plano** (sin markdown); al consolidarse, el histórico ya entrega el `THistoryEntry` con `RichText`. Se aplica `memo` a `HistoryEntry`/`HistoryEntryBody`/timeline.
- **Un `setQueryData` por flush** (~10/s, el `eventBatcher` ya agrupa), no por delta.

**Rationale**:
- La clave raíz separada evita que la invalidación por prefijo `['sessions']` de la reconexión pise el buffer (conflicto performance/plan resuelto en el RFC: `chat-stream-key`).
- Proyectar sobre `buildHistory` reutiliza la consolidación existente (`slices/messages.ts`) y **no** duplica contenido (FR-003).
- Texto plano durante el delta evita el coste de `react-markdown` sobre texto creciente (FR-006/SC-004); el markdown se parsea una sola vez al consolidar.
- Resetear el buffer por `assistantMessageID` acota la memoria sin necesitar enrutar `*.ended` (menor superficie de cambio que editar el reducer de mensajes).

**Alternatives considered**:
- **`['sessions','stream', id]`**: descartado; la invalidación por prefijo lo pisa (R2 rationale del RFC).
- **Buffer fuera de React Query (store propio)**: descartado; reimplementa caché/notificación que React Query ya resuelve.
- **`RichText` en vivo**: descartado; hot spot de re-parse (~10/s) sobre texto creciente.
- **Enrutar `*.ended` también al slice para limpiar**: descartado; obliga a que un evento produzca updates en dos slices y complica el spec del reducer. El reset por `assistantMessageID` + dedupe cubre el caso.

---

## R3. FR-020 (encolar mientras el agente trabaja) con `delivery: 'queue'` nativo (US1 · FR-020 · Principio I)

**Decision**: `sendPrompt` decide el `delivery` del prompt según el estado de la sesión: si la sesión está `busy` (ocupada, `SessionStatus`), envía `delivery: 'queue'` (se aplica al terminar el turno **sin** interrumpirlo); si está ociosa, envía sin `delivery` (comportamiento por defecto). El control muestra una nota breve cuando el envío va a la cola.

**Rationale**:
- `SessionPromptInput.text.delivery` acepta `'steer' | 'queue'`: la spec ya exige exactamente "encolar y aplicar al terminar el turno" — el servidor lo soporta, así que **no** hay que construir un inbox cliente (diferido a v2).
- Evita que un prompt corte el trabajo en curso (`delivery: 'queue'` no interrumpe) y evita la fricción de "no puedo escribir mientras trabaja".

**Alternatives considered**:
- **Deshabilitar el composer mientras la sesión está ocupada**: descartado; contradice FR-020 (debe permitir encolar) y empeora la UX.
- **Inbox cliente propio (lista de pendientes de envío)**: descartado; la gestión de la cola es no-objetivo (diferida a v2); el servidor ya la resuelve.

---

## R4. Interrupción: solo la sesión abierta + confirmación (US2 · FR-004 · SC-008)

**Decision**: El control "Detener" aparece en el mismo slot que "Enviar" y solo está `enabled` cuando la sesión abierta está `busy`. `interruptSession(openSessionId)` llama a `session.interrupt`; mientras la mutation está pendiente, el control muestra estado de carga (`isPending`) y `aria-busy`. **No** se detienen sesiones hijas: el `sessionID` es siempre el de la sesión abierta. Se pide confirmación con `AlertDialog` (reuso) para evitar cortes accidentales.

**Rationale**:
- `session.interrupt` es **por `sessionID`**: detener el turno de la sesión abierta es exactamente una llamada; los subagentes (sesiones hijas) no se ven afectados porque su `sessionID` es distinto (FR-004, clarificación).
- La disponibilidad deriva del estado `busy` ya cacheado (`useGetSessionStatus`), con una sola fuente de lógica.

**Alternatives considered**:
- **Botón siempre activo**: descartado; FR-004 exige que no esté disponible sin turno en curso (edge case "interrumpir sin turno").
- **Detener el subárbol completo**: descartado; la clarificación exige detener **solo** la sesión abierta.

---

## R5. Responder permisos y preguntas, con revalidación y origen (US3/edge · FR-005/F006/F007/F017/F022/F023)

**Decision**: La **bandeja de pendientes** sobre el composer lista los pendientes del **subárbol**; cada uno se responde **inline**:

- **Permiso** (`PermissionRequest`): botones de decisión `una vez` / `siempre` / `rechazar` (mapean a `once`/`always`/`reject`). Antes de confirmar, el control muestra `action` y `resources[]` (FR-017); para "siempre" el recurso queda visible antes de decidir.
- **Pregunta** (`FormDetail.fields`): se renderiza un formulario mínimo por tipo de campo (string/number/integer/boolean/multiselect/external) y se envía `session.form.reply({ sessionID, formID, answer })` con `answer` mapeado por `field.key` (FR-023 restringe el composer a texto; el **formulario de respuesta** sí admite el tipo del campo, que es una entrada del pendiente, no un adjunto libre).
- **Revalidación**: antes de enviar, se comprueba que el pendiente sigue abierto (existe en `permissions.list()` / en `forms` con estado `pending`); si ya se resolvió por otra vía (otra pestaña, el TUI), se muestra un aviso y **no** se aplica (FR-006).
- **Fallo de escritura**: aviso efímero accesible (toast) y se **conserva** el estado del pendiente/composer para reintentar (FR-022).
- El `sessionID` usado es el **de origen** del pendiente (incluidas sesiones hijas), identificando en la UI el agente/sesión que lo generó (FR-007).

**Rationale**:
- Responder con el `sessionID` de origen es lo que permite desbloquear un subagente desde la sesión abierta (FR-007/FR-010).
- La revalidación evita respuestas sobre pendientes inexistentes (FR-006) sin asumir que la caché está fresca (`staleTime: Infinity`).
- Reutiliza `TQuestionEntry`/`TQuestionField` (`Application/Helpers/questionState`) y `PermissionRow`/`QuestionRow` en modo accionable (opt-in), respetando la presentación existente.

**Alternatives considered**:
- **Modal para responder**: descartado; secuestra el foco y empeora el flujo (decisión `attention-and-input-request`): inline en región dedicada.
- **Enviar respuesta sin revalidar**: descartado; rompe FR-006 y produce errores opacos del servidor.
- **Adjuntar archivos/imágenes en el composer de chat**: fuera de alcance (FR-023, decisión de clarificación).

---

## R6. Atención: selector puro + una sola fuente + cinco señales (US5 · FR-009/F010/F011 · SC-005)

**Decision**: La atención es una **derivación pura** (no un slice de reducer): `lib/deriveAttention.ts` combina

- los nodos del subárbol con `status === 'waiting-permission' | 'waiting-input'` (`TGraphModel`), y
- `permissions.list()` (caché global reducida, con el `sessionID` de cada permiso).

y produce `TAttentionItem[]` (uno por pendiente) con: `id` estable, `kind: 'permission' | 'question'`, `sessionId` de origen, `nodeId` afectado y `at`. Un hook `useSessionAttention(rootId, graph)` lo expone. Sobre esa **única fuente** se montan las cinco señales:

1. **Badge en la sesión** (raíz) en `SessionCard` cuando algún pendiente cae en su subárbol.
2. **Badge en la pestaña Chat** (desktop) y/o en el tab móvil.
3. **Banner** en el panel (`ChatAttentionBanner`, `Alert`).
4. **Aviso efímero accesible** (toast de `sonner`, live region) ante un pendiente **nuevo** (`useAttentionNotifications` deduplica por `id`).
5. **Realce del nodo afectado** en el grafo, **solo** el nodo que tiene el pendiente.

La acción de cualquier señal **navega/enfoca la request origen**: selecciona la sesión/nodo de origen (aunque sea una sesión hija) y abre la tab Chat. Al resolverse, `deriveAttention` deja de devolver el item y **todas** las señales desaparecen (FR-011).

**Rationale**:
- Los datos ya están reducidos (`permissions.list()`, estados de nodo): derivar evita duplicar reducción y da una única fuente para badges/banner/toast/realce (conflicto calidad/plan resuelto: slice `attention` **agrega** ambas fuentes; aquí se materializa como selector porque ambas ya están en caché).
- El orden de señales evita saturación: badge + banner + toast, y realce **solo** en el nodo afectado (pregunta abierta del RFC, opción recomendada).
- El realce del nodo fluye por **contexto** (`NodeFocusContext`), no por `data`: no altera la identidad de render ni provoca re-layout (Principio VII); a diferencia del texto, un pendiente es un cambio de estado legítimo.

**Alternatives considered**:
- **Slice de reducer `attention` que escuche eventos crudos**: descartado; duplicaría la reducción de permisos/forms ya existente.
- **Usar solo `permissions.list()`**: descartado; no cubre preguntas (`waiting-input`) — de ahí combinar con el estado del subárbol.
- **Pulso/animación en todos los nodos con pendiente**: descartado; satura (opción no recomendada del RFC).

---

## R7. Selectores de agente, modelo y razonamiento (US4 · FR-008/F019)

**Decision**:

- `catalog.service.ts` añade `listModels(directory?)` (`opencodeClient.model.list({ location })` → `ModelInfo[]`) y `getDefaultModel(directory?)`.
- `lib/mapModelOptions.ts` (puro) proyecta `ModelInfo[]` → `TModelOption[]` y, por modelo, sus `TReasoningOption[]` derivadas de `ModelInfo.variants` (`ModelVariant.id` **es** la variante de razonamiento). Si un modelo **no** tiene variantes, la lista de razonamiento queda vacía y el envío sigue funcionando (edge case).
- El selector de agentes usa `useGetAgents(directory)` (ya existente).
- La **selección activa** (`TChatSelection = { agent, model: ModelRef }`) se siembra desde el estado actual del nodo abierto (`agentName`, `model` = `ModelRef` con su `variant`) y, al enviar, si cambió respecto al vigente:
  1. `switchAgent(sessionID, agent)` si cambió el agente;
  2. `switchModel(sessionID, { id, providerID, variant })` si cambió el modelo o la variante;
  3. y luego `sendPrompt`.
  La variante **solo** se ofrece entre las del modelo elegido (FR-008).
- El razonamiento visible en la UI (mostrar/ocultar) reutiliza `useReasoningVisibility`; **no** es lo mismo que la variante del modelo.

**Rationale**:
- El SDK separa la selección (`switchAgent`/`switchModel`) del envío (`prompt`): hacer el switch antes del prompt refleja "el envío la usa y la selección queda como estado de la sesión" (FR-008).
- `variants` del `ModelInfo` es la fuente correcta de las opciones de razonamiento; acotarlas al modelo elegido evita combinaciones inválidas (edge case).

**Alternatives considered**:
- **Enviar modelo/agente dentro del prompt**: descartado; `SessionPromptInput` no expone `model`/`agent` como parámetro de envío; el SDK modela el cambio con `switch*`.
- **Listar todas las variantes de todos los modelos**: descartado; viola FR-008 (la variante proviene del modelo elegido).

---

## R8. Pestañas Detalle|Chat, móvil de primer nivel y borrador (US7/edge · FR-012/F013/F014/F015 · SC-006/SC-007)

**Decision**:

- **Desktop**: la columna del detalle se envuelve en **Radix Tabs** (`ui/tabs.tsx` **ya existe**) con dos pestañas `Detalle | Chat` (patrón APG completo: `role=tablist/tab/tabpanel`, `aria-controls`, flechas, roving tabindex). El estado vive en `Infrastructure/Hooks/useDetailTabs.ts`.
- **Móvil**: el chat es un **tab de primer nivel** del workspace: `WORKSPACE_TABS` pasa a `['sessions','graph','inspector','chat']` y `WorkspaceMobileTabs` renderiza el `ChatPanel` como un panel propio. **No** se monta un tablist anidado dentro del panel del detalle en móvil (FR-013). Una sola fuente de lógica (`useChatController`) alimenta ambas presentaciones (FR-014).
- **Borrador**: `useChatDraft(sessionId)` persiste el texto en `localStorage` (`chat.draft.<sessionId>`) y lo rehidrata al montar; sobrevive al cambio de pestaña/vista (el panel móvil se desmonta) y a la rotación (FR-015, SC-006).
- **Escape**: el `useEscapeKey` existente en `WorkspacePage` da prioridad "cerrar fullscreen del panel" **antes** de que el `Escape` del composer (que solo cancela un estado inline, no cierra la vista) interfiera; el `Escape` del composer **no** cierra fullscreen ni limpia selección.

**Rationale**:
- Reutilizar Radix Tabs garantiza el APG y evita `ToggleGroup` (rol radiogroup/toolbar, no tablist).
- El panel móvil se desmonta (`WorkspaceMobileTabs.tsx:49-53`); persistir el borrador es la forma robusta de FR-015 sin mover todo el estado a un store global.
- Mantener una sola lógica y dos presentaciones cumple AGENTS §9 y la prohibición de `md:hidden`.

**Alternatives considered**:
- **Cuarta columna (chat siempre visible)**: descartado; rompe el layout de 3 columnas (no-objetivo).
- **Chat como overlay/modal**: descartado; no es "destino de primer nivel".
- **Borrador solo en memoria**: descartado; no sobrevive al desmontaje del panel móvil ni a la rotación.

---

## R9. Endurecimiento del dev server (FR-018 · Principio I · SC implícito)

**Decision**: En `vite.config.ts`: fijar `server.host: '127.0.0.1'`, añadir un guard que rechace `proxyReq` cuyo `remoteAddress` no sea loopback y **validar `Origin`/`Referer`** en el proxy `/oc` (solo orígenes loopback). En `scripts/start.sh`: forzar/enfatizar el bind loopback y **documentar** el riesgo (no se soporta host remoto; `OPENCODE_URL` remoto filtraría las creds Basic).

**Rationale**:
- Con escritura activa, "acceder al dev server" = "ejecutar en la máquina": validar Origin/Referer mitiga CSRF desde una web maliciosa abierta en el mismo navegador, y el bind loopback evita exponerlo a la LAN (conflicto seguridad/UX resuelto en el RFC: `hardening-dev-server`).
- No se introduce toggle de escritura: la fricción (no usar la web remota) se acepta y se documenta.

**Alternatives considered**:
- **Toggle de escritura**: descartado; fricción y no mitiga el vector real (dev server).
- **Solo Basic auth del proxy**: insuficiente; el browser no se autentica y un sitio malicioso local podría alcanzar `/oc`.

---

## R10. Accesibilidad WCAG 2.2 AA y correcciones repo-wide (FR-021 · SC-008)

**Decision**:

- El chat cumple WCAG 2.2 AA: operable por teclado, foco visible, contraste ≥4.5:1 (texto) y ≥3:1 (UI no textual), roles ARIA correctos (Radix Tabs, `role="status"` para el estado de envío/detención, `aria-busy` en Enviar/Detener, `role="img"`/`aria-label` donde aplique), sin trampas de foco y anuncios de estado accesibles.
- **Anuncio de stream solo al iniciar/terminar** el turno (no por delta) para no saturar AT (`role="status"`), reusando `InProgressText`/patrón existente.
- **Correcciones repo-wide** (deuda preexistente que afecta a todo el visor): token `--destructive` en dark (~2:1 → ≥4.5:1 como texto/≥3:1 como UI), `--status-idle` usado como texto (~4.07:1 → subir contraste), y migrar el foco por `box-shadow`/`ring` a `outline` con `@media (forced-colors)` en `ui/{button,input,textarea,select,checkbox}.tsx`; fijar `theme="dark"` en `ui/sonner.tsx`.
- La pestaña activa del chat usa un token ≥3:1 **más** una marca no-color (no solo `border-accent` ~1.1:1).

**Rationale**:
- La clarificación exige WCAG 2.2 AA y la decisión `a11y-repo-wide-tokens-focus` corrige la deuda de todo el visor, no solo el chat.
- El foco por `box-shadow` es invisible en `forced-colors` (Windows High Contrast); migrar a `outline` es la corrección estándar.

**Alternatives considered**:
- **Corregir a11y solo en el Chat**: descartado; deja deuda preexistente que afecta a los flujos del chat fuera de él.
- **`aria-live` por delta**: descartado; anuncia "todo" y genera spam a AT.

---

## R11. Alcance y no-cambios (Principios I/III/VII)

**Decision**: La feature **no** toca: la firma de `opencodeService` (`opencodeClient.spec.ts` intacto), el batching/reconexión de `EventStreamProvider`, `deriveExecutionKey`/`deriveExecutionLayout`/`layoutGraph`, ni el layout del grafo por deltas. No añade dependencias, no migra el render y no cambia el contrato del SDK. Los únicos cambios en piezas compartidas son **aditivos**: slice `chatStream`, ruta de deltas en `eventReducer.ts`, realce por **contexto** en el grafo y reuso accionable opt-in en `Inspector`.

**Rationale**: Mantener intactos los contratos de datos/eventos protege la paridad en vivo y minimiza el riesgo de regresión; el RFC ya anticipó que los cambios del reducer deben ser aditivos y extender sus specs sin romperlos.

**Alternatives considered**:
- **Reusar `['sessions','messages',id]` para el buffer**: descartado; mezcla parte provisional con consolidada y complica la dedupe.
- **Reusar los slices `messages`/`permissions` para el chat**: descartado; acopla chat y grafo y ensancha su contrato.

---

## Resumen de decisiones

| # | Decisión | FR / SC |
|---|----------|---------|
| R1 | Fachada hermana `sessionWriteService` + validación Zod; ids desde el pendiente; invalidación tras responder | FR-001, FR-005, FR-006, FR-007, FR-019, FR-022 |
| R2 | Buffer en `['chatStream', id]`; texto plano en delta; dedupe contra `buildHistory`; `memo` | FR-002, FR-003, FR-016, SC-003, SC-004 |
| R3 | `delivery: 'queue'` nativo cuando la sesión está ocupada (FR-020 sin inbox propio) | FR-020 |
| R4 | `session.interrupt` solo de la sesión abierta; `AlertDialog`; `aria-busy` | FR-004, SC-008 |
| R5 | Respuesta inline de permisos/forms; revalidación del pendiente; `sessionID` de origen; aviso accesible + reintento | FR-005, FR-006, FR-007, FR-017, FR-022, FR-023 |
| R6 | Atención como selector puro (`deriveAttention`) + 5 señales + navegación a la request + limpieza | FR-009, FR-010, FR-011, SC-005 |
| R7 | `listModels` + `mapModelOptions`; variante del modelo; `switch*` antes de `prompt` | FR-008, FR-019 |
| R8 | Radix Tabs Detalle\|Chat (desktop) y tab de primer nivel (móvil); borrador en `localStorage`; Escape | FR-012, FR-013, FR-014, FR-015, SC-006, SC-007 |
| R9 | Loopback + validación Origin/Referer en proxy y `start.sh` | FR-018 |
| R10 | WCAG 2.2 AA + correcciones repo-wide de tokens/foco + sonner dark | FR-021, SC-008 |
| R11 | Sin cambios en `opencodeService`/SSE/plan/layout; cambios aditivos | Principios I/III/VII |

**Trazabilidad sin decisión propia**: FR-012 (estados de pantalla + aviso de desconexión) se resuelve con R2 (proyección) + el estado de `useEventStream` (ya existente) en `ChatPanel`; FR-016 (grafo no reacciona a deltas) con R2/R11 (clave raíz + realce por contexto); FR-014 (una fuente, dos presentaciones) con R8.
