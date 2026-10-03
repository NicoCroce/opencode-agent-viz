# Research — OpenCode Agent Viz (Observabilidad Multi-Agente)

**Feature**: `001-agent-viz-observability`
**Date**: 2026-10-03
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), `docs/agent-viz-plan.md`

Este documento resuelve los puntos de research R1–R6 del plan base y las incógnitas adicionales del Technical Context (todas cerradas; no quedan `NEEDS CLARIFICATION`).

---

## R1. Cómo obtener eventos reales para fixtures y tests

**Decision**: Grabar el stream SSE con `curl -N http://127.0.0.1:4096/event > __fixtures__/run.ndjson` mientras corre una ejecución `develop → implement` (incluyendo al menos un subagente y un reintento), y versionar el `.ndjson` como fixture de tests unitarios del reducer y de `deriveMetrics()`.

**Rationale**: La constitución (Principio V) exige lógica pura testeada con eventos reales. Un `.ndjson` es estable, reproducible y no depende de un servidor vivo en CI.

**Alternatives considered**:
- Tests contra un servidor OpenCode real: descartado por no determinista y requiere entorno levantado.
- Eventos sintéticos escritos a mano: conservados solo como casos límite; no reemplazan la captura real porque el SDK evoluciona.

---

## R2. De qué campo sale el agente de cada sesión

**Decision**: El nombre del agente de una sesión se deriva, en este orden:
1. `UserMessage.agent` del primer mensaje de rol `user` de esa sesión (campo confirmado en `types.gen.d.ts:51`).
2. Fallback: el `agent` de la parte `subtask` del mensaje del padre que originó la hija (`Part` variante `subtask`, `types.gen.d.ts:345-353`).
3. Fallback final: `Agent.name` resuelto por `app.agents()` cuando el identificador coincide, o `"agent"` como último recurso.

**Rationale**: `AssistantMessage` **no** expone `agent` (solo `modelID`/`providerID`/`mode`); el único campo fiable con el nombre del agente es `UserMessage.agent`. El `subtask.agent` del padre da el nombre incluso antes de que la hija tenga mensajes.

**Alternatives considered**:
- Usar `AssistantMessage.mode`: es el modo de ejecución, no el nombre del agente; descartado.
- Adivinar por `Agent` listado y el modelo: ambiguo con varios agentes del mismo modelo; descartado.

---

## R3. Cómo se vincula un task del padre con la sesión hija

**Decision**: `Session.parentID` es el vínculo canónico padre→hijo (`types.gen.d.ts:469`). La topología del grafo se construye con `parentID`. La parte `subtask` aporta metadatos de presentación (prompt, description, agent) para el tooltip/nodo, pero **no** define el vínculo.

**Rationale**: `parentID` viene en el objeto `Session` tanto por REST (`session.list/children`) como por eventos `session.created/updated`, por lo que es consistente en vivo y en la carga inicial. `session.children({path:{id}})` permite reconciliar descendientes.

**Alternatives considered**:
- Vincular por `metadata.sessionId` del tool `task`: no confirmado como contrato público del SDK; frágil.
- Vincular por coincidencia de `subtask.prompt` con el primer mensaje de la hija: heurístico; descartado.

---

## R4. SSE a través del proxy de Vite sin buffering

**Decision**: Usar el proxy de Vite existente (`/oc` → `http://127.0.0.1:4096`) con el cliente SDK (`createOpencodeClient({ baseUrl: '/oc' })`) y `client.event.subscribe()`. Verificar en la primera iteración que el streaming llega incrementalmente; si hubiera buffering, se usa `opencode --cors http://localhost:5173` contra `http://127.0.0.1:4096` como plan B documentado.

**Rationale**: `client.event.subscribe()` devuelve un `ServerSentEventsResult` (async iterable) que ya parsea SSE; el proxy `/oc` evita CORS y no añade dependencias. `EventSubscribeData` soporta `query.directory` (`types.gen.d.ts:3366-3373`) si se necesitara acotar.

**Alternatives considered**:
- `EventSource` nativo: descartado porque el SDK ya resuelve parsing y tipos.
- `opencode --cors` como opción primaria: requiere cambiar cómo arranca el servidor del usuario; se deja como plan B.

---

## R5. Frecuencia de `message.part.updated` y batching

**Decision**: Los eventos se acumulan en un buffer y se despachan al `queryClient` en un flush de ~100ms (o en el siguiente `requestAnimationFrame`). Las partes `text` y `reasoning` (y sus `delta`) se ignoran; solo se procesan partes significativas (`tool`, `step-start`, `step-finish`, `subtask`, `agent`, `retry`, `compaction`, `patch`). La instrumentación de la medición de frecuencia se hará en la primera iteración con el fixture R1.

**Rationale**: El streaming de texto genera muchos eventos por segundo; la constitución VII prohíbe procesar deltas de texto y exige lotes. Un flush de 100ms reduce re-renders sin percibir latencia (< 1s exigido por SC-001).

**Alternatives considered**:
- Procesar cada evento al recibirlo: descartado por re-renders excesivos.
- Throttle de 500ms: descartado por acercarse al límite de 1s percibido.
- `useSyncExternalStore` con store propio: viable a futuro; se mantiene TanStack Query para cumplir el Principio III.

---

## R6. `/event` vs `/global/event`

**Decision**: Usar `client.event.subscribe()` (`GET /event`), que corresponde al proyecto/instancia actual. No se usa `/global/event` en v1.

**Rationale**: El alcance v1 es un único proyecto local (`spec.md` → Assumptions), y `GlobalEvent` añade un wrapper con `directory` que no se necesita. Ambos aceptan `query.directory`.

**Alternatives considered**:
- `client.global.event()` (`GET /global/event`): reservado para el futuro soporte multi-proyecto, fuera de alcance v1.

---

## R7. Detección de loops (FR-011)

**Decision**: Un agente se marca como **posible loop** si recibe una o más partes `retry` (`RetryPart.attempt`, `types.gen.d.ts:327-337`) o si su `SessionStatus` es `{ type: "retry", attempt }` (`types.gen.d.ts:396-405`). La evidencia mostrada incluye el número de intentos y el mensaje del proveedor. El conteo de invocaciones (`FR-010`) es una métrica independiente y **no** dispara la marca de loop.

**Rationale**: Resuelve la clarificación Q1 (opción A). Es la única señal objetiva de repetición reportada por el servidor; no requiere heurísticas sobre acciones y evita falsos positivos en flujos legítimos.

**Alternatives considered**: reintentos + invocaciones repetidas + acciones repetidas (opción D): descartado por coste y ruido; invocaciones repetidas (B) y acciones repetidas (C): descartados como disparadores de la marca (se conservan como métrica/conteo).

---

## R8. Origen de skills / instructions / MCP (FR-012)

**Decision**: Mostrar únicamente recursos **disponibles/configurados**, etiquetados como "disponible":
- MCP: `mcp.status()` → `{[name]: McpStatus}` (`types.gen.d.ts:2906-2913`).
- Instructions: `config.get().instructions` (array de patrones, `types.gen.d.ts:1159`).
- Skills: no existen como entidad de configuración en el SDK. Se muestran solo si se pueden derivar de forma fiable de la configuración disponible; en caso contrario, la sección lista las skills detectables como "no disponibles" con estado vacío explicativo. **No se infiere uso real.**
- Tools del agente: `Agent.tools` y `Agent.permission` (`types.gen.d.ts:1399-1428`) se muestran como capacidades configuradas.

**Rationale**: Resuelve la clarificación Q2 (opción A). El stream no atribuye consumo de recursos por agente; afirmar "usó" sería fabricar datos y violaría SC-007 ("no disponible" ≠ cero).

**Alternatives considered**: inferir uso desde actividad/tool calls (B) o mostrar ambas con etiquetas (C): descartados por esta versión; quedan como posible extensión futura.

---

## R9. Métricas de duración, costo y tokens

**Decision**:
- **Duración** de un agente = `AssistantMessage.time.completed − time.created` de sus mensajes assistant (`types.gen.d.ts:102-105`); mientras no haya `completed`, se calcula contra "ahora" y se actualiza en vivo. Alternativa granular por paso: `StepFinishPart` / `ToolState.time`.
- **Costo** = suma de `AssistantMessage.cost` (`types.gen.d.ts:116`) y de `StepFinishPart.cost` (`types.gen.d.ts:289`) de la sesión/agente.
- **Tokens** = suma de `AssistantMessage.tokens` y `StepFinishPart.tokens` con desglose `input/output/reasoning/cache.read/cache.write` (`types.gen.d.ts:117-125`, `290-298`).
- Si el valor no está presente o es `undefined`, la UI muestra "no disponible" (nunca `0`).

**Rationale**: Todos los campos existen en el SDK; se derivan en la función pura `deriveMetrics()` y se agregan a nivel de sesión (SC-004, SC-005, SC-007).

**Alternatives considered**: `message.updated` sólo (sin `step-finish`): se descarta ir solo con uno; se suman ambos según disponibilidad para no perder precisión.

---

## R10. Estado de conexión y reconexión

**Decision**: El `EventStreamProvider` mantiene un `TConnectionState` (`connected` | `reconnecting` | `disconnected`) en estado de módulo + `queryClient.setQueryData`. Reconexión con backoff exponencial y `queryClient.invalidateQueries()` global al reconectar. Un timeout de heartbeat (sin eventos en N segundos y stream cerrado) pasa a `reconnecting`.

**Rationale**: Cumple Principio VI (estado de conexión siempre visible), FR-001 y FR-018 (SC-003).

**Alternatives considered**: confiar en el estado del navegador (`navigator.onLine`): no refleja la disponibilidad del servidor de OpenCode; descartado.

---

## R11. Dark Mode / Flat Design y tokens

**Decision**: Modo oscuro por defecto aplicando la clase `dark` en `document.documentElement` (el proyecto ya define tokens dark en `src/index.css` y `darkMode: 'class'` en `tailwind.config.js`). Dirección flat: profundidad solo por cambio de superficie (`--surface-0/1/2`) y bordes de 1px; **sin** `box-shadow` ni gradientes decorativos; radios pequeños (4px cards, 3px controles). Se añaden fuentes self-hosted Inter (UI) y JetBrains Mono (datos) vía `@fontsource` para que la tipografía sea una decisión y no un default del sistema. Paleta y firma detalladas en `plan.md` → Design Direction.

**Rationale**: El brief exige "Dark Mode - Flat Design". `interface-design` advierte que en dark conviene apoyarse en bordes y no en sombras, y `frontend-design` pide no gastar la libertad de ejes no fijados en defaults. Los tokens semánticos existentes se reutilizan; los de estado (running/waiting/done/error) se añaden como tokens de tema.

**Alternatives considered**:
- Sistema de fuentes del SO (`ui-sans-serif`/`ui-monospace`): descartado porque la tipografía es parte de la identidad; se prefiere self-host para no depender de red.
- Sombras suaves para elevación: descartado por la dirección flat y porque en dark son débiles.

---

## R12. Estado global y selección de sesión

**Decision**: Usar TanStack Query como única fuente de datos del servidor; la sesión seleccionada y el modo "seguir" se llevan en la URL (`useURLParams`) con fallback al estado global existente (`useGlobalStore`). La "última sesión" por defecto se deriva de `session.list` por `time.updated`.

**Rationale**: Mantiene el Principio III y permite deep-linking (`/sessions/:id`). Reutiliza hooks existentes en vez de introducir Zustand.

**Alternatives considered**: store Zustand dedicado: innecesario para el alcance v1; descartado.

---

## Open questions

Ninguna. Todos los `NEEDS CLARIFICATION` del spec y del Technical Context quedaron resueltos (Q1/Q2 por respuestas del usuario; el resto por contrato del SDK y decisiones documentadas arriba).
