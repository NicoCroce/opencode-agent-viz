import { Bell } from 'lucide-react';
import { cn } from '@app/Application/lib/utils';
import { StatusDot } from '@app/Application/Components';
import { formatDateTimeRange } from '@app/Application/Helpers';
import type { TSessionStatus } from '../Session.entity';
import type { TRootSessionItem } from '../Hooks/useRootSessions';
import { useSessionNodeStatus } from '../Hooks/useSessionNodeStatus';

interface SessionCardProps {
  item: TRootSessionItem;
  status?: TSessionStatus;
  /**
   * Estado de ejecución ya derivado (presentación pura). Si se omite, se deriva
   * de `status` con `useSessionNodeStatus` (el cross-domain vive en el hook,
   * AGENTS §8.3).
   */
  nodeStatus?: ReturnType<typeof useSessionNodeStatus>;
  /**
   * Nº de pendientes del subárbol de esta sesión raíz (FR-009, US5). Opt-in:
   * con `0` (por defecto) la tarjeta no muestra badge, de modo que el uso
   * actual no cambia.
   */
  attentionCount?: number;
  /**
   * `row`: fila de canal del riel lateral. `card`: tarjeta del tablero de
   * sesiones (listado principal), con la meta al pie.
   */
  layout?: 'row' | 'card';
  /** Sesión en curso: ocupa más ancho en el tablero y muestra "en vivo". */
  featured?: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Etiqueta textual del badge; el color por sí solo no comunica (a11y). */
const attentionLabel = (count: number): string =>
  count === 1 ? '1 pendiente por atender' : `${count} pendientes por atender`;

/**
 * Badge de pendiente (FR-009, A1/A4). Presentación pura: `role="img"` con
 * `aria-label` textual (no depende del color), icono como marca **no-color** y
 * el par `bg-status-waiting` + `text-surface-0` (contraste ≥3:1 sobre la
 * superficie oscura).
 */
const AttentionBadge = ({ count }: { count: number }) => {
  const label = attentionLabel(count);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-status-waiting px-1.5 py-0.5 font-mono text-[10px] font-semibold text-surface-0"
    >
      <Bell className="size-2.5" strokeWidth={2} aria-hidden />
      <span aria-hidden className="tabular-nums">
        {count}
      </span>
    </span>
  );
};

/**
 * Fila del riel de sesiones o tarjeta del tablero. En el riel no es una tarjeta,
 * es un **canal**: el estado se lee por el punto y la sesión abierta se marca
 * con una barra de señal cyan. En el tablero, la tarjeta eleva la meta al pie y
 * deja respirar el título.
 */
export const SessionCard = ({
  item,
  status,
  nodeStatus,
  attentionCount = 0,
  layout = 'row',
  featured = false,
  selected,
  onSelect,
}: SessionCardProps) => {
  const { session, agentName } = item;
  const derivedNodeStatus = useSessionNodeStatus(status);
  const resolvedNodeStatus = nodeStatus ?? derivedNodeStatus;
  const timeRange = formatDateTimeRange({
    startedAt: session.time.created,
    endedAt: session.time.updated,
    isRunning: status?.type === 'busy' || status?.type === 'retry',
  });

  if (layout === 'card') {
    return (
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        aria-current={selected}
        className={cn(
          'group relative flex min-h-[96px] w-full min-w-0 flex-col gap-2.5 rounded-xl border p-3.5 text-left transition-[background-color,border-color,box-shadow] duration-150',
          featured && 'md:col-span-2',
          selected
            ? 'border-signal/40 bg-surface-2/80 shadow-[0_0_0_1px_hsl(var(--signal)/0.12)]'
            : featured
              ? 'border-signal/25 bg-surface-1/60 hover:border-signal/40 hover:bg-surface-2/60'
              : 'border-border/60 bg-surface-1/40 hover:border-signal/25 hover:bg-surface-1/80',
        )}
      >
        <span className="flex min-w-0 items-start gap-2.5">
          <span className="mt-1.5 flex shrink-0">
            <StatusDot status={resolvedNodeStatus} />
          </span>
          <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground">
            {session.title}
          </span>
          {attentionCount > 0 ? (
            <AttentionBadge count={attentionCount} />
          ) : null}
          {featured ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-signal/25 bg-signal/[0.06] px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-signal">
              <span
                aria-hidden
                className="size-1 rounded-full bg-signal signal-pulse"
              />
              en vivo
            </span>
          ) : null}
        </span>

        <span className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-border/50 pt-2">
          <span className="truncate font-mono text-[10px] tabular-nums text-muted-foreground">
            {timeRange}
          </span>
          <span className="max-w-[45%] shrink-0 truncate rounded-full border border-border/60 bg-surface-0/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {agentName ?? 'agente no disponible'}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      aria-current={selected}
      className={cn(
        'group relative flex w-full min-w-0 flex-col gap-1.5 rounded-lg border border-transparent py-2 pl-3 pr-2.5 text-left transition-[background-color,border-color] duration-150',
        selected ? 'border-border/40 bg-surface-2/90' : 'hover:bg-surface-1',
      )}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-signal"
        />
      ) : null}

      <span className="flex min-w-0 items-center gap-2">
        <StatusDot status={resolvedNodeStatus} />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px] font-medium leading-snug',
            selected ? 'text-foreground' : 'text-foreground/85',
          )}
        >
          {session.title}
        </span>
        {attentionCount > 0 ? <AttentionBadge count={attentionCount} /> : null}
      </span>

      <span className="flex min-w-0 items-center gap-1.5 pl-4 font-mono text-[10px] tabular-nums text-muted-foreground">
        <span className="truncate">{timeRange}</span>
        <span aria-hidden className="text-muted-foreground/50">
          ·
        </span>
        <span className="truncate">{agentName ?? 'agente no disponible'}</span>
      </span>
    </button>
  );
};
