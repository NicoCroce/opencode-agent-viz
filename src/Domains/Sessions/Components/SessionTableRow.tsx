import type { TSessionStatus } from '../Session.entity';
import type { TRootSessionItem } from '../Hooks/useRootSessions';
import { useSessionRowView } from '../Hooks/useSessionRowView';
import { SessionStatusLabel } from './SessionStatusLabel';

interface SessionTableRowProps {
  item: TRootSessionItem;
  status?: TSessionStatus;
  onSelect: (id: string) => void;
}

/** Celda base de la tabla de sesiones (padding del diseño: 14px × 18px). */
const CELL_CLASS = 'px-[18px] py-3.5';

/** Celda numérica: mono tabular y alineada a la derecha. */
const NUMERIC_CELL_CLASS = `${CELL_CLASS} text-right font-mono text-[13px] tabular-nums text-foreground/85`;

/**
 * Fila de la tabla de sesiones. El botón del título es el único control de la
 * fila (nombre accesible = título + agente); su `::after` se estira sobre toda
 * la fila para que cualquier punto de ella abra la sesión, y el anillo de foco
 * se dibuja en ese mismo pseudo-elemento.
 */
export const SessionTableRow = ({
  item,
  status,
  onSelect,
}: SessionTableRowProps) => {
  const view = useSessionRowView(item, status);

  return (
    <tr className="relative border-t border-border/60 transition-colors hover:bg-surface-2">
      <td className={CELL_CLASS}>
        <button
          type="button"
          onClick={() => onSelect(view.id)}
          className="flex min-w-0 flex-col gap-[3px] text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
        >
          <span className="truncate text-sm font-medium text-foreground">
            {view.title}
          </span>
          <span className="truncate font-mono text-[11px] text-status-idle">
            {view.agentLabel}
          </span>
        </button>
      </td>
      <td className={CELL_CLASS}>
        <SessionStatusLabel status={view.nodeStatus} isLive={view.isLive} />
      </td>
      <td className={NUMERIC_CELL_CLASS}>{view.cost}</td>
      <td className={NUMERIC_CELL_CLASS}>{view.duration}</td>
      <td
        className={`${CELL_CLASS} whitespace-nowrap text-right font-mono text-xs tabular-nums text-muted-foreground`}
      >
        {view.timeRange}
      </td>
    </tr>
  );
};
