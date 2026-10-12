import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
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
      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-flat bg-status-waiting px-1.5 py-0.5 font-mono text-[11px] font-medium text-surface-0"
    >
      <FontAwesomeIcon icon={faBell} className="size-3" aria-hidden />
      <span aria-hidden className="tabular-nums">
        {count}
      </span>
    </span>
  );
};

export const SessionCard = ({
  item,
  status,
  nodeStatus,
  attentionCount = 0,
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

  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      aria-current={selected}
      className={cn(
        'flex w-full flex-col gap-1 rounded-flat border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-accent bg-surface-2'
          : 'border-border bg-surface-1 hover:bg-surface-2',
      )}
    >
      <span className="flex items-center gap-2">
        <StatusDot status={resolvedNodeStatus} />
        <span className="truncate text-sm font-medium text-foreground">
          {session.title}
        </span>
        {attentionCount > 0 ? <AttentionBadge count={attentionCount} /> : null}
      </span>
      <span className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
        {timeRange}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {agentName ?? 'agente no disponible'}
      </span>
    </button>
  );
};
