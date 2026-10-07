# Contract — Tarjeta de sesión (`Domains/Sessions/Components/SessionCard.tsx`)

Cubre US4 (FR-013) y la parte de tarjeta de US5 (FR-014, FR-016).

## Props (sin cambios)

```ts
interface SessionCardProps {
  item: TRootSessionItem;   // { session: TSession; agentName: string | null }
  status?: TSessionStatus;
  selected: boolean;
  onSelect: (id: string) => void;
}
```

## Estructura visual

1. **Fila principal**: `StatusDot` + `session.title` como texto principal (`text-sm font-medium text-foreground`, truncado) + rango horario a la derecha (`font-mono text-[11px] tabular-nums text-muted-foreground`).
2. **Fila secundaria**: agente (`text-xs text-muted-foreground`, truncado) o `"agente no disponible"` cuando `item.agentName === null` (FR-013, acceptance 2).

Reglas:
- El título siempre va **arriba** y el agente **abajo** (FR-013).
- `selected` mantiene el tratamiento de borde/fondo actual (`border-accent bg-surface-2`); no cambia.
- La tarjeta sigue siendo un `<button>` que llama `onSelect(session.id)`.
- El único fallback normado por la spec es el del **agente** (FR-013). El título se muestra tal como lo reporta el servidor (`session.title`); su ausencia no se cubre en esta feature.

## Rango horario (FR-014, FR-016)

```ts
formatTimeRange({
  startedAt: session.time.created,
  endedAt: session.time.updated,
  isRunning: status?.type === 'busy' || status?.type === 'retry',
});
```

- `time.created` / `time.updated` son campos requeridos del SDK → la tarjeta siempre tiene ambos extremos.
- **Decisión (remediación analyze I3)**: `time.updated` es el proxy aceptado del fin para la tarjeta; no se derivan mensajes por sesión (evita N+1). La spec lo documenta en FR-014 y en Assumptions.
- Si la sesión está en curso (`busy`/`retry`) → `"inicio – en curso"` (no una hora que cambia sola).
- Sin dato de estado → se trata como no en curso y se usa `time.updated`.
- Detalles de formato y casos faltantes en [time-range-contract.md](./time-range-contract.md).

## Estados de pantalla

- La tarjeta es presentación pura; los estados error/loading/vacío/datos los cubren `SessionList`/`SessionListSkeleton`/`EmptyState` en el rail (FR-017).
