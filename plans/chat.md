# Plan: Chat interactivo por sesión

Alcance: llevar la app de "observador de solo lectura" a poder **enviar prompts, interrumpir y responder preguntas/permisos** de OpenCode desde una interfaz de chat, sin depender de la terminal.
Restricción: mantiene la arquitectura por dominios y la Constitución (salvo el Principio I, que se enmienda explícitamente; ver §8).

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Ubicación | Chat **dentro de la columna del detalle**, con pestañas `Detalle \| Chat`. No es una cuarta columna. |
| Alcance del chat | **General**: escribe a la sesión abierta (`:id` de `/sessions/:id/graph`), no al agente/nodo inspeccionado. |
| Streaming | **Progresivo en vivo** con buffer dedicado (no toca el reducer del grafo). |
| Escritura | **Siempre activa** (sin toggle ni gating). |
| Acciones v1 | Enviar + interrumpir + responder preguntas/permisos. |
| Selectores | Agente, modelo y **razonamiento** (= `variants` del modelo elegido). |

## 1. Pestañas dentro de la columna del detalle

`WorkspaceLayout.tsx` ya monta la columna del inspector (`data-testid="inspector-column"`) con resize (`useInspectorPanel`) y fullscreen. Pasa a tener un header con un segmented control `Detalle | Chat` y monta el panel activo.

- El estado del tab activo vive en un hook (`useDetailTabs`), una sola fuente de lógica.
- Resize y fullscreen siguen aplicando a la columna completa (cubren ambos tabs).
- **Mobile (recomendado):** `chat` como pestaña top-level en `WORKSPACE_TABS` + `WorkspaceMobileTabs`, para no anidar un tabbar dentro del tab `inspector`. Alternativa aceptada: segmented control anidado (peor UX móvil). Misma fuente de lógica, dos presentaciones (AGENTS §9).

## 2. Streaming progresivo

- Nueva slice `reduceChatStream` para `session.text.started/delta/ended` y `session.reasoning.started/delta/ended`.
- Clave de caché dedicada `sessions.stream(id)`: buffer por `assistantMessageID:ordinal` → `{ kind: 'text' | 'reasoning', text }`.
- Se quitan `session.text.delta` y `session.reasoning.delta` de `IGNORED_EVENT_TYPES`. Los `session.tool.*.delta` / `session.tool.progress` siguen ignorados.
- **El grafo no lee la clave de stream**, así que no se re-layouta por delta: se preserva el espíritu del Principio VII.
- Proyección del chat: `buildHistory(messages)` (consolidado) + entradas "en curso" desde el buffer. Al llegar `*.ended`, la parte consolidada entra en `sessions.messages` y se limpia ese `ordinal` del buffer (sin duplicar).
- Los deltas son de alta frecuencia: el `eventBatcher` ya agrupa ~100ms; el reducer acumula texto en el buffer. Añadir coalescing si el perfilado lo pide.

Eventos relevantes (SDK V2, `promise/generated/types.d.ts`):
- `session.text.delta` / `session.reasoning.delta`: `{ sessionID, assistantMessageID, ordinal, delta }` (NO durables, solo SSE).
- `session.text.ended` / `session.reasoning.ended`: `{ sessionID, assistantMessageID, ordinal, text }` (durables).

## 3. Atención y notificación de preguntas

Hoy la señal existe (estados de nodo `waiting-input` / `waiting-permission`, `hasPendingForm`, `permissions.list()` global) pero no se notifica: los formularios solo invalidan queries (`formsInbox.ts`).

- Slice de atención: `form.created` y `permission.asked` marcan `sessions.attention()` (global) con `{ sessionID, kind, at }`; `form.replied/cancelled` y `permission.replied` lo limpian. `set` sin red.
- Agregación **por subárbol** (raíz + descendientes): combinar los estados de nodo del grafo (`waiting-input` / `waiting-permission`) con la lista global `permissions.list()`.
- Puntos de alerta:
  1. Badge en `SessionCard` / `SessionsRail`.
  2. Badge en la pestaña `Chat` (y en el tab móvil).
  3. `ChatAttentionBanner` dentro del panel ("El agente necesita tu respuesta") que lleva a la pregunta.
  4. Toast con `sonner` (ya montado en `App.tsx` + `Toaster`) vía `useAttentionNotifications`.
  5. Pulso visual en el nodo afectado del grafo.
- **Nuance clave:** un subagente que pregunta es otra sesión (hijo). `ChatInputRequest` renderiza la pregunta/permiso de **la sesión que la generó** (no necesariamente la raíz) y llama a la mutación correcta. Así la notificación no es un callejón sin salida.

## 4. Selector agente / modelo / razonamiento

| Selección | Fuente | Acción SDK |
|---|---|---|
| Agente | `agent.list` → `AgentInfo[]` (`useGetAgents` ya existe) | `session.switchAgent({ sessionID, agent })` |
| Modelo | `model.list` → `ModelInfo[]` (agregar `listModels`) | `session.switchModel({ sessionID, model })` |
| Razonamiento | `ModelInfo.variants: ModelVariant[]` del modelo elegido | `variant` dentro del `ModelRef` (`{ id, providerID, variant }`) |

- El estado inicial se siembra desde el nodo raíz (`graph.node.data.model` / `agentName`) o los mensajes `agent-switched` / `model-switched`.
- `switchAgent` / `switchModel` afectan a la sesión completa (coherente con "chat general").

## 5. Capa de escritura

`opencodeClient.ts` es estrictamente read-only (FR-016) y la fachada solo compone `*ReadService`. Se agrega, siempre por el facade (Constitución III):

- `session.prompt({ sessionID, text, delivery })` → enviar.
- `session.interrupt({ sessionID })` → detener.
- `permission.reply({ sessionID, requestID, decision: 'once' | 'always' | 'reject' })`.
- `session.form.reply({ sessionID, formID, answer })` y `session.form.cancel`.
- `session.switchAgent` / `session.switchModel`.
- Opcional: `session.inbox.cancel`.

Hooks TanStack de mutación: `useSendPrompt`, `useInterruptSession`, `useReplyPermission`, `useReplyForm`, `useSwitchAgent`, `useSwitchModel`. Botones con `isLoading={isPending}`.

## 6. Archivos afectados

**Nuevo dominio `src/Domains/Chat/`** (estructura AGENTS §1):
```
Chat.entity.ts
Chat.service.ts            # queries (mensajes/stream) + mutations (prompt/interrupt/reply/switch)
index.ts
Components/
  ChatPane.tsx
  ChatHeader.tsx           # segmented control + selectores
  ChatSelector.tsx         # agente / modelo / razonamiento
  ChatTimeline.tsx         # buildHistory + buffer de stream
  ChatComposer.tsx         # input + enviar + detener
  ChatAttentionBanner.tsx
  ChatInputRequest.tsx     # responder form/permiso
  index.ts
Hooks/
  useChatController.ts
  useChatSelectors.ts
  useSessionAttention.ts
  useDetailTabs.ts
  useAttentionNotifications.ts
  index.ts
specs/                     # reglas reales + fixtures
```

**Infraestructura y otros:**
- `Infrastructure/Services/opencodeClient.ts` → sumar `ChatWriteService` (nuevo `session.write.service.ts`).
- `Infrastructure/Services/catalog.service.ts` → `listModels`.
- `Domains/queryKeys.ts` → `models`, `attention`, `chatStream`.
- `Infrastructure/Components/WorkspaceLayout.tsx`, `WorkspacePage.tsx`, `WorkspacePage.constants.ts`, `WorkspaceMobileTabs.tsx`.
- `Domains/Graph/lib/eventReduce/` → slice de atención + slice de stream; ajustar `ignored.ts`, `eventReducer.ts`, `eventTypes.ts`, `slices/formsInbox.ts`, `slices/permissions.ts`.
- `Domains/Sessions/Components/SessionCard.tsx` + `SessionsRail.tsx` → badge de atención.
- Reuso (sin acoplar dominios): `HistoryEntry`, `RichText`, `QuestionBlock`, `QuestionStateBadge` (viven en `Application/Components`), y `buildHistory` desde un hook/service de Chat.

## 7. Tests

- Puros: selector de atención por subárbol; buffer de stream (merge + clear por ordinal); mapeo modelo → variants.
- Servicios/mutaciones con cliente mockeado.
- Componentes con `renderWithProviders`.
- Fixtures reales grabadas: `form.created`, `permission.asked`, `session.text.delta` / `session.text.ended`.

## 8. Constitución (enmiendas)

- **Principio I**: de *"La app nunca envía prompts, aborta sesiones ni responde permisos en v1. Solo visualiza..."* a *"La app observa por defecto; con el modo interactivo habilitado puede enviar prompts, interrumpir sesiones y responder preguntas/permisos."*
- **Principio VII**: precisar que *el grafo ignora deltas* y que *el chat mantiene un buffer de streaming separado*.

## 9. Riesgos

- **Seguridad:** con escritura siempre activa, quien abra la web puede ejecutar cosas en la máquina (el proxy de Vite inyecta `OPENCODE_PASSWORD`). Recomendación mínima: no exponer el dev server con `--host` a la red.
- **Concurrencia con el TUI:** si el TUI y la web escriben la misma sesión, el SDK encola en el inbox; mostrar y permitir cancelar la cola.
- **Rendimiento de deltas:** vigilar re-renders; coalescing si hace falta.

## 10. Orden de implementación sugerido

1. Enmienda de constitución (I y VII).
2. Capa de escritura (`session.write.service.ts` + facade) y `listModels`.
3. Dominio `Chat` base: `Chat.service.ts` + `useChatController` + `ChatPane`/`ChatTimeline`/`ChatComposer` con pestañas (`useDetailTabs`).
4. Streaming (`reduceChatStream` + proyección).
5. Selectores agente/modelo/razonamiento.
6. Atención y notificaciones (slice + badges + banner + toast + `ChatInputRequest`).
7. Tests y fixtures; pulido responsive.
