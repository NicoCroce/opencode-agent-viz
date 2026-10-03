# Data Model — OpenCode Agent Viz (Observabilidad Multi-Agente)

**Feature**: `001-agent-viz-observability`
**Date**: 2026-10-03
**Input**: [spec.md](./spec.md), [research.md](./research.md)

Convención: los tipos crudos derivan del SDK con prefijo `T`; los view-models derivados también usan prefijo `T` pero viven en su dominio. No se redefinen a mano interfaces que el SDK ya exporta (Principio IV).

---

## 1. Tipos crudos derivados del SDK

| Tipo `T` | Origen SDK | Campos relevantes para esta feature |
|----------|-----------|-------------------------------------|
| `TSession` | `Session` (`types.gen.d.ts:465`) | `id`, `parentID?`, `title`, `directory`, `time.created`, `time.updated`, `summary?` |
| `TSessionStatus` | `SessionStatus` (`:396`) | `{type:'idle'}` \| `{type:'busy'}` \| `{type:'retry', attempt, message, next}` |
| `TAgent` | `Agent` (`:1399`) | `name`, `mode`, `builtIn`, `model?`, `tools`, `permission`, `temperature?` |
| `TMessage` | `Message` (`:128`) | unión `UserMessage`/`AssistantMessage` |
| `TUserMessage` | `UserMessage` (`:39`) | `agent` (nombre del agente), `model` |
| `TAssistantMessage` | `AssistantMessage` (`:98`) | `time.created/completed?`, `parentID`, `modelID`, `providerID`, `cost`, `tokens{input,output,reasoning,cache{read,write}}`, `error?`, `finish?` |
| `TPart` | `Part` (`:345`) | unión de partes |
| `TToolPart` | `ToolPart` (`:263`) | `tool`, `callID`, `state` (`pending/running/completed/error`) |
| `TStepFinishPart` | `StepFinishPart` (`:282`) | `cost`, `tokens` |
| `TRetryPart` | `RetryPart` (`:327`) | `attempt`, `error` |
| `TSubtaskPart` | `Part` variante `subtask` (`:345`) | `prompt`, `description`, `agent` |
| `TAgentPart` | `AgentPart` (`:315`) | `name`, `source?` |
| `TTodo` | `Todo` (`:431`) | `content`, `status`, `priority`, `id` |
| `TPermission` | `Permission` (`:369`) | `id`, `sessionID`, `type`, `title`, `metadata`, `time.created` |
| `TMcpStatus` | `McpStatus` (`:1429`) | `connected` \| `disabled` \| `failed` \| `needs_auth` \| `needs_client_registration` |
| `TMcpStatusMap` | `McpStatusResponses` (`:2906`) | `Record<string, TMcpStatus>` |
| `TConfig` | `Config` (`:1016`) | `instructions?: string[]`, `mcp?`, `agent?`, `model?` |
| `TEvent` | `Event` (`:602`) | unión discriminada por `type` |
| `TConnectionState` | derivado local | `'connected' \| 'reconnecting' \| 'disconnected'` (no proviene del SDK) |

---

## 2. View-models derivados

### 2.1 `TNodeStatus`

Estado visual de un nodo del grafo. Derivado de `TSessionStatus`, la última parte y `TPermission`.

Mapeo de vocabulario spec↔modelo: terminado→`done`, en curso→`running`, esperando→`waiting`, inactivo→`idle`.

| Valor | Condición |
|-------|-----------|
| `idle` | status `idle` y sin permiso pendiente, o sin actividad aún |
| `running` | status `busy` (o último `step-start`/`tool running` sin `completed`) |
| `waiting` | existe `TPermission` pendiente para la sesión (`permission.updated` sin `permission.replied`) |
| `error` | `session.error` o `AssistantMessage.error` o última parte `tool` en `error` |
| `done` | status `idle` tras haber tenido actividad y sin error/permiso |

### 2.2 `TNodeMetrics`

Métricas agregadas de un agente/sesión (FR-007..FR-011).

| Campo | Tipo | Regla |
|-------|------|-------|
| `durationMs` | `number \| null` | `Σ (assistant.time.completed ?? now) − time.created`; `null` = no disponible |
| `startedAt` | `number \| null` | primer `time.created` observado |
| `endedAt` | `number \| null` | último `time.completed` observado |
| `cost` | `number \| null` | `Σ AssistantMessage.cost + Σ StepFinishPart.cost` |
| `tokens` | `TTokenUsage \| null` | suma con desglose |
| `invocations` | `number` | veces que **esta** sesión fue invocada (1 por sesión; >1 si la misma sesión se reejecuta) |
| `retryCount` | `number` | nº de partes `retry` + reintentos de status |
| `hasLoop` | `boolean` | `retryCount > 0` (FR-011) |
| `loopEvidence` | `string[]` | mensajes de proveedor de cada reintento |

### 2.3 `TTokenUsage`

`{ input: number|null, output: number|null, reasoning: number|null, cacheRead: number|null, cacheWrite: number|null }`. Cada campo es `null` individualmente si su fuente no lo reporta.

### 2.4 `TResourceUsage`

Recursos **disponibles** del agente (FR-012, opción A de Q2).

| Campo | Tipo | Origen |
|-------|------|--------|
| `mcpServers` | `{ name: string; status: TMcpStatus['status'] }[]` | `mcp.status()` |
| `instructions` | `string[]` | `config.get().instructions` |
| `skills` | `{ name: string }[]` | derivado de configuración; vacío con estado explicativo si no es derivable |
| `tools` | `string[]` | `Agent.tools` (nombres con valor `true`) |
| `availability` | `'available'` | etiqueta fija; **nunca** `'used'` en v1 |

### 2.5 `TGraphNode`

Nodo de React Flow.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | `string` | `session.id` |
| `type` | `'agent'` | tipo de nodo React Flow |
| `position` | `{x:number;y:number}` | calculado por dagre (`layoutGraph`) |
| `data.agentName` | `string` | R2: `UserMessage.agent` → `subtask.agent` → `Agent.name` |
| `data.model` | `{providerID, modelID} \| null` | de `AssistantMessage` o `Agent.model` |
| `data.status` | `TNodeStatus` | en vivo |
| `data.metrics` | `TNodeMetrics` | en vivo |
| `data.isRoot` | `boolean` | `parentID === undefined` |
| `data.currentTool` | `{ name: string; state: ToolState['status'] } \| null` | última `ToolPart` |

### 2.6 `TGraphEdge`

`{ id, source: parentSessionId, target: childSessionId, type: 'agent' }`. Derivada de `Session.parentID` (R3).

### 2.7 `TGraphModel`

`{ nodes: TGraphNode[]; edges: TGraphEdge[] }`. Salida pura de `buildGraph()` (ver `contracts/graph-contract.md`).

### 2.8 `TSessionSummary`

Agregado a nivel de sesión raíz (para el rail/header): `rootSessionId`, `metrics: TNodeMetrics` total, `agentCount`, `subagentCount`, `runningCount`, `waitingCount`, `errorCount`, `loopCount`, `agentInvocations: Record<string, number>` (nº de nodos por `agentName`, FR-010), `resourceUsage: TResourceUsage`.

---

## 3. Relaciones

```text
Session (raíz) 1 ──< Session (hija)        vía parentID
Session         1 ──< Message               vía sessionID
Message         1 ──< Part                  vía messageID
Part(subtask)   ──>  Session (hija)         vínculo de presentación (no canónico)
Session         1 ──< Permission            vía sessionID
Session         1 ──< Todo                   vía sessionID
Agent           1 ──< Session                por nombre (UserMessage.agent)
Graph           = f(Sessions, StatusMap, Agents, Messages/Parts, Permissions, McpStatus, Config)
```

---

## 4. Reglas de validación

- `durationMs`, `cost` y cada campo de `TTokenUsage` **nunca** se muestran como `0` cuando la fuente no reporta el dato; se marca "no disponible" (`null` en el modelo, texto en UI).
- `hasLoop` es verdadero **solo** si `retryCount > 0`; un conteo alto de invocaciones no lo activa (FR-011).
- `TResourceUsage.availability` es siempre `'available'` en v1; la UI no etiqueta nada como "usado".
- Un nodo hijo cuya sesión padre aún no está en el grafo se incluye igualmente como raíz temporal hasta reconciliar por `parentID`, sin romper el layout.
- Los textos (`text`/`reasoning`) y sus `delta` **no** entran al modelo de estado (Principio VII).
- `T` tipos del SDK no se validan con Zod (ya tipados); Zod se reserva a filtros/parámetros de usuario (búsqueda de sesiones, etc.).

---

## 5. Transiciones de estado de un nodo

```text
        session.created
              │
              ▼
           [idle] ──────────────┐
              │ step-start       │ session.idle (sin actividad previa)
              ▼                  │
          [running] ─────────────┤
              │ permiso          │ session.idle (tras actividad) ──► [done]
              ▼                  │
          [waiting] ─── replied ─┘
              │
              │ session.error / tool error / AssistantMessage.error
              ▼
           [error]

   [running] ── retry (part/status) ──► hasLoop=true (la marca persiste)
```

- `waiting` tiene prioridad visual sobre `running`.
- `error` y `hasLoop` persisten; no se limpian por `session.idle`.
- `session.compacted` no cambia estado; se registra como evento informativo del historial.
