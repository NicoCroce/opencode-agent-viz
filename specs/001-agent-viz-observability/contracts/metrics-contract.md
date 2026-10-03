# Contract — Métricas e Inspector (`Domains/Graph/lib/deriveMetrics.ts`, `Domains/Inspector/`)

## `deriveMetrics()`

```ts
interface DeriveMetricsInput {
  messages: { info: TMessage; parts: TPart[] }[];
  status?: TSessionStatus;
  subtaskInvocations: number; // partes subtask que apuntaron a esta sesión
  now: number;
}

function deriveMetrics(input: DeriveMetricsInput): TNodeMetrics;
// TNodeMetrics: durationMs, startedAt, endedAt, cost, tokens, invocations, retryCount, hasLoop, loopEvidence
```

Reglas (R9, R7):
- `durationMs = Σ ((assistant.time.completed ?? now) − assistant.time.created)`; `null` si no hay mensajes assistant.
- `cost = Σ assistant.cost + Σ stepFinish.cost`; `null` si ninguna fuente lo reporta (nunca `0` por defecto).
- `tokens`: suma por campo; cada campo `null` si su fuente no lo reporta.
- `invocations` = veces que **esta** sesión fue invocada (1 por sesión); el agregado por nombre de agente se calcula en `summarizeSession.agentInvocations` (FR-010).
- `retryCount` = partes `retry` + status `retry.attempt`; `hasLoop = retryCount > 0`.
- `loopEvidence` = mensajes de proveedor de cada reintento.

## Agregación de sesión

```ts
function summarizeSession(root: TSession, graph: TGraphModel, resourceUsage: TResourceUsage): TSessionSummary;
```

- Suma `metrics` de todos los nodos del subárbol de `root`.
- Cuenta `agentCount`, `subagentCount`, `runningCount`, `waitingCount`, `errorCount`, `loopCount`.
- `agentInvocations`: conteo de nodos por `agentName` (FR-010: veces que cada agente se ejecutó).
- `resourceUsage` se obtiene de `mcp.status()` + `config.get()` + `Agent.tools` (R8).

## Contrato de presentación (UI)

Componentes base en `Application/Components/Molecules`:
- `Metric` — `{ label: string; value: string | null; hint?: string }`. Si `value === null` renderiza `"—"` + texto "no disponible" (accesible), nunca `0`.
- `StatusDot` — LED plano por `TNodeStatus`.
- `DurationBar` — barra plana de duración relativa (0–100% del mayor del grafo).

Reglas de formato (helpers puros, testeados):
- `formatDuration(ms | null)` → `"1m 23s"` / `"—"`.
- `formatCost(value | null, currency = '$')` → `"$0.0123"` / `"—"`.
- `formatTokens(value | null)` → `"12.4k"` / `"—"`.
- Todas las cifras usan `font-variant-numeric: tabular-nums`.

## Inspector (`TNodeDetail`)

```ts
interface TNodeDetail {
  node: TGraphNode;
  tools: { name: string; status: ToolState['status']; startedAt?: number; endedAt?: number }[];
  todos: TTodo[];
  errors: { message: string; at: number }[];
  resources: TResourceUsage;
}
```

Secciones del panel, en orden: encabezado (agente, modelo, estado) → métricas (duración · tokens · costo) → conteo de invocaciones y loop (con evidencia) → recursos disponibles → historial de herramientas → tareas → errores. Cada sección con estado vacío explicativo propio (FR-017, SC-009).

## Loop (`LoopBadge`)

Solo se muestra cuando `hasLoop === true`. Texto: "Posible loop" + número de reintentos; en el detalle, lista `loopEvidence`. El nodo correspondiente usa la franja rayada diagonal (signature).
