# Quickstart — Chat interactivo por sesión

**Feature**: `009-interactive-chat`
**Objetivo**: validar de extremo a extremo que (1) se envía un prompt y la respuesta llega **progresiva** sin duplicarse, (2) se **interrumpe** un turno, (3) se **responden preguntas y permisos** (incluidos de subagentes), (4) se eligen **agente/modelo/razonamiento**, (5) un pendiente **señala** y **navega** a su request, y (6) el chat tiene **estados claros** y es usable en **móvil** con el borrador conservado.

Referencias: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/).

---

## 1. Prerrequisitos

- Node.js y dependencias instaladas: `npm install`.
- El background service de OpenCode corriendo; arrancar con `npm start` (descubre la URL y exporta `OPENCODE_URL`/`OPENCODE_PASSWORD`).
- Una **muestra de ejecución representativa**:
  - una sesión con **subagentes** (sesiones hijas);
  - al menos **un permiso** y **una pregunta** pendientes, idealmente uno generado por una sesión hija;
  - un modelo con **variantes de razonamiento** y otro **sin** variantes;
  - capacidad de detener un turno en curso.
- Navegador con DevTools y, para a11y, teclado y (opcional) Windows High Contrast / emulación de `forced-colors`.
- **El TUI de OpenCode puede estar abierto sobre la misma sesión** (limitación documentada: la cola no se gestiona en esta versión).

---

## 2. Validación automatizada (acotada a los archivos de la feature)

```bash
# Fachada de escritura + schemas
npx vitest run src/Infrastructure/Services/specs/session.write.service.spec.ts

# Lógica pura del chat (buffer, timeline, atención, catálogo) y slices
npx vitest run src/Domains/Chat src/Domains/Graph/lib/specs/eventReducer.spec.ts src/Domains/Graph/lib/specs/chatStream.spec.ts

# Hooks de chat (controller, draft, atención)
npx vitest run src/Domains/Chat/Hooks/specs

# Componentes de chat, pestañas y layout
npx vitest run src/Domains/Chat/Components/specs src/Infrastructure/specs src/Application/Components
```

**Esperado**: verde. Specs de esta feature:

- `session.write.service.spec.ts` (**nuevo**) — mapeo 1:1 con el SDK, `delivery: 'queue'`, validación Zod, errores (W1..W6).
- `chatStream.spec.ts` (**nuevo**) — upsert, reset por `assistantMessageID`, clave `['chatStream', id]` (S1/S2/S5).
- `eventReducer.spec.ts` (**extendido**) — `text/reasoning.delta` ya no ignorados; resto intacto (S6).
- `mergeChatStream.spec.ts` / `buildChatTimeline.spec.ts` (**nuevos**) — concatenación y dedupe sin duplicar (S1..S4).
- `deriveAttention.spec.ts` (**nuevo**) — pendientes del subárbol y de hijas; vacío sin pendientes (A1..A3).
- `mapModelOptions.spec.ts` (**nuevo**) — variantes del modelo; sin variantes (P6).
- `useChatController.spec.tsx` / `useChatDraft.spec.tsx` / `useAttentionNotifications.spec.tsx` (**nuevos**) — selección antes de enviar (W7), borrador persistido (P5), toast dedupe (A5).
- Specs de componentes (`ChatPanel`, `ChatComposer`, `ChatSelector`, `ChatTimeline`, `ChatPendingRequest`, `ui/tabs`, `WorkspaceMobileTabs`, `WorkspaceLayout`, `SessionCard`) — estados (P2/P3), móvil de primer nivel (P4), prevalidación (W8), fallo (W9), aria-busy (P7).

> Las pruebas globales (`npm test`, `npm run tsc`, `npm run lint`) las corre el orquestador, no este subagente.

Opcional, si hay server real disponible:

```bash
npm run test:live   # integración contra el server vía VIZ_API_URL + OPENCODE_PASSWORD
```

---

## 3. Validación manual

### US1 — Enviar un prompt y ver la respuesta en vivo (P1 · FR-001..FR-003, SC-001/SC-004)

1. Abrir una sesión y entrar a la pestaña **Chat** (desktop) o al tab **Chat** (móvil).
2. Escribir un texto no vacío y enviar.
   - **Esperado**: el mensaje propio aparece en el hilo y el envío se confirma.
3. Observar la respuesta.
   - **Esperado**: el texto crece **progresivamente** marcado "En curso".
4. Cuando el turno termina.
   - **Esperado**: el texto provisional se reemplaza por la respuesta consolidada (con markdown) y **no** se duplica.
5. Con la sesión **ocupada**, enviar otro prompt.
   - **Esperado**: el prompt se **encola** y se aplica al terminar el turno, sin cortar el trabajo en curso; el control lo indica.

### US2 — Interrumpir un turno (P1 · FR-004, SC-008)

1. Con un turno en curso, pulsar **Detener** (confirmar si se pide).
   - **Esperado**: la ejecución se interrumpe; el control muestra estado de carga y vuelve a disponible.
2. Sin turno en curso.
   - **Esperado**: el control **no** está disponible.
3. Con subagentes activos, interrumpir la sesión abierta.
   - **Esperado**: se detiene **solo** el turno de la sesión abierta; las hijas siguen.

### US3 — Responder preguntas y permisos, incluidos de subagentes (P1 · FR-005..FR-007, FR-017/F022)

1. Provocar un permiso en la sesión abierta; responderlo desde la bandeja.
   - **Esperado**: elegir `una vez`/`siempre`/`rechazar`; para `siempre` se ve el recurso/acción antes de confirmar; el pendiente se resuelve y desaparece.
2. Provocar una pregunta/permiso en una **sesión hija**; responderla desde la sesión abierta.
   - **Esperado**: se identifica el origen y se resuelve.
3. Resolver el pendiente por otra vía (TUI/otra pestaña) e intentar responder.
   - **Esperado**: aviso de que ya no está abierto; **no** se aplica.
4. Simular un fallo de escritura (server caído).
   - **Esperado**: aviso efímero y accesible; el texto/estado se conserva para reintentar.

### US4 — Elegir agente, modelo y razonamiento (P2 · FR-008)

1. Abrir el selector de agente y elegir uno.
2. Elegir un modelo con variantes y abrir el selector de razonamiento.
   - **Esperado**: solo se ven las variantes de ese modelo.
3. Enviar.
   - **Esperado**: el envío usa la combinación y la selección queda reflejada como estado actual.
4. Elegir un modelo **sin** variantes.
   - **Esperado**: el selector de razonamiento no ofrece opciones y el envío sigue funcionando.

### US5 — Ser avisado de un pendiente y llegar a él (P2 · FR-009..FR-011, SC-005)

1. Provocar un pendiente en una sesión **no enfocada** (idealmente hija).
   - **Esperado**: badge en la sesión, badge en la pestaña Chat, banner en el panel, aviso efímero accesible y realce **solo** del nodo afectado.
2. Actuar sobre la señal.
   - **Esperado**: navega/enfoca la request origen (aunque sea de una hija) y abre el chat.
3. Resolver el pendiente.
   - **Esperado**: todas las señales desaparecen.

### US6 — Estado claro cuando el stream no llega (P3 · FR-012)

1. Abrir el chat en carga, error y vacío.
   - **Esperado**: carga → error → vacío → datos, en ese orden.
2. Simular el stream desconectado e intentar enviar.
   - **Esperado**: se avisa de que la respuesta en vivo puede no llegar aunque el envío se realice.

### US7 — Chat en móvil como vista propia (P3 · FR-013..FR-015, SC-006/SC-007)

1. En viewport móvil, abrir el chat desde la navegación principal.
   - **Esperado**: es un destino de primer nivel, sin tabbar anidada.
2. Escribir texto, cambiar de vista y volver (y rotar el dispositivo).
   - **Esperado**: el borrador sigue ahí.

### Edge cases

- **Sesión sin actividad**: estado vacío y permite enviar el primer prompt.
- **Respuesta muy larga**: el texto crece sin degradar la interacción ni provocar saltos del grafo (**0 reposicionamientos**, SC-003).
- **Reconexión durante el streaming**: el texto en curso no se pierde ni se duplica al consolidarse.
- **Envío con stream desconectado**: permitido, con aviso.
- **Prompt vacío/solo espacios**: no se envía.
- **Envío con el agente trabajando**: se encola sin cortar.
- **Interrumpir con subagentes activos**: solo la sesión abierta.
- **Varias sesiones hijas con pendientes**: cada uno identificado por su origen y accionable.
- **Envío simultáneo con el TUI**: el turno puede quedar en cola; limitación documentada (inbox diferido a v2).

### Accesibilidad (SC-008)

- Recorrer todo el chat solo con teclado: pestañas (flechas), composer, selectores, bandeja, botones de decisión.
- Foco visible en todos los controles; sin trampas de foco; `Escape` coherente.
- Contraste de tokens corregido; probar en modo alto contraste (`forced-colors`).

---

## 4. Criterios de aceptación (resumen)

| Criterio | Cómo se valida |
|----------|----------------|
| SC-001 | Ciclo prompt→respuesta sin abandonar la web (US1; specs W2/S1..S4). |
| SC-002 | Recibir y resolver un pendiente de una hija sin terminal (US3; specs W4..W6/A1). |
| SC-003 | 0 reposicionamientos del grafo durante un turno (US1; specs S5/S7). |
| SC-004 | El primer texto se percibe inmediato (progresivo; texto plano durante el delta). |
| SC-005 | Un pendiente nuevo queda señalado sin recargar (US5; specs A1..A4). |
| SC-006 | El borrador sobrevive al cambio de pestaña/vista (US7; spec P5). |
| SC-007 | En móvil se llega al chat en un solo paso (US7; spec P4). |
| SC-008 | Chat 100 % operable por teclado y WCAG 2.2 AA (US1..US3/US7; specs P1/P7/P8). |

---

## 5. Salida esperada

- Specs acotadas verdes; `opencodeClient.spec.ts` **sin cambios**.
- Confirmación manual de SC-001..SC-008 sobre la muestra.
- Evidencia (capturas/notas) de: respuesta progresiva sin duplicar, interrupción acotada, respuesta a un pendiente de hija, selectores con razonamiento acotado, señales de atención + navegación, y borrador conservado en móvil.

---

## 6. Limitaciones conocidas (esta versión)

- **Acceso solo por loopback (FR-018)**: la escritura está siempre activa, así que acceder al dev server equivale a ejecutar en la máquina. El server se sirve **solo en loopback** (`server.host: '127.0.0.1'`) y el proxy `/oc` valida `Origin`/`Referer` de loopback, rechazando peticiones de origen externo. **No exponer el dev server con `--host`** ni apuntar a un `OPENCODE_URL` remoto (filtraría las credenciales Basic); la web no debe usarse desde otra máquina ni desde la LAN.
- **Cola (inbox) diferida a v2**: al escribir en paralelo con el TUI sobre la misma sesión, el turno puede quedar en cola del servidor. Esta versión **no** muestra ni cancela esa cola (no hay inbox propio); solo se documenta la limitación.

---

## 7. Evidencia de verificación (T070)

**Verificación global (orquestador, 2026-10-10)**: `pnpm lint` ✅ · `pnpm tsc` ✅ · `pnpm test` ✅ (132 archivos, **1426 pasan**, 1 skip) · `pnpm build` ✅. `opencodeClient.spec.ts` **sin cambios** (FR-016). `OPENCODE_PASSWORD` **no** aparece en el bundle; el proxy inyecta Basic server-side.

| SC | Evidencia | Estado |
|----|-----------|--------|
| SC-001 | Ciclo prompt→respuesta cubierto por `session.write.service.spec` (W2), `mergeChatStream/buildChatTimeline` (S1–S4), `useChatController.spec` y `ChatPanel.spec` (envío + proyección). | ✅ automatizado |
| SC-002 | Pendiente de sesión hija accionable: `Chat.service.spec` (origen hija, FR-007), `deriveAttention.spec`/`useSessionAttention.spec` (subárbol), `ChatPanel.spec` (bandeja). | ✅ automatizado |
| SC-003 | 0 reposicionamientos del grafo: `AgentGraph.spec` (realce por contexto, sin tocar `data`, arrays `nodes`/`edges` con misma referencia) + `eventReducer.spec` (deltas no re-layoutan). | ✅ automatizado |
| SC-004 | Texto provisional en plano + "En curso" durante el delta y consolidación al cerrar: `ChatTimeline.spec`. Percepción de inmediatez = manual. | ✅ automatizado (percepción: manual) |
| SC-005 | Señal de pendiente sin recargar: `deriveAttention.spec`, `useAttentionNotifications.spec` (dedupe), `SessionCard.spec`/`SessionList.spec` (badge), `ChatAttentionBanner.spec`. | ✅ automatizado |
| SC-006 | Borrador sobrevive al remontaje/cambio de vista: `useChatDraft.spec`, `ChatPanel.spec`. Rotación real: manual. | ✅ automatizado (rotación: manual) |
| SC-007 | En móvil, chat como destino de primer nivel: `WorkspaceMobileTabs.spec`, `WorkspaceLayout.spec`, `WorkspacePage.spec`. | ✅ automatizado |
| SC-008 | Operable por teclado / WCAG 2.2 AA: `ChatPanel.a11y.spec`, `ui/specs/tabs.a11y.spec`, `InspectorPane.spec` (APG), tokens de contraste corregidos. `forced-colors` real: manual. | ✅ automatizado (forced-colors: manual) |

**Requiere validación manual en navegador** (no cubrible con jsdom): streaming real por SSE, toast visual, reconexión del stream, concurrencia con el TUI, y `forced-colors`/alto contraste. No se adjuntan capturas (opcional según la decisión P1); la evidencia es textual + el resultado de la suite.
