# Contract — Inspector (`Domains/Inspector/`)

Cubre US3: historial de herramientas truncable (FR-009..FR-012).

## `useToolHistory()` — `Hooks/useToolHistory.ts`

```ts
const TOOL_HISTORY_LIMIT = 10;

function useToolHistory(tools: TToolHistoryEntry[]): {
  visibleTools: TToolHistoryEntry[];
  hiddenCount: number;
  canExpand: boolean;
  isExpanded: boolean;
  toggle: () => void;
};
```

Reglas:
- `visibleTools = isExpanded ? tools : tools.slice(0, TOOL_HISTORY_LIMIT)` — **mismo orden** de entrada, sin invertir (FR-009, clarificación Q4).
- `hiddenCount = Math.max(tools.length - TOOL_HISTORY_LIMIT, 0)` (FR-012).
- `canExpand = tools.length > TOOL_HISTORY_LIMIT`; con exactamente 10 entradas es `false` (FR-011, edge case).
- `toggle` alterna `isExpanded`; al contraer se vuelve a las 10 primeras.
- El umbral es fijo y no configurable (Assumption de la spec).

## `ToolHistory` — contrato de presentación

```ts
interface ToolHistoryProps {
  tools: TToolHistoryEntry[];
}
```

- Con 0 entradas: mantiene el estado vacío "Sin actividad de herramientas todavía." (FR-017).
- Con ≤10: muestra todas y **no** renderiza control (FR-011).
- Con >10: muestra las 10 primeras y un control plano con chevron:
  - colapsado → `"Ver {hiddenCount} más"` (o `"Ver N más"`), despliega hacia abajo;
  - expandido → `"Ver menos"`, vuelve a contraer (FR-010).
- Cada fila conserva nombre, estado (color semántico) y duración en `font-mono tabular-nums`.
- El control usa `Button variant="outline"` con ícono chevron (lucide/FontAwesome), accesible (`aria-expanded`, texto visible).

## Interacción con datos en vivo

- `tools` proviene de `useInspectorData` (orden cronológico ascendente). Si llegan herramientas nuevas mientras está colapsado, `hiddenCount` se actualiza y las 10 visibles siguen siendo las más antiguas (edge case).
- El historial no dispara consultas adicionales al SDK (Principio III).
