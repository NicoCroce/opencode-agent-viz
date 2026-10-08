import { Container } from '@app/Application/Components';
import {
  DetailListRow,
  SectionFrame,
} from '@app/Application/Components/Molecules';
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
    <SectionFrame
      title="Duración mediana por herramienta"
      data-testid="tool-stats"
      isEmpty={stats.length === 0}
      emptyLabel={isEmptyLabel}
    >
      <Container space="small">
        {stats.map((stat) => (
          <DetailListRow key={stat.name}>
            <span className="truncate font-mono text-xs text-foreground">
              {`${stat.name} · ${callsLabel(stat.calls)}`}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              {stat.medianMs === null
                ? 'no disponible'
                : formatDuration(stat.medianMs)}
            </span>
          </DetailListRow>
        ))}
      </Container>
    </SectionFrame>
  );
};
