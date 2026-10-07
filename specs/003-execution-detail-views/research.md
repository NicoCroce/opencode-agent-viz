# Research — Detalle de ejecución de agentes

**Feature**: `003-execution-detail-views`
**Date**: 2026-10-07
**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

Este documento resuelve los puntos técnicos abiertos por las siete historias. La spec está cerrada con clarificaciones; no quedan `NEEDS CLARIFICATION`. Cada decisión se apoya en APIs y tipos ya presentes en `@opencode/client` 2.0.22 (verificados en `dist/promise/generated/types.d.ts` y `dist/promise/generated/client.d.ts`).

---

## R1. Render enriquecido y saneado de respuestas y razonamiento (US1, FR-001, FR-002)

**Decision**: Renderizar el texto con `react-markdown` + `remark-gfm` + `rehype-sanitize` en un componente compartido `Application/Components/Molecules/RichText.tsx`.

- `react-markdown` construye **elementos React** (nunca `dangerouslySetInnerHTML`); el HTML crudo no se interpreta como activo (se muestra como texto), lo que neutraliza scripts incrustados.
- `remark-gfm` habilita tablas, tachado y listas de tareas (FR-001: bloques de código, listas, énfasis y tablas).
- `rehype-sanitize` añade defensa en profundidad (esquemas de URL, atributos).
- `RichText` recibe solo `text: string` y expone una prop de variante (`answer` | `reasoning`) para el estilo; no conoce el SDK ni el dominio.
- El razonamiento se muestra/oculta con `useReasoningVisibility()` (FR-002); el toggle es independiente de las respuestas.

**Rationale**: FR-001 exige formato enriquecido **y** neutralizar contenido no confiable. `react-markdown` es el camino seguro (React-native, sin inyección de HTML) y probado; un parser propio sería propenso a errores en tablas/enlaces y no aporta seguridad. El componente es genérico (Application), de modo que Inspector y History lo comparten sin imports cruzados entre dominios.

**Alternatives considered**:
- Parser markdown propio + render estructurado sin dependencias: cero deps, pero reimplementar tablas/enlaces/énfasis es frágil y aumenta el riesgo de XSS; descartado.
- `marked` + `DOMPurify` + `dangerouslySetInnerHTML`: eficaz pero reintroduce HTML crudo en el DOM; descartado por seguridad.
- `react-markdown` sin `rehype-sanitize`: el HTML ya se ignora, pero se pierde la validación de URLs/atributos; se mantiene la dep por defensa en profundidad.

---

## R2. Ampliación del wrapper de lectura del SDK (FR-037, Principio III)

**Decision**: Extender `OpenCodeService` en `Infrastructure/Services/opencodeClient.ts` con métodos de **solo lectura**, uno por endpoint, sin lógica de negocio:

| Método | Endpoint SDK | Retorno (tipo SDK) |
|--------|--------------|--------------------|
| `getHistoryMessages(id, cursor?)` | `message.list` (`limit` 200, `order: 'desc'` en la 1ª página) | `{ messages: TSessionMessage[]; nextCursor: string \| null }` |
| `getSessionDiff(id)` | `session.diff` | `FileDiffInfo[]` |
| `getSessionStats(input?)` | `session.stats` | `SessionStatsInfo` |
| `listSessionForms(id)` | `session.form.list` | `FormInfo[]` |
| `getSessionForm(id, formID)` | `session.form.get` | `FormDetail` |
| `listSessionInbox(id)` | `session.inbox.list` | `SessionInboxInfo[]` |
| `getSessionContext(id)` | `session.context` | `SessionMessageInfo[]` |
| `getSessionLog(id)` | `session.log` (`follow: false`) | `SessionLogItem[]` |
| `exportSession(id, sanitize?)` | `session.export` | `SessionTransferData` |

`getSessionMessages` (acotado, `order: 'asc'`) se mantiene para el grafo y el inspector (el resumen del grafo conserva su carga acotada — Assumption de la spec).

**Rationale**: la constitución exige que el SDK se toque solo aquí y que la app sea de solo lectura. Se exponen exactamente los endpoints de lectura que la spec necesita; los métodos son wrappers finos (sin transformar más allá de normalizar mensajes, ya existente).

**Consumidores y endpoints no consumidos**:
- `session.diff` → US5 (FileChanges).
- `session.form.list`/`get` → US6 (QuestionsSection).
- `session.inbox.list` → FR-034 (cola) y entradas de inbox.
- `session.context` → detalle del episodio de compactación (contexto resultante), cargado bajo demanda.
- `session.log` → siembra de señales de ejecución (retry/compactación/resultado/interrupción) para US3.
- `session.stats` y `session.export` se exponen por completitud de la superficie de lectura, pero **no se cablean** a las vistas: `session.stats` es un agregado por proyecto/rango (no por sesión) y el resumen de sesión se deriva localmente (Assumption de la spec, R10); `session.export` devolvería toda la sesión de golpe, lo que contradice la carga progresiva (R3).

**Alternatives considered**:
- Exponer solo los endpoints que se consumen: incumple la instrucción de ampliar el wrapper con la superficie de lectura nombrada; se descarta.
- Añadir `session.import`/`form.reply`/`interrupt`: son escrituras; violan el Principio I; descartado.

---

## R3. Carga progresiva del histórico, sin tope y fluida (US2, FR-013, FR-016, SC-011)

**Decision**:
- El histórico usa una **query infinita propia** (`queryKeys.sessions.history(id)`) con `useInfiniteQuery` sobre `getHistoryMessages`. La primera página es la **más reciente** (`order: 'desc'`, 200 entradas); el timeline la invierte para mostrarla en orden cronológico ascendente y, al desplazarse hacia arriba, carga páginas más antiguas (`getNextPageParam = nextCursor`). Sin tope fijo: se sigue mientras el cursor exista.
- Un centinela `IntersectionObserver` dispara `fetchNextPage`; un hook `useHistoryPagination` encapsula el estado (`hasNextPage`, `isFetchingNextPage`, `isFetchNextPageError`).
- Fluidez sin dependencia nueva: cada entrada usa `content-visibility: auto` + `contain-intrinsic-size`, de modo que el navegador omite el render fuera de pantalla.
- **FR-016**: si una página falla, se muestra un aviso explícito ("No se pudo recuperar toda la actividad; puede faltar contenido") sin presentar lo cargado como la sesión completa. Un `hasNextPage === false` normal **no** es una truncación y no muestra aviso.
- El grafo mantiene su query acotada (`getSessionMessages`), por lo que el histórico no comparte caché con el grafo.

**Rationale**: FR-013 pide ampliar sin tope fijo y sin volcar todo; `useInfiniteQuery` es el patrón TanStack idiomático. Empezar por lo más reciente respeta la expectativa de "ver qué pasó al final" sin cargar miles de entradas. `content-visibility` cubre SC-011 sin añadir virtualización JS.

**Alternatives considered**:
- Reutilizar la caché `messages(id)` y ampliarla: mezclaría la carga acotada del grafo con la ilimitada del histórico y arriesgaría el resumen; descartado.
- Cargar todo con `session.export`: contradice FR-013; descartado.
- Añadir `@tanstack/react-virtual`: virtualización robusta, pero añade dependencia y complejidad de medición; `content-visibility` + carga por páginas es suficiente para SC-011; descartado.

---

## R4. Estado de ejecución enriquecido (US3, FR-017..FR-023)

**Decision**: Ampliar `TNodeStatus` (en `Graph.entity.ts`) de 5 a **9 estados** (se conserva el nombre del tipo y el campo `data.status` para minimizar el churn):

```ts
export type TNodeStatus =
  | 'created'            // creada, sin actividad (FR-021)
  | 'running'            // ejecutando
  | 'retrying'           // reintentando (FR-018)
  | 'compacting'         // compactando contexto
  | 'waiting-permission' // esperando permiso (FR-031)
  | 'waiting-input'      // esperando respuesta del usuario (FR-032)
  | 'succeeded'          // terminada con éxito (FR-021)
  | 'failed'             // fallida
  | 'interrupted';       // interrumpida (FR-019)
```

`toNodeStatus(input)` en `Graph/lib/nodeStatus.ts` aplica esta prioridad (FR-020: un fallo superado nunca tiñe de error a una ejecución activa o terminada con éxito):

```ts
interface NodeStatusInput {
  status?: SessionStatus;                 // live: idle | busy | retry(attempt, next)
  hasActivity: boolean;
  hasPermission: boolean;                 // PermissionRequest presente
  hasPendingForm: boolean;                // formulario pendiente
  compaction: 'running' | 'completed' | 'failed' | null;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  lastAssistantErrored: boolean;          // solo para sesiones sin outcome
}
```

Orden: `retrying` → `compacting` → `waiting-input` → `waiting-permission` → `running` → `interrupted` → `failed` → `succeeded` → (`hasActivity ? (lastAssistantErrored ? 'failed' : 'succeeded') : 'created')`.

`TGraphNodeData` gana `retry: { attempt: number; next: number | null } | null` (FR-018) y `interruptReason: string | null` (FR-019). Se exporta un predicado puro `isActiveStatus(status)` = `running | retrying | compacting | waiting-permission | waiting-input`, que reemplaza las comparaciones dispersas `status === 'running' || status === 'waiting'` (AgentNode, AgentGraph, useGraphModel).

Los mapas de color/etiqueta por componente (`StatusDot`, `NodeStatusRail`, `ExecutionLanes`, `AgentNode`, `AgentGraph.STATUS_RANK`, `InspectorPanel`) se amplían a los 9 estados reutilizando los tokens existentes.

**Rationale**: los 9 estados son el requisito literal de FR-017 y deben ser consistentes nodo↔detalle (FR-023). Ampliar el tipo existente evita un campo dual que podría desincronizarse; la prioridad resuelve FR-020 de forma explícita y testeable.

**Alternatives considered**:
- Mantener 5 estados y añadir `executionState` aparte: dos fuentes de verdad para el mismo hecho; descartado.
- Un enum numérico o de strings externo al modelo: rompe la derivación pura y el tipado; descartado.

---

## R5. Señales de ejecución en vivo y siembra durable (US3, FR-018, FR-019)

**Decision**:
- Nueva caché `queryKeys.sessions.execution(id)` con el view-model `TExecutionSignal`:
  ```ts
  interface TExecutionSignal {
    retry: { attempt: number; next: number | null } | null;
    compaction: 'running' | 'completed' | 'failed' | null;
    outcome: 'succeeded' | 'failed' | 'interrupted' | null;
    interruptReason: string | null;
  }
  ```
- `eventReducer` se extiende para parchear esa caché (puro y testeable): `session.retry.scheduled` → `retry`; `session.compaction.started/ended/failed` → `compaction`; `session.execution.succeeded/failed/interrupted` → `outcome` (+ `interruptReason` con `data.reason`); `session.status` con `type: 'retry'` también aporta `attempt`/`next`.
- **Siembra inicial**: `useExecutionSignals(id)` combina (a) el log durable `session.log` (`follow: false`) para reconstruir retry/compaction/outcome/reason ya persistidos, y (b) la caché en vivo de eventos. Si el servidor no reporta el motivo de una interrupción, se muestra "no disponible" (edge case).
- `useGraphModel` combina las señales por nodo con `statuses`, `permissions`, `forms` e inbox para alimentar `toNodeStatus`.

**Rationale**: el **evento** `session.idle` no trae `outcome` (el **mensaje** durable `SessionMessageIdle` sí) y el motivo de interrupción solo existe en el evento durable; usar `session.log` para sembrar hace que el estado enriquecido sea correcto en la primera carga sin esperar a SSE, y los eventos lo mantienen al día. Todo el reducer sigue siendo una función pura.

**Alternatives considered**:
- Depender solo de los eventos SSE: el estado se perdería al recargar; descartado.
- Leer `outcome` solo de los mensajes `SessionMessageIdle`: no cubre el motivo de interrupción ni el retry programado; se usa como complemento (R7), no como única fuente.

---

## R6. Contenido de respuestas y razonamiento sin deltas (FR-005, FR-006)

**Decision**: `eventReducer` deja de ignorar por completo los eventos de texto y **solo** procesa los consolidados:
- `session.text.ended` → inserta/reemplaza la parte `text` por `ordinal` en el mensaje assistant.
- `session.reasoning.ended` → inserta/reemplaza la parte `reasoning` por `ordinal`.
- `session.message.content.updated` → reemplaza `content` del mensaje con la **instantánea durable completa** (es un reemplazo de contenido consolidado, no incremental): no es un delta, así que no viola FR-005 ni el Principio VII.
- **Se ignoran explícitamente** `session.text.delta`, `session.reasoning.delta` y `session.tool.input.delta`/`session.tool.progress` (FR-005, Principio VII).

Una respuesta assistant se considera **en curso** mientras `info.time.completed === undefined`; en ese caso el timeline la marca "en curso" y no presenta un texto parcial como completo (FR-006). Como el texto solo se incorpora con `text.ended`, lo mostrado siempre está consolidado.

**Rationale**: cumple FR-005/FR-006 al pie de la letra y mantiene el Principio VII (sin deltas). El orden por `ordinal` preserva la secuencia de partes.

**Alternatives considered**:
- Acumular deltas y mostrar palabra a palabra: prohibido por la spec y por el Principio VII; descartado.
- No tocar los eventos de texto y depender solo del refetch: la sesión viva mostraría texto con retraso y con huecos; descartado.

---

## R7. Construcción del timeline del histórico (US1/US2, FR-009)

**Decision**: función pura `buildHistory(messages: TSessionMessage[]): THistoryEntry[]` que aplanan los mensajes normalizados en una unión discriminada ordenada por `info.time.created` y, dentro de un assistant, por el orden de `content`:

| Tipo de entrada | Origen SDK |
|-----------------|------------|
| `user` | `SessionMessageUser` (`text` + `files`/`agents`/`skills` por nombre; FR-007) |
| `answer` | `SessionMessageAssistantText` (en curso si el assistant no está completo; FR-006) |
| `reasoning` | `SessionMessageAssistantReasoning` |
| `tool` | `SessionMessageAssistantTool` (input/resultado/error + duración; FR-004, FR-011) |
| `agent-switched` | `SessionMessageAgentSelected` |
| `model-switched` | `SessionMessageModelSelected` |
| `location-switched` | `SessionMessageLocationSwitched` |
| `system` / `synthetic` / `skill` / `shell` | tipos homónimos |
| `compaction` | `SessionMessageCompaction` con estado running/completed/failed (FR-035) |
| `idle` | `SessionMessageIdle` (resultado final) |

**Rationale**: `SessionMessageInfo` ya cubre todo lo que FR-009 pide (mensajes, respuestas, razonamiento, herramientas, cambios de agente/modelo/ubicación, avisos de sistema, entradas sintéticas/skill, compactación y cierre de turno), por lo que el timeline se deriva sin request extra y es 100% testeable. Se evita duplicar el timeline con `session.log`.

**Alternatives considered**:
- Construir el timeline desde `session.log` (eventos durables): incluiría eventos que no son entradas de conversación (usage, inbox, revert) y obligaría a filtrar; los mensajes ya son la proyección correcta; descartado.
- Renderizar los mensajes crudos sin aplanar: el componente necesitaría conocer la estructura del SDK y no habría test puro; descartado.

---

## R8. Preguntas y permisos (US6, FR-031..FR-034)

**Decision**:
- **Permisos**: `useSessionPermissions(id)` (ya existe `getSessionPermissions`) alimenta `QuestionsSection`; se muestra `action` (operación) y `resources[]` (FR-031). El estado `waiting-permission` se deriva de que exista una `PermissionRequest` para la sesión.
- **Preguntas**: `useSessionForms(id)` llama `session.form.list(id)` y, por cada formulario, `session.form.get(id, formID)` para resolver `state` (`pending` | `answered` | `cancelled`); se muestran `title`, `fields[].title/options` y la respuesta cuando existe (FR-032, FR-033). Un formulario `pending` alimenta `waiting-input`.
- **Cola**: `useSessionInbox(id)` llama `session.inbox.list(id)`; `queuedTurns = items.filter(i => i.delivery === 'queue').length` (FR-034).
- **Timeline**: las preguntas aparecen además como la **llamada a herramienta** que las originó (input = pregunta/opciones, resultado = respuesta), ya presente en `buildHistory`; así FR-033 se cumple en su posición cronológica sin inventar un timestamp para el formulario (los tipos `FormInfo`/`FormDetail` no exponen tiempo).

**Rationale**: `FormInfo` no trae estado y no expone tiempo; componer `list`+`get` da el estado con N pequeño (los formularios de una sesión son pocos). Anclar la pregunta a su tool call resuelve la cronología sin datos que el SDK no da.

**Alternatives considered**:
- Colocar el formulario en el timeline usando un timestamp inventado: violaría FR-038; descartado.
- Ignorar los formularios y mostrar solo el tool call: no daría el estado pendiente/respondida/cancelada estructurado (FR-033); descartado.

---

## R9. Impacto en el repositorio (US5, FR-028..FR-030)

**Decision**: `useSessionDiff(id)` llama `session.diff` y devuelve `FileDiffInfo[]`. `FileChanges` muestra la lista (`file`, estado añadido/modificado/borrado, `+additions`/`-deletions`) y, al seleccionar un archivo, su `patch` en mono. Sin cambios → estado vacío explícito ("Sin cambios de archivos", FR-030). Parche ausente/vacío o muy grande → se muestra el estado y las líneas e indica "parche no disponible", sin bloquear (edge case).

**Rationale**: `session.diff` es la fuente directa del dato y devuelve exactamente estado + líneas + parche. La selección es estado de vista local.

**Alternatives considered**:
- Reconstruir el diff desde los `files` de los pasos (`session.step.ended`): incompleto y sin parche; descartado.
- `vcs.diff`: es del repositorio, no del agente; descartado.

---

## R10. Resumen de sesión (US4, FR-024..FR-027)

**Decision**: reutilizar y extender la función pura `summarizeSession(root, graph, resources)` (ya existente en `Graph/lib/deriveMetrics.ts`) para devolver, además de lo actual, `createdCount`, `retryingCount`, `compactingCount`, `interruptedCount`, `succeededCount` y `elapsedMs` (de `min(startedAt)` a `max(endedAt)`, o `now - start` si sigue activa). `SessionSummaryBar` lo renderiza en la cabecera del grafo (contadores, coste, tokens, tiempo). FR-027: la barra es fija y se actualiza en el sitio, sin reordenar el grafo.

**Rationale**: la Assumption de la spec dice que el resumen agrega los datos de los agentes ya cargados y no introduce una carga distinta a la del grafo; `summarizeSession` ya hace ese agregado y es puro/testeable. Por eso `session.stats` (agregado por proyecto) no se usa aquí.

**Alternatives considered**:
- Usar `session.stats`: es por proyecto/rango, no por sesión, y añadiría una carga ajena al grafo; descartado.

---

## R11. Duración mediana por herramienta y cola (US7, FR-034, FR-036)

**Decision**: función pura `medianToolDurations(tools: TToolHistoryEntry[]): TToolStat[]` que agrupa por `name`, cuenta y calcula la mediana de `endedAt - startedAt` de las ejecuciones con ambos tiempos. `ToolHistory` (Inspector) muestra, además de las ejecuciones, una fila por herramienta con `calls` y mediana. La cola (`queuedTurns`) se muestra en `QuestionsSection`.

**Rationale**: el dato ya está en las partes de tool cacheadas; no hace falta un request y se cubre con un test determinista. Se evita depender de `session.stats.durationP50`, que es por proyecto.

**Alternatives considered**:
- Usar `session.stats` con `tools: 'detail'`: por proyecto, no por agente; descartado.
- Mostrar promedio en vez de mediana: la spec pide mediana (FR-036); descartado.

---

## R12. Overlay del histórico, linaje y ciclo de vida (US2, FR-008, FR-012, FR-014, edge cases)

**Decision**:
- El histórico es un **overlay a pantalla completa** (`HistoryModal`) gobernado por `WorkspacePage` con un estado `historySessionId: string | null`; no es una ruta, de modo que cerrarlo devuelve al grafo con la misma selección y disposición (FR-014).
- Apertura: (a) botón "Ver histórico completo" en el Inspector (FR-008); (b) **doble clic** sobre el nodo (`onNodeDoubleClick` de React Flow → `onOpenHistory(nodeId)`, FR-008, SC-003).
- Navegación de linaje (FR-012, SC-004): la cabecera muestra "Invocado por" (padre) y "Invocó a" (hijos) calculados desde las aristas del grafo; al elegir uno, `historySessionId` cambia sin cerrar el overlay.
- Ciclo de vida: al cambiar la sesión raíz se cierra el histórico; si el objetivo desaparece del grafo, el overlay se marca "no disponible" y se cierra (edge case). En móvil, el overlay ocupa toda la pantalla con la misma lógica (FR-040).

**Rationale**: un overlay (no ruta) preserva por construcción la selección/modo cadena del grafo y encaja con la clarificación "modal". El doble clic es un gesto directo (SC-003) sin afectar el clic simple (selección/modo cadena).

**Alternatives considered**:
- Una ruta dedicada: obligaría a rehidratar selección/disposición y a manejar el historial del navegador; el overlay es más simple y fiel a FR-014; descartado.
- Abrir el histórico desde la lista de sesiones: la clarificación Q2 lo excluye; descartado.

---

## R13. Estrategia de pruebas (Principio V y VIII)

**Decision**:
- **Puras** (`lib/specs/`): `buildHistory.spec.ts` (orden, intercalado de tools, en curso, adjuntos, compaction, idle), `nodeStatus.spec.ts` (9 estados y prioridad FR-020), `deriveMetrics.spec.ts` (conteos nuevos + elapsed), `eventReducer.spec.ts` (text/reasoning ended, retry, compaction, outcome, inbox, forms; ignora deltas), `medianToolDurations.spec.ts` (0/1/varias, mediana par/impar, faltantes).
- **Hooks** (`Hooks/specs/` con `renderWithProviders`): `useExecutionSignals`, `useHistoryPagination` (cursor, error de página), `useHistory` (abrir/cerrar/linaje), `useReasoningVisibility`, `useInspectorData` (secciones).
- **Componentes** (Testing Library): `RichText` (listas, código, tabla, énfasis, neutralización de HTML/`javascript:`), `HistoryModal`/`HistoryTimeline`/`ToolCallEntry` (expandir, vacío, en curso), `AnswersSection` (toggle razonamiento), `FileChanges` (lista, parche, vacío), `QuestionsSection` (permiso, pregunta pendiente/respondida), `SessionSummaryBar` (contadores), `AgentNode`/`ToolHistory` (estado enriquecido y mediana).
- **Integración**: `live.integration.spec.ts` (ya existente) se extiende con el fixture `run.ndjson` para verificar que el estado enriquecido y el timeline se derivan de eventos reales.

**Rationale**: la constitución exige lógica pura testeada; los casos límite (en curso, vacío, faltantes, FR-020) se cubren con unit tests deterministas sin servidor vivo, y los flujos visibles con RTL.

**Alternatives considered**:
- Solo tests end-to-end: lentos y frágiles; se reservan a los flujos visibles; descartado como única estrategia.

---

## Open questions

Ninguna. Todos los puntos técnicos quedaron resueltos con APIs y tipos existentes de `@opencode/client` 2.0.22, de React Flow 12 y de TanStack Query 5; la spec no contiene `NEEDS CLARIFICATION`.
