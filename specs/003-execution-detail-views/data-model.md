# Data Model — Detalle de ejecución de agentes

**Feature**: `003-execution-detail-views`
**Date**: 2026-10-07
**Input**: [spec.md](./spec.md), [research.md](./research.md)

Esta feature **no** introduce backend ni persistencia: todos los datos crudos vienen del SDK de OpenCode y los tipos nuevos son **view-models** (prefijo `T`, Principio IV). Los datos crudos se reutilizan tal cual; solo se amplían tipos de vista existentes (el estado del nodo) y se añaden proyecciones para las nuevas vistas.

---

## 1. Datos del servidor (SDK) usados por esta feature

| Tipo SDK | Origen | Campos usados |
|----------|--------|----------------|
| `SessionMessageInfo` | `message.list`, `session.context`, `session.export` | unión de mensajes: `user`, `assistant` (con `content`), `agent-switched`, `model-switched`, `location-switched`, `synthetic`, `system`, `skill`, `shell`, `compaction`, `idle` |
| `SessionMessageAssistantText` | contenido de assistant | `text` (consolidado), `state?` |
| `SessionMessageAssistantReasoning` | contenido de assistant | `text`, `time?` |
| `SessionMessageAssistantTool` | contenido de assistant | `id`, `name`, `state` (streaming/running/completed/error), `time` |
| `SessionMessageCompaction` | mensajes | `status` running/completed/failed, `reason`, `summary`/`recent` |
| `SessionMessageIdle` | mensajes | `outcome` succeeded/failed/interrupted |
| `SessionStatus` | `session.active` + eventos | `idle` \| `busy` \| `retry{attempt, message, next}` |
| `SessionInboxInfo` | `session.inbox.list` | `type` user/synthetic/compaction/move, `delivery` steer/queue |
| `FormInfo` | `session.form.list` | `id`, `sessionID`, `title`, `fields` |
| `FormDetail` | `session.form.get` | + `state` pending/answered/cancelled |
| `PermissionRequest` | `permission.list` | `action`, `resources`, `message?` |
| `FileDiffInfo` | `session.diff` | `file`, `patch`, `additions`, `deletions`, `status` |
| `SessionLogItem` | `session.log` | `SessionEventDurable` (retry/compaction/execution/inbox/…) |
| `SessionStatsInfo` | `session.stats` | (por proyecto; wrapper expuesto, no cableado — R2/R10) |
| `SessionTransferData` | `session.export` | `{ info, messages }` (wrapper expuesto, no cableado — R2/R3) |

---

## 2. View-models nuevos

### 2.1 Estado de ejecución — `TNodeStatus` (Graph, ampliado)

`TNodeStatus` deja de tener 5 valores y pasa a 9 (FR-017). Se conserva el nombre y el campo `data.status`.

| Valor | Significado | FR |
|-------|-------------|----|
| `created` | creada, sin actividad | FR-021 |
| `running` | ejecutando | FR-017 |
| `retrying` | reintentando | FR-018 |
| `compacting` | compactando contexto | FR-017 |
| `waiting-permission` | esperando permiso | FR-031 |
| `waiting-input` | esperando respuesta del usuario | FR-032 |
| `succeeded` | terminada con éxito | FR-021 |
| `failed` | fallida | FR-019 |
| `interrupted` | interrumpida | FR-019 |

`TGraphNodeData` añade:

| Campo | Tipo | Regla |
|-------|------|-------|
| `retry` | `{ attempt: number; next: number \| null } \| null` | solo si `retrying`; `next` puede faltar (edge case) |
| `interruptReason` | `string \| null` | motivo de la interrupción; `null` → "no disponible" (edge case) |

Predicado puro `isActiveStatus(status)` → `running \| retrying \| compacting \| waiting-permission \| waiting-input`.

### 2.2 Señal de ejecución — `TExecutionSignal` (Graph)

Estado en vivo por sesión, cacheado en `queryKeys.sessions.execution(id)`.

| Campo | Tipo | Regla |
|-------|------|-------|
| `retry` | `{ attempt: number; next: number \| null } \| null` | de `session.retry.scheduled` / `session.status` retry / `session.log` |
| `compaction` | `'running' \| 'completed' \| 'failed' \| null` | del último episodio (`session.compaction.*` / mensaje compaction / log) |
| `outcome` | `'succeeded' \| 'failed' \| 'interrupted' \| null` | de `session.execution.*` (evento) o del **mensaje** `SessionMessageIdle` (log/histórico); el **evento** `session.idle` no aporta `outcome` |
| `interruptReason` | `string \| null` | de `session.execution.interrupted.data.reason`; si falta → `null` |

### 2.3 Entradas del histórico — `THistoryEntry` (History)

Unión discriminada por `kind`, ordenada cronológicamente (FR-009). `id` es estable (id del mensaje + ordinal de la parte).

| `kind` | Campos propios | Origen |
|--------|----------------|--------|
| `user` | `text`, `attachments: { kind: 'file'\|'agent'\|'skill'; name: string \| null }[]`, `at` | `SessionMessageUser` (FR-007) |
| `answer` | `text`, `at`, `isComplete: boolean` | `SessionMessageAssistantText` (FR-006) |
| `reasoning` | `text`, `at`, `isComplete: boolean` | `SessionMessageAssistantReasoning` |
| `tool` | `entry: TToolEntry` | `SessionMessageAssistantTool` |
| `agent-switched` | `agent`, `previous: string \| null`, `at` | `SessionMessageAgentSelected` |
| `model-switched` | `model: ModelRef`, `previous: ModelRef \| null`, `at` | `SessionMessageModelSelected` |
| `location-switched` | `directory`, `at` | `SessionMessageLocationSwitched` |
| `system` | `text`, `description: string \| null`, `at` | `SessionMessageSystem` |
| `synthetic` | `text`, `description: string \| null`, `at` | `SessionMessageSynthetic` |
| `skill` | `skill`, `name`, `text`, `at` | `SessionMessageSkill` |
| `shell` | `command`, `status`, `exit: number \| null`, `at` | `SessionMessageShell` |
| `compaction` | `status: 'running'\|'completed'\|'failed'`, `reason`, `summary: string \| null`, `at` | `SessionMessageCompaction` (FR-035) |
| `idle` | `outcome: 'succeeded'\|'failed'\|'interrupted'`, `at` | `SessionMessageIdle` |

`buildHistory(messages: TSessionMessage[]): THistoryEntry[]` es pura, no muta la entrada y no depende del SDK en runtime (solo de los tipos).

### 2.4 Llamada a herramienta — `TToolEntry` (History)

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | `string` | id del parte |
| `name` | `string` | nombre de la herramienta |
| `status` | `'streaming' \| 'running' \| 'completed' \| 'error'` | estado real; nunca se inventa resultado (edge case) |
| `input` | `unknown` | entrada cruda serializada para mostrar |
| `result` | `string \| null` | texto del resultado (o `null`) |
| `error` | `string \| null` | mensaje de error si falló (FR-004) |
| `startedAt` | `number \| null` | `time.created` |
| `completedAt` | `number \| null` | `time.completed` (o `null` si no terminó) |
| `durationMs` | `number \| null` | `completedAt - startedAt` si ambos |

### 2.5 Cambio de archivo — `TFileChange` (Inspector)

Alias de `FileDiffInfo` (Principio IV: no se redefine lo que el SDK ya exporta). `status` ∈ `added | modified | deleted`; `additions`/`deletions` son líneas; `patch` puede venir vacío → "parche no disponible".

### 2.6 Pregunta al usuario — `TQuestionEntry` (Inspector)

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | `string` | id del formulario |
| `title` | `string` | texto de la pregunta |
| `fields` | `{ key: string; title: string \| null; type: string; options: { value: string; label: string }[] }[]` | opciones ofrecidas (FR-032) |
| `state` | `'pending' \| 'answered' \| 'cancelled'` | FR-033 |
| `answer` | `string \| null` | respuesta formateada si `answered` |

### 2.7 Permiso — `TPermissionEntry` (Inspector)

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | `string` | id de la solicitud |
| `action` | `string` | operación afectada (FR-031) |
| `resources` | `string[]` | recursos afectados |
| `message` | `string \| null` | motivo textual si el servidor lo da |

### 2.8 Estadística de herramienta — `TToolStat` (Inspector)

| Campo | Tipo | Regla |
|-------|------|-------|
| `name` | `string` | nombre |
| `calls` | `number` | ejecuciones de esa herramienta |
| `medianMs` | `number \| null` | mediana de duraciones con ambos tiempos; `null` si no hay ninguna (FR-036) |

`medianToolDurations(tools: TToolHistoryEntry[]): TToolStat[]` es pura.

### 2.9 Resumen de sesión — `TSessionSummary` (tipo en `Inspector.entity.ts`, agregación en `Graph`)

Extiende `TSessionSummary` existente (`Inspector.entity.ts`) con los conteos nuevos y el tiempo:

| Campo nuevo | Tipo | Regla |
|-------------|------|-------|
| `createdCount` | `number` | nodos en `created` |
| `retryingCount` | `number` | nodos en `retrying` |
| `compactingCount` | `number` | nodos en `compacting` |
| `interruptedCount` | `number` | nodos en `interrupted` |
| `succeededCount` | `number` | nodos en `succeeded` |
| `elapsedMs` | `number \| null` | `max(endedAt) - min(startedAt)`; si activa, `now - min(startedAt)`; `null` sin actividad |

Se conservan `runningCount`, `waitingCount` (agrupa `waiting-permission` + `waiting-input`), `errorCount` (**cuenta solo `failed`**; `interrupted` se cuenta aparte en `interruptedCount`), `agentCount`, `cost`, `tokens`. `summarizeSession` es pura.

### 2.10 Linaje — `TLineageNav` (History)

| Campo | Tipo | Regla |
|-------|------|-------|
| `parentId` | `string \| null` | sesión que invocó (arista `target → source`) |
| `childrenIds` | `string[]` | sesiones invocadas por la actual |

Se deriva de `TGraphModel` (aristas padre→hijo) en `WorkspacePage`; el overlay solo recibe el resultado.

### 2.11 Estado de vista compartido

| Tipo | Dominio | Regla |
|------|---------|-------|
| `THistoryTarget` | History | `string \| null` = sesión cuyo histórico está abierto |
| `TReasoningVisibility` | Application | `{ visible: boolean; toggle: () => void }` (FR-002) |

---

## 3. Relaciones

```text
SessionMessageInfo[] ──buildHistory──> THistoryEntry[] ──> HistoryTimeline (UI)
SessionMessageAssistantTool ──> TToolEntry ──> ToolCallEntry (expandir)
TToolHistoryEntry[] ──medianToolDurations──> TToolStat[] ──> ToolHistory (UI)

(SessionStatus, permissions, forms, inbox, TExecutionSignal)
   ──toNodeStatus──> TNodeStatus ──> AgentNode / NodeStatusRail / InspectorPanel
TGraphModel ──summarizeSession──> TSessionSummary ──> SessionSummaryBar

FileDiffInfo[] ──> TFileChange[] ──> FileChanges (UI)
FormDetail[] ──> TQuestionEntry[] ──┐
PermissionRequest[] ──> TPermissionEntry[] ──> QuestionsSection (UI)
SessionInboxInfo[] ──queuedTurns──┘

TGraphModel (aristas) ──> TLineageNav ──> HistoryHeader (navegación)
```

---

## 4. Reglas de validación

- **FR-020**: un error ya superado nunca marca `failed` a una ejecución activa o `succeeded`; la prioridad de `toNodeStatus` lo garantiza (R4).
- **FR-021**: `created` (sin actividad) y `succeeded` (con actividad/outcome) son estados distintos; nunca se confunden.
- **FR-038**: todo dato ausente (modelo, directorio, título, motivo de interrupción, `next` de reintento, parche, mediana) se muestra como "no disponible"; nunca `0`, `""` ni un valor inventado.
- **FR-005/006**: solo se incorpora texto consolidado (`text.ended`/`reasoning.ended`/`content.updated`); un assistant sin `time.completed` se marca "en curso" y su texto nunca se presenta como completo.
- **FR-013/016**: el histórico pagina sin tope fijo; un fallo de página muestra un aviso explícito y no presenta lo cargado como la sesión completa.
- **FR-007**: los adjuntos se muestran por nombre; sin nombre → "sin nombre" (no se omite).
- **FR-030**: sin archivos afectados → estado vacío explícito.
- **FR-033**: `pending`/`cancelled` nunca se muestran como `answered`.
- **FR-035**: una compactación `failed` se marca como fallida, nunca como exitosa.
- Los view-models nuevos **no** se validan con Zod (son estado interno tipado); Zod se reserva a datos de usuario (Principio IV).
- El histórico no muta la caché del grafo: vive en su propia query (`queryKeys.sessions.history(id)`).
