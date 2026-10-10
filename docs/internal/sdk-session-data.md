# Datos de sesión disponibles vía `@opencode/client`

Referencia de la **superficie de datos por sesión** que expone el SDK V2 que usa
este proyecto.

- Versión analizada: `@opencode/client@2.0.22` (protocolo/schema `2.0.22`).
- Fuente de verdad de los tipos (no copiada de memoria):
  - `node_modules/@opencode/client/dist/promise/generated/types.d.ts`
  - `node_modules/@opencode/client/dist/promise/generated/client.d.ts`
- Acceso en el código: wrapper único en
  `src/Infrastructure/Services/opencodeClient.ts` (Constitución III). No llamar al
  cliente del SDK desde componentes.
- Recordatorio V2: los mensajes son **planos** (`SessionMessageInfo[]`, sin
  `info` + `parts`). El endpoint `session.status` ya no existe: el estado en
  curso se obtiene con `session.active()` y se mantiene con eventos SSE.

---

## 1. Entidad central: `SessionInfo`

Devuelta por `session.get`, `session.list`, `session.create/fork/import` y como
`session.export.info`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `string` | |
| `parentID?` | `string` | ausente = sesión raíz |
| `projectID` | `string` | |
| `agent?` | `string` | id del agente activo |
| `model?` | `ModelRef` | `{ id, providerID, variant? }` |
| `cost` | `MoneyUSD` (`number`) | costo acumulado en USD |
| `tokens` | `TokenUsageInfo` | `{ input, output, reasoning, cache: { read, write } }` |
| `outcome?` | `"succeeded" \| "failed" \| "interrupted"` | |
| `time` | `{ created, updated, idle?, viewed?, archived? }` | timestamps (ms) |
| `title?` | `string` | |
| `subpath?` | `string` | subruta dentro del proyecto |
| `fork?` | `{ sessionID: string, boundary: SessionForkBoundary }` | `boundary = { type: 'before' \| 'through', messageID }` |
| `metadata?` | `SessionMetadata` (`Record<string, JsonValue>`) | libre |
| `permissions?` | `PermissionRuleset` = `PermissionRule[]` | `{ action, resource, effect: 'allow' \| 'deny' \| 'ask' }` |
| `revert?` | `SessionRevert` | `{ messageID, partID?, snapshot?, files?: FileDiffInfo[] }` |
| `location` | `LocationPublicRef` | `{ directory: string }` |

Tipos auxiliares:

```ts
type ModelRef = { id: string; providerID: string; variant?: string };
type TokenUsageInfo = {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
};
type MoneyUSD = number;
type JsonValue =
  | null | boolean | number | string
  | JsonValue[]
  | { [key: string]: JsonValue };
type FileDiffInfo = {
  file: string;
  patch: string;
  additions: number;
  deletions: number;
  status: 'added' | 'deleted' | 'modified';
};
type SessionStatus =
  | { type: 'idle' }
  | { type: 'retry'; attempt: number; message: string; action?: {...}; next: number }
  | { type: 'busy' };
```

---

## 2. Endpoints de lectura (`client.session.*`)

| Método | Input | Output |
|---|---|---|
| `session.list` | `{ limit?, order?, search?, parentID?, directory?, project?, subpath?, cursor? }` | `{ data: SessionInfo[], cursor: { previous?, next? } }` |
| `session.get` | `{ sessionID }` | `SessionInfo` |
| `session.active` | — | `{ [sessionID]: { type: 'running' } }` |
| `session.stats` | `{ from?, to?, project?, timezone?, tools?: 'none' \| 'summary' \| 'detail' }` | `SessionStatsInfo` |
| `session.context` | `{ sessionID }` | `SessionMessageInfo[]` (contexto vigente, útil post-compactación) |
| `session.diff` | `{ sessionID, from? }` | `FileDiffInfo[]` |
| `session.message.get` | `{ sessionID, messageID }` | `SessionMessageInfo` |
| `session.export` | `{ sessionID }` | `SessionTransferData` = `{ info: SessionInfo, messages: SessionMessageInfo[] }` |
| `session.instructions.entry.list` | `{ sessionID }` | `InstructionEntryInfo[]` = `{ key: string, value: JsonValue }` |
| `session.inbox.list` | `{ sessionID }` | `SessionInboxInfo[]` |
| `session.form.list` | `{ sessionID }` | `FormInfo[]` |
| `session.form.get` | `{ sessionID, formID }` | `FormDetail` |
| `session.log` | `{ sessionID }` | `AsyncIterable<SessionLogItem>` (`SessionEventDurable \| EventLogSynced`) |
| `message.list` (top-level) | `{ sessionID, limit?, order?, cursor?, type? }` | `{ data: SessionMessageInfo[], cursor }` |
| `permission.list` | `{ sessionID }` | `PermissionRequest[]` |
| `permission.get` | `{ ... }` | `PermissionRequest` |
| `permission.saved.list` | `{ ... }` | `PermissionSavedInfo[]` |

Ejemplo:

```ts
import { opencodeClient } from '@app/Infrastructure/Services/opencodeClient';

const { data: sessions, cursor } = await opencodeClient.session.list({
  directory,
  order: 'desc',
  limit: 200,
});

const info = await opencodeClient.session.get({ sessionID });
const { data: messages } = await opencodeClient.message.list({
  sessionID,
  limit: 200,
  order: 'asc',
});
const diff = await opencodeClient.session.diff({ sessionID });
const stats = await opencodeClient.session.stats({ project: projectID, tools: 'detail' });
```

**Mutaciones existentes** (fuera del alcance read-only de esta app, pero
disponibles): `session.create/import/remove/fork/update/move`, `switchAgent`,
`switchModel`, `prompt`, `command`, `skill`, `synthetic`, `shell`, `compact`,
`wait`, `revert.stage/clear/commit`, `generate`, `interrupt`, `background`,
`environment`, `view`, `inbox.cancel/update`, `form.create/reply/cancel`,
`instructions.entry.put/remove`.

---

## 3. `SessionStatsInfo` (métricas agregadas)

```ts
type SessionStatsInfo = {
  range: { from: number; to: number };
  sessions: number;
  subagents: number;
  prompts: number;
  steps: number;
  tokens: TokenUsageInfo;
  cost: MoneyUSD;
  tools:
    | { mode: 'none' }
    | { mode: 'summary'; totals: SessionStatsToolTotals }
    | {
        mode: 'detail';
        totals: SessionStatsToolTotals;
        usage: SessionStatsToolUsage[]; // { name, calls, succeeded, failed, unfinished, durationP50? }
      };
  activeDays: number;
  streak: number;
  activity: Array<{ date: string; steps: number }>;
  models: Array<{
    model: ModelRef;
    steps: number;
    tokens: TokenUsageInfo;
    cost: MoneyUSD;
  }>;
};

type SessionStatsToolTotals = {
  calls: number;
  succeeded: number;
  failed: number;
  unfinished: number;
};
```

---

## 4. Mensajes: `SessionMessageInfo`

Unión discriminada por `type` (11 variantes). Todas traen `id`,
`time.created` y `metadata?`.

| `type` | Campos propios |
|---|---|
| `user` | `text`, `files?: PromptFileAttachment[]`, `agents?: PromptAgentAttachment[]`, `skills?: PromptSkillAttachment[]` |
| `assistant` | `agent`, `model`, `content[]`, `snapshot?`, `finish?`, `rawFinish?`, `providerState?`, `cost?`, `tokens?`, `error?`, `retry?` |
| `agent-switched` | `agent`, `previous?` |
| `model-switched` | `model`, `previous?` |
| `location-switched` | `projectID?`, `subpath?`, `location`, `previous?` |
| `system` | `text`, `description?` |
| `synthetic` | `text`, `description?` |
| `skill` | `skill`, `name`, `text` |
| `shell` | `shellID`, `command`, `status`, `exit?`, `output?` |
| `compaction` | `status: 'running' \| 'completed' \| 'failed'`, `reason: 'auto' \| 'manual'`, `summary`, `recent`, `model?`, `cost?`, `tokens?`, `error?` |
| `idle` | `outcome: 'succeeded' \| 'failed' \| 'interrupted'` |

### 4.1 `SessionMessageAssistant`

```ts
type SessionMessageAssistant = {
  id: string;
  time: { created: number; streamed?: number; completed?: number };
  type: 'assistant';
  agent: string;
  model: ModelRef;
  content: Array<
    SessionMessageAssistantText | SessionMessageAssistantReasoning | SessionMessageAssistantTool
  >;
  snapshot?: { start?: string; end?: string; files?: string[] };
  finish?: 'stop' | 'length' | 'tool-calls' | 'content-filter' | 'error' | 'unknown';
  rawFinish?: string;
  providerState?: SessionMessageProviderState; // Record<string, JsonValue>
  cost?: MoneyUSD;
  tokens?: TokenUsageInfo;
  error?: SessionStructuredError;
  retry?: { attempt: number; at: number; error: SessionStructuredError };
};
```

### 4.2 Partes de `assistant.content[]`

- `{ type: 'text'; text: string; state?: ProviderState }`
- `{ type: 'reasoning'; text: string; state?: ProviderState; time?: { created; completed? } }`
- `{ type: 'tool'; id; name; executed?; state; providerState?; providerResultState?; time: { created; ran?; completed? } }`

### 4.3 Estados de un tool call (`tool.state`)

| Estado | Campos |
|---|---|
| `streaming` | `{ status, input: string }` |
| `running` | `{ status, input: Record<string, JsonValue>, metadata }` |
| `completed` | `{ status, input, content: ToolContent[], metadata? }` |
| `error` | `{ status, input, error: SessionStructuredError, content?, metadata? }` |

```ts
type ToolContent =
  | { type: 'text'; text: string }
  | { type: 'file'; uri: string; mime: string; name?: string | null };
type SessionStructuredError = {
  type: string;
  message: string;
  status?: number;
  response?: { body: string };
};
```

### 4.4 Adjuntos de un prompt (`user`)

```ts
type PromptFileAttachment = {
  data: string;              // base64
  mime: string;
  source: { type: 'inline' } | { type: 'uri'; uri: string };
  name?: string;
  description?: string;
  mention?: { start: number; end: number; text: string };
};
type PromptAgentAttachment = { name: string; mention?: {...} };
type PromptSkillAttachment = { id: string; name: string; text?: string; mention?: {...} };
```

---

## 5. Eventos en vivo

`client.event.subscribe()` devuelve `AsyncIterable<V2Event>`. Todos los eventos
comparten `{ id, created, metadata?, type, location?, data, durable? }`, donde
`durable = { aggregateID, seq, version }` cuando el evento es persistido.

**Ciclo de vida de sesión:** `session.created`, `session.deleted`,
`session.renamed`, `session.moved`, `session.forked`,
`session.metadata.updated`, `session.permissions`, `session.viewed`,
`session.idle`, `session.status` (`SessionStatusUpdated`),
`session.usage.updated`.

**Ejecución:** `session.execution.started`, `session.execution.succeeded`,
`session.execution.failed` (`error`), `session.execution.interrupted`
(`reason: 'user' | 'shutdown' | 'superseded' | 'inactivity'`).

**Paso / texto / razonamiento:** `session.step.started`
(`agent`, `model`, `snapshot?`, `started`), `session.step.streamed`,
`session.step.ended`, `session.step.failed`, `session.text.started/ended`,
`session.reasoning.started/ended`.

**Herramientas:** `session.tool.input.started`, `session.tool.input.ended`,
`session.tool.called`, `session.tool.progress`, `session.tool.success`,
`session.tool.failed`.

**Reintentos / compactación:** `session.retry.scheduled`
(`attempt`, `at`, `error`), `session.compaction.started/ended/failed`.

**Revert:** `session.revert.staged`, `session.revert.cleared`,
`session.revert.committed`.

**Shell:** `session.shell.started`, `session.shell.ended` (incluye `ShellInfo`
y `output`).

**Inbox / formularios:** `session.inbox.delivered`, `session.inbox.enqueued`,
`session.inbox.cancelled`, `session.inbox.delivery.changed`, `form.created`,
`form.replied`, `form.cancelled`.

**Instrucciones / skills:** `session.instructions.updated`,
`session.skill.activated`.

**Uso:** `session.usage.recorded` (`source: 'title' | 'compaction'`, `cost`,
`tokens`).

`session.log({ sessionID })` emite la **secuencia durable** de estos eventos
(historial), útil para reconstruir una sesión sin depender del stream global.

---

## 6. Parámetros de consulta

- **`session.list`**: `limit`, `order: 'asc' | 'desc'`, `search` (título),
  `parentID` (filtra hijos; `null` = raíces), `directory`, `project`,
  `subpath`, `cursor`.
- **`message.list`**: `limit`, `order`, `cursor`, `type` (filtra por variante
  de mensaje). ⚠️ V2 capa `limit` a **200** por request; paginar con el cursor
  (`{ next }` / `{ previous }`) para no truncar.
- **`session.stats`**: `from`, `to`, `project`, `timezone`,
  `tools: 'none' | 'summary' | 'detail'`.

---

## 7. Datos relacionados (enriquecen una sesión)

| Recurso | Tipo | Uso |
|---|---|---|
| `agent.list` / `agent.get` | `AgentInfo = { id, name, model?, request, system?, description?, mode: 'subagent' \| 'primary' \| 'all', hidden, color?, steps?, permissions }` | metadata del agente |
| `permission.list` | `PermissionRequest = { id, sessionID, action, resources[], save?, metadata?, source?, message? }` | permisos pendientes |
| `permission.saved.list` | `PermissionSavedInfo[]` | reglas guardadas |
| `mcp.list` / `mcp.resource.catalog` | `McpServer[]` / catálogo | recursos MCP |
| `config.get` | config efectiva | instrucciones, modelo, etc. |
| `skill.list` / `command.list` / `reference.list` | catálogos | |
| `vcs.status/branch/diff/base` | estado git | contexto de repo |
| `file.read/list/find` | archivos | |
| `project.list` | `Project[]` (`canonical`, `sandboxes`, `icon`, ...) | proyectos y directorios |

---

## 8. Uso actual en la viz (y huecos)

**Ya consumido:**
`SessionInfo` (id, parentID, agent, model, cost, tokens, time, title,
location.directory, outcome), `message.list` (user/assistant + tools),
`permission.list`, `agent.list`, `project.list`, `event.subscribe`,
`session.active`.

**Disponible y sin explotar:**

- `session.stats` → métricas agregadas y uso de tools con `durationP50`.
- `session.diff` → archivos tocados, `+/-` y patch (también `revert.files`).
- `session.context` → distinguir el contexto vigente tras una compactación.
- `session.log` → historial durable completo por sesión.
- `session.form.*` → el tool `question` (formularios pendientes y respuestas).
- `session.inbox.*` → cola de turnos pendientes.
- Eventos no procesados: `usage.updated`, `retry.scheduled`, `step.*`,
  `tool.input.*`, `compaction.*`, `revert.*`, `shell.*`.
- Campos de mensaje no usados: `snapshot`, `finish`/`rawFinish`,
  `providerState`, `providerContext`, `error`, `retry`, y las variantes
  `system` / `synthetic` / `skill` / `shell` / `compaction` / `idle`.
- `SessionInfo.permissions`, `metadata`, `fork`, `revert`,
  `time.viewed/archived/idle`.

---

## 9. Notas V2 / limitaciones

- Los mensajes son planos; los tool calls viven dentro de
  `assistant.content[]` (no en `parts`).
- `session.status` como endpoint fue eliminado. El estado inicial es
  `session.active()`; los cambios llegan por `session.status` (evento) y
  `session.idle`.
- `message.list` limita a 200 por request.
- El stream SSE es global (`GET /api/event`) y no se reconecta solo: hay que
  volver a suscribirse si el iterador termina.
