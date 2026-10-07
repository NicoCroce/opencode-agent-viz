import { Container } from '@app/Application/Components';
import { formatDuration } from '@app/Application/Helpers';
import type { TToolHistoryEntry } from '../Inspector.entity';
import { medianToolDurations } from '../lib/medianToolDurations';

interface ToolStatsProps {
  tools: TToolHistoryEntry[];
  isEmptyLabel?: string;
}

const DEFAULT_EMPTY_LABEL = 'Sin actividad de herramientas todavía.';

/** Etiqueta de recuento de llamadas, singular/plural. */
const callsLabel = (calls: number): string =>
  `${calls} ${calls === 1 ? 'llamada' : 'llamadas'}`;

export const ToolStats = ({
  tools,
  isEmptyLabel = DEFAULT_EMPTY_LABEL,
}: ToolStatsProps) => {
  const stats = medianToolDurations(tools);

  return (
    <Container space="small" data-testid="tool-stats">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Duración mediana por herramienta
      </span>
      {stats.length === 0 ? (
        <p className="text-xs text-muted-foreground">{isEmptyLabel}</p>
      ) : (
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
      )}
    </Container>
  );
};
