# Contract — Rango horario (`Application/Helpers/formatTimeRange.ts`)

Cubre US5 (FR-014, FR-015, FR-016). Helper puro y compartido por `Sessions` y `Graph` (Constitución V).

## Firma

```ts
export interface TTimeRangeInput {
  startedAt: number | null;
  endedAt: number | null;
  isRunning: boolean;
}

export const formatTimeRange = (input: TTimeRangeInput): string => { /* ... */ };
```

## Reglas de formato

Sea `clock(ms)` el reloj local en `HH:mm` (`toLocaleTimeString` con `hour: '2-digit', minute: '2-digit'`, coherente con el `formatTime` que reemplaza):

| Condición | Salida |
|-----------|--------|
| `startedAt` y `endedAt` presentes, no en curso | `"HH:mm – HH:mm"` |
| `startedAt` presente y `isRunning` | `"HH:mm – en curso"` |
| `startedAt` presente, no en curso, `endedAt === null` | `"HH:mm – no disponible"` |
| `startedAt === null` (no en curso) | `"no disponible – HH:mm"` o `"no disponible – no disponible"` según el fin |

Reglas:
- `isRunning` **siempre** gana sobre `endedAt`: mientras corre se muestra `"en curso"` y nunca una hora que cambia sola (clarificación Q2, FR-015).
- Un extremo faltante se muestra como `"no disponible"`; nunca `0` ni vacío (FR-016).
- El separador es `" – "` (guion con espacios).
- No usa `Date.now()` interno: recibe todo por parámetro → determinista y testeable.
- El rango **convive** con la duración existente en el nodo; no la reemplaza (Assumption de la spec).

## Uso por vista

| Vista | `startedAt` | `endedAt` | `isRunning` |
|-------|-------------|-----------|-------------|
| `AgentNode` | `node.data.metrics.startedAt` | `node.data.metrics.endedAt` | `status === 'running' \|\| status === 'waiting'` |
| `SessionCard` | `session.time.created` | `session.time.updated` | `status?.type === 'busy' \|\| status?.type === 'retry'` |

## Tests

`Application/Helpers/specs/formatTimeRange.spec.ts` cubre: ambos extremos, en curso, `endedAt` faltante, `startedAt` faltante, ambos faltantes y formato `HH:mm`.
