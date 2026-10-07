import { Button, Container } from '@app/Application/Components';
import { formatDuration } from '@app/Application/Helpers';
import {
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons';
import type { TToolHistoryEntry } from '../Inspector.entity';
import { medianToolDurations } from '../lib/medianToolDurations';
import { useToolHistory } from '../Hooks/useToolHistory';

interface ToolHistoryProps {
  tools: TToolHistoryEntry[];
}

const STATUS_COLOR: Record<string, string> = {
  running: 'text-status-running',
  completed: 'text-status-done',
  error: 'text-status-error',
  pending: 'text-status-idle',
};

/** Etiqueta de recuento de llamadas, singular/plural. */
const callsLabel = (calls: number): string =>
  `${calls} ${calls === 1 ? 'llamada' : 'llamadas'}`;

export const ToolHistory = ({ tools }: ToolHistoryProps) => {
  const { visibleTools, hiddenCount, canExpand, isExpanded, toggle } =
    useToolHistory(tools);

  if (tools.length === 0) {
    return (
      <Container space="small">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Herramientas
        </span>
        <p className="text-xs text-muted-foreground">
          Sin actividad de herramientas todavía.
        </p>
      </Container>
    );
  }

  const stats = medianToolDurations(tools);

  return (
    <Container space="small">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Herramientas
      </span>
      <Container space="small">
        {visibleTools.map((tool, index) => (
          <div
            key={`${tool.name}-${index}`}
            className="flex items-center justify-between gap-2 border-b border-border py-1 last:border-b-0"
          >
            <span className="truncate font-mono text-xs text-foreground">
              {tool.name}
            </span>
            <span
              className={`shrink-0 font-mono text-[11px] ${STATUS_COLOR[tool.status] ?? 'text-muted-foreground'}`}
            >
              {tool.status}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatDuration(
                tool.startedAt !== undefined && tool.endedAt !== undefined
                  ? tool.endedAt - tool.startedAt
                  : null,
              )}
            </span>
          </div>
        ))}
      </Container>

      {canExpand ? (
        <Button
          variant="outline"
          showIcon
          icon={isExpanded ? faChevronUp : faChevronDown}
          aria-expanded={isExpanded}
          onClick={toggle}
          className="h-auto! justify-start! gap-1! border-0! bg-transparent! p-0! font-mono text-[11px] text-muted-foreground shadow-none! hover:bg-transparent! hover:text-foreground"
        >
          {isExpanded ? 'Ver menos' : `Ver ${hiddenCount} más`}
        </Button>
      ) : null}

      <Container space="small" data-testid="tool-history-stats">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Duración mediana por herramienta
        </span>
        <Container space="small">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="flex items-center justify-between gap-2 border-b border-border py-1 last:border-b-0"
            >
              <span className="truncate font-mono text-xs text-foreground">
                {`${stat.name} · ${callsLabel(stat.calls)}`}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {stat.medianMs === null
                  ? 'no disponible'
                  : formatDuration(stat.medianMs)}
              </span>
            </div>
          ))}
        </Container>
      </Container>
    </Container>
  );
};
