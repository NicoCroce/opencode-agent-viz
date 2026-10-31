import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@app/Application/lib/utils';
import { StatusDot } from '@app/Application/Components';
import type { TSessionStatus } from '../Session.entity';
import type { TRootSessionItem } from '../Hooks/useRootSessions';
import type { useSessionNodeStatus } from '../Hooks/useSessionNodeStatus';
import { useSessionRowView } from '../Hooks/useSessionRowView';

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
      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-status-waiting px-1.5 py-px font-mono text-[10px] font-medium text-surface-0"
    >
      <FontAwesomeIcon icon={faBell} className="size-2.5" aria-hidden />
      <span aria-hidden className="tabular-nums">
        {count}
      </span>
    </span>
  );
};

/** Sangría de las líneas meta: alinea con el título, tras el punto de estado. */
const META_CLASS =
  'truncate pl-[15px] font-mono text-[11px] tabular-nums text-muted-foreground';

/**
 * Tarjeta de sesión raíz del rail del espacio de trabajo (y del listado móvil).
 *
 * Seleccionada: borde de acento con tinte y anillo suave (`ring-glow`); sin
 * seleccionar: transparente, con `surface-2` al pasar el cursor. El punto de
 * estado lleva el halo del acento mientras la sesión está viva.
 */
export const SessionCard = ({
  item,
  status,
  nodeStatus,
  attentionCount = 0,
  selected,
  onSelect,
}: SessionCardProps) => {
  const view = useSessionRowView(item, status, nodeStatus);

  return (
    <button
      type="button"
      onClick={() => onSelect(view.id)}
      aria-current={selected}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-accent bg-accent/[0.06] ring-glow'
          : 'border-transparent bg-transparent hover:bg-surface-2',
      )}
    >
      <span className="flex w-full items-center gap-2">
        <StatusDot
          status={view.nodeStatus}
          className={cn(view.isLive && 'glow-accent')}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13px] font-medium',
            selected ? 'text-foreground' : 'text-foreground/85',
          )}
        >
          {view.title}
        </span>
        {attentionCount > 0 ? <AttentionBadge count={attentionCount} /> : null}
      </span>
      <span className={META_CLASS}>{view.timeRange}</span>
      <span className={cn(META_CLASS, 'text-status-idle')}>
        {view.agentLabel}
      </span>
    </button>
  );
};
