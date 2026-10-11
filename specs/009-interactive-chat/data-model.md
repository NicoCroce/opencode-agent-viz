# Data Model — Chat interactivo por sesión

**Feature**: `009-interactive-chat`
**Date**: 2026-10-10
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)

Este documento describe las **entidades de vista** que introduce la feature y las reglas que las gobiernan. Los datos crudos siguen siendo **tipos del SDK** (`SessionMessageInfo`, `ModelInfo`/`ModelVariant`, `AgentInfo`, `PermissionRequest`, `FormInfo`/`FormDetail`, `SessionStatus`, `SessionInboxUser`) y **no se redefinen** (Principio IV). Convención de nombres: prefijo `T` para tipos de vista (AGENTS.md).

La **escritura** se dirige al agente; no se introducen entidades de servidor nuevas ni mutaciones de datos propios del visor (Principio I enmendado).

---

## 1. Entidades de dominio reutilizadas (sin cambios de forma)

| Entidad | Tipo SDK | Rol en la feature |
|---------|----------|-------------------|
| Mensaje de sesión | `TSessionMessage` (`SessionMessageInfo`) | Fuente del histórico consolidado del timeline. |
| Parte consolidada | `TSessionMessageAssistant` (partes `text`/`reasoning`/`tool`) | Respuesta final; entra vía `slices/messages.ts` (sin cambios). |
| Estado de sesión | `SessionStatus` (`busy`/`idle`/`retry`…) | Disponibilidad de Detener y elección `steer`/`queue`. |
| Permiso | `PermissionRequest` (`id`, `sessionID`, `action`, `resources[]`, `message?`, `save?`) | Pendiente de permiso, con origen y recurso afectado. |
| Pregunta | `FormInfo` / `FormDetail` (`fields: FormField[]`, `state`) | Pendiente de pregunta, con opciones por campo. |
| Modelo | `ModelInfo` (`id`, `modelID`, `providerID`, `name`, `variants: ModelVariant[]`, `enabled`, `status`) | Catálogo de modelos y **variantes de razonamiento**. |
| Agente | `AgentInfo` (`id`, `name`, `mode`, `description?`) | Catálogo de agentes para el selector. |
| Selección de modelo | `ModelRef` (`id`, `providerID`, `variant?`) | Combinación vigente del envío. |
| Estado de conexión | `TConnectionState` (`connected`/`reconnecting`/`disconnected`) | Aviso "la respuesta en vivo puede no llegar" (FR-012). |

---

## 2. Entidades de vista nuevas

### 2.1 Buffer de stream (`TChatStreamBuffer`) — clave `['chatStream', id]`

| Campo | Tipo | Regla |
|-------|------|-------|
| `assistantMessageID` | `string` | Mensaje en curso; **al cambiar, el buffer se resetea** (acota memoria a un mensaje). |
| `parts` | `Record<ordinal, TChatStreamPart>` | Partes provisionales del mensaje en curso, indexadas por `ordinal`. |

| `TChatStreamPart` | Tipo | Regla |
|-------------------|------|-------|
| `kind` | `'text' \| 'reasoning'` | Según el delta (`session.text.delta` / `session.reasoning.delta`). |
| `text` | `string` | Acumulado por concatenación de `data.delta`. |
| `at` | `number` | `event.created` del último delta (para orden). |

- **Derivación**: slice puro `mergeChatStream(prev, event)` (`lib/mergeChatStream.ts`). Un `setQueryData` por flush (~10/s); el grafo **no** se suscribe a esta clave (SC-003).
- **No se persiste** ni se envía al servidor.

### 2.2 Entrada de timeline del chat (`TChatTimelineEntry`)

Unión del histórico consolidado y las partes provisionales:

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | `string` | `messageId:ordinal` (estable) para consolidado; `stream:<messageId>:<ordinal>` para provisional. |
| `role` | `'user' \| 'agent'` | `user` = mensaje propio; `agent` = respuesta/razonamiento. |
| `kind` | `'text' \| 'reasoning' \| 'tool' \| 'system' \| 'question'` | Proyecta `THistoryEntry.kind`. |
| `text` | `string` | Texto a mostrar (plano si provisional). |
| `isComplete` | `boolean` | `false` mientras es provisional ("En curso"). |
| `at` | `number` | `info.time.created` o `event.created`. |

- **Derivación**: `buildChatTimeline(messages, buffer, questions)` (pura, `lib/buildChatTimeline.ts`): reutiliza `buildHistory(messages)` y **descarta** toda parte del buffer cuya clave `messageId:ordinal` ya exista consolidada (dedupe tras `*.ended`, FR-003); agrega las restantes al final como provisionales.
- **Presentación**: provisional → **texto plano**; consolidado → `THistoryEntry` con `RichText` (markdown saneado).

### 2.3 Ítem de atención (`TAttentionItem`)

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | `string` | Estable (id del permiso/form); dedupe de toast. |
| `kind` | `'permission' \| 'question'` | Tipo de pendiente. |
| `sessionId` | `string` | **Sesión de origen** (puede ser una hija). |
| `nodeId` | `string \| null` | Nodo afectado del grafo (para realce), si está en el subárbol. |
| `title` | `string` | Texto breve (acción de permiso o título de la pregunta). |
| `at` | `number` | Instante del pendiente. |

- **Derivación**: `deriveAttention(graph, permissions)` (pura, `lib/deriveAttention.ts`): recorre los nodos con `status === 'waiting-permission' | 'waiting-input'` del subárbol y los cruza con `permissions.list()` (caché global reducida) para construir los ítems. Única fuente para badge/banner/toast/realce (FR-009).
- **Limpieza**: al resolverse el pendiente deja de aparecer → todas las señales desaparecen (FR-011).

### 2.4 Opciones de catálogo (`TModelOption`, `TReasoningOption`, `TAgentOption`)

| `TModelOption` | Tipo | Regla |
|----------------|------|-------|
| `id` | `string` | `ModelInfo.id`. |
| `label` | `string` | `ModelInfo.name`. |
| `ref` | `ModelRef` | `{ id, providerID }` base (sin variante). |
| `reasoning` | `TReasoningOption[]` | Derivadas de `ModelInfo.variants` (vacío si no hay). |

| `TReasoningOption` | Tipo | Regla |
|--------------------|------|-------|
| `value` | `string` | `ModelVariant.id`. |
| `label` | `string` | Etiqueta de la variante. |

| `TAgentOption` | Tipo | Regla |
|----------------|------|-------|
| `id` / `label` | `string` | `AgentInfo.id` / `AgentInfo.name`. |

- **Derivación**: `mapModelOptions(models)` (pura). La lista de razonamiento **solo** contiene las variantes del modelo elegido (FR-008). Modelo sin variantes → lista vacía y envío funcional (edge case).

### 2.5 Selección activa (`TChatSelection`)

| Campo | Tipo | Regla |
|-------|------|-------|
| `agent` | `string \| null` | Agente elegido; `null` = no cambiar. |
| `model` | `ModelRef \| null` | Modelo + variante elegidos; `null` = no cambiar. |
| `isDirty` | `boolean` | `true` si difiere del estado vigente del nodo/sesión. |

- **Derivación**: hook `useChatController` siembra la selección desde `node.data.agentName` / `node.data.model`; al enviar, si `isDirty`, aplica `switchAgent`/`switchModel` **antes** de `sendPrompt` (FR-008).
- **Estado de vista**: en memoria; no se persiste.

### 2.6 Borrador del compositor (`TChatDraft`)

| Campo | Tipo | Persistencia | Regla |
|-------|------|--------------|-------|
| `text` | `string` | **Sí** (`localStorage`, `chat.draft.<sessionId>`) | Vacío o solo espacios → no enviable (FR-001). |
| `isSubmitting` | `boolean` | No | Estado de la mutation (`isPending`). |
| `queued` | `boolean` | No | `true` cuando el envío fue a la cola (`delivery: 'queue'`). |

- **Derivación**: hook `useChatDraft(sessionId)`; sobrevive al cambio de pestaña/vista y a la rotación (FR-015, SC-006).

### 2.7 Entradas de escritura validadas (Zod) — `lib/schemas.ts`

| Esquema | Campos | Regla |
|---------|--------|-------|
| `sessionIdSchema` | `sessionID: string` | No vacío. |
| `promptTextSchema` | `text: string` | `trim()` no vacío; longitud acotada. |
| `permissionDecisionSchema` | `decision: 'once' \| 'always' \| 'reject'` | Unión literal (FR-005). |
| `replyPermissionSchema` | `{ sessionID, requestID, decision, message? }` | Todos los ids no vacíos. |
| `formAnswerSchema` | `answer: Record<string, string \| number \| boolean \| string[]>` | Valores por `field.key` (FR-005/F023). |
| `replyFormSchema` | `{ sessionID, formID, answer }` | Ids no vacíos + `answer` válido. |
| `modelRefSchema` | `{ id, providerID, variant? }` | Ids no vacíos; `variant` opcional. |

- **Derivación**: se ejecutan en `sessionWriteService` antes del SDK; un fallo lanza `TChatWriteError` sin tocar la red (FR-019).

---

## 3. Reglas de validación / invariantes

1. **Texto no vacío (FR-001)**: `promptTextSchema` rechaza vacío/solo espacios; el botón Enviar está deshabilitado sin texto válido.
2. **Streaming nunca es final (FR-002)**: las partes del buffer se etiquetan "En curso" (`isComplete: false`) y **nunca** se presentan como respuesta consolidada.
3. **Consolidación sin duplicar (FR-003)**: toda parte provisional cuya clave `messageId:ordinal` ya exista en el histórico se descarta al proyectar; al `*.ended`, el histórico sustituye al buffer.
4. **Un mensaje en curso a la vez (R2)**: cambiar `assistantMessageID` resetea el buffer de la sesión.
5. **Interrupción acotada (FR-004)**: el control Detener solo actúa sobre el `sessionID` de la sesión **abierta** y solo está disponible con `status === 'busy'`; subagentes intactos.
6. **Decisión de permiso explícita (FR-005)**: `once`/`always`/`reject`; el formulario de pregunta exige los campos requeridos.
7. **Revalidación del pendiente (FR-006)**: antes de enviar una respuesta se verifica que el pendiente siga abierto; si no, aviso y **no** se aplica.
8. **Origen del pendiente (FR-007)**: la respuesta usa el `sessionID` que generó el pendiente (hija incluida) y la UI identifica el origen.
9. **Variante acotada al modelo (FR-008)**: la lista de razonamiento deriva del `ModelInfo` elegido; puede ser vacía.
10. **Una sola fuente de atención (FR-009)**: badge, banner, toast y realce se derivan de `TAttentionItem[]`.
11. **Navegación a la request (FR-010)**: la acción de cualquier señal enfoca la sesión/nodo de origen y abre el chat.
12. **Limpieza de señales (FR-011)**: al resolverse el pendiente, el ítem desaparece y con él todas sus señales.
13. **Estados de pantalla (FR-012)**: `ChatPanel` renderiza error → carga → vacío → datos y muestra el estado de conexión.
14. **Móvil de primer nivel (FR-013)** y **una fuente/dos presentaciones (FR-014)**: `WORKSPACE_TABS` incluye `chat`; el panel del detalle no anida un tablist en móvil.
15. **Borrador persistente (FR-015)**: el texto vive en `localStorage` por sesión y se rehidrata al montar.
16. **Grafo sin reacción a deltas (FR-016)**: el buffer vive en clave raíz separada; el realce de atención fluye por contexto, no por `data`; sin relayout (SC-003).
17. **"Siempre" visible (FR-017)**: antes de confirmar una autorización persistente se muestra `action`/`resources[]`.
18. **Acceso restringido (FR-018)**: loopback + validación Origin/Referer en el proxy y `start.sh`.
19. **Validación de entrada (FR-019)**: Zod antes del SDK (texto, decisión, ids, selección de modelo).
20. **Encolar sin cortar (FR-020)**: con la sesión ocupada, `delivery: 'queue'` y el control lo indica.
21. **WCAG 2.2 AA (FR-021)**: teclado, foco visible, contraste ≥4.5:1/≥3:1, roles ARIA, sin trampas, anuncios accesibles.
22. **Fallo de escritura (FR-022)**: aviso efímero y accesible; se conserva el texto/estado para reintentar.
23. **Solo texto en el composer (FR-023)**: sin adjuntar archivos/imágenes.
24. **Sin dependencias nuevas y sin cambios de contrato** (R11): el SDK se usa tal cual; `opencodeService`/SSE/plan/layout intactos.

---

## 4. Transiciones de estado

### 4.1 Turno de la sesión

```text
idle ──(prompt)──────────────► busy
idle ──(prompt, delivery=queue)──► [cola] ──(turno termina)──► busy
busy ──(interrupt)───────────► interrupting ──(interrupt resuelve)──► idle
busy ──(turno termina por sí solo)──────────────────────────────────► idle
```

- `busy`/`idle` derivan de `SessionStatus` (reducido por eventos). `interrupting` es `isPending` de la mutation (estado de carga del control, FR-004).

### 4.2 Pendiente (permiso/pregunta)

```text
abierto ──(respondo inline)──► revalidar ──(sigue abierto)──► aplicado ──► resuelto
abierto ──(otra vía: TUI/pestaña)──► resuelto
abierto ──(intento responder)──► revalidar ──(ya resuelto)──► aviso, no se aplica
```

- Solo `abierto` produce `TAttentionItem`; al pasar a `resuelto` todas las señales desaparecen (FR-006/F011).

### 4.3 Streaming de una parte

```text
delta(text) ──► provisional("En curso") ──► *.ended ──► consolidado (RichText)
buffer vive en ['chatStream', id]          histórico vive en ['sessions','messages', id]
```

- La proyección descarta el provisional cuando el consolidado aparece (dedupe, FR-003); el buffer se resetea al cambiar de `assistantMessageID`.

---

## 5. Relaciones

```text
sessionWriteService (Infrastructure)  ──►  opencodeClient.session.* / permission.reply
        ▲
        │ mutations (Zod)
        │
useChatController ── timeline ── buildChatTimeline ──┬─ buildHistory(TSessionMessage[])  (consolidado)
        │                                           └─ ['chatStream', id] buffer         (provisional)
        ├─ sendPrompt(delivery steer|queue) ──► FR-001/FR-020
        ├─ interruptSession(openId)         ──► FR-004
        └─ selection (switchAgent/switchModel→prompt) ──► FR-008

TGraphModel (subárbol)  ┐
                        ├── deriveAttention ──► TAttentionItem[] ──┬─ badge sesión/pestaña
permissions.list()      ┘                                           ├─ banner (Alert)
                                                                    ├─ toast (sonner)
                                                                    └─ realce de nodo (contexto)

ModelInfo[] (model.list) ── mapModelOptions ──► TModelOption[] + TReasoningOption[] ──► ChatSelector
localStorage['chat.draft.<id>'] ── useChatDraft ──► ChatComposer (FR-015)
```

---

## 6. Qué NO cambia (fronteras del modelo)

- `TGraphNode`, `TGraphNodeData`, `TGraphModel`, `TNodeStatus`, `TExecutionSignal`, `TGraphEdge`: **sin cambios de forma** (el realce de atención no entra en `data`).
- Firma de `OpenCodeService` (`opencodeClient.spec.ts`): **sin cambios** (FR-016); la escritura vive en `sessionWriteService`.
- `reduceEvent`: contrato **sin cambios** salvo la ruta aditiva de los deltas hacia `chatStream`; el resto de slices intactos.
- `deriveExecutionKey`/`deriveExecutionLayout`/`layoutGraph`/`EventStreamProvider`: **sin cambios**.
- `TFileChange` y demás alias del SDK: **sin cambios**.
- Modelo de datos del servidor: fuera de alcance; la escritura va al agente (Principio I).
