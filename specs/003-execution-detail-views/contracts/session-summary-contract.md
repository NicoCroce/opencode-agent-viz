# Contract — Resumen de sesión (`Domains/Graph/`)

Cubre US4 (FR-024..FR-027). El resumen se agrega de los agentes **ya cargados** en el grafo; no introduce una carga de datos distinta (Assumption de la spec).

## `summarizeSession()` — `lib/deriveMetrics.ts` (ampliado)

```ts
function summarizeSession(
  root: SessionInfo,
  graph: TGraphModel,
  resourceUsage: TResourceUsage,
  now: number,
): TSessionSummary;
```

`TSessionSummary` se amplía con: `createdCount`, `retryingCount`, `compactingCount`, `interruptedCount`, `succeededCount`, `elapsedMs`.

| Campo | Regla |
|-------|-------|
| `runningCount` | nodos `running` |
| `waitingCount` | nodos `waiting-permission` + `waiting-input` |
| `errorCount` | nodos `failed` |
| `interruptedCount` | nodos `interrupted` (distinto de `errorCount`, FR-019) |
| `createdCount` / `retryingCount` / `compactingCount` / `succeededCount` | conteo por estado |
| `agentCount` / `subagentCount` | total y no raíz |
| `cost` / `tokens` | suma acumulada (ya existente) |
| `elapsedMs` | `max(endedAt) - min(startedAt)`; si activa, `now - min(startedAt)`; `null` sin actividad |

Reglas:
- **FR-024**: muestra cantidad en curso, esperando, con error y total (los demás estados son adicionales).
- **FR-025**: coste y tokens acumulados de todos los agentes.
- **FR-026**: tiempo transcurrido (`elapsedMs`).
- **FR-027**: la barra es de altura fija y se actualiza en el sitio; no provoca reordenamiento ni salto del grafo (no relayouta, Principio VII).
- Función pura y sin React (Principio V).

## `SessionSummaryBar` — contrato de presentación

```ts
interface SessionSummaryBarProps {
  summary: TSessionSummary;
}
```

- Tira monoespaciada compacta (`font-mono tabular-nums`) en la cabecera del grafo, junto a "N agentes".
- Contadores por estado con su tono; coste y tokens con los helpers existentes (`formatCost`, `formatTokens`); tiempo con `formatDuration`.
- Dato ausente → "no disponible" (FR-038).
- No usa `session.stats` (agregado por proyecto); se alimenta de `summarizeSession` (R10).
