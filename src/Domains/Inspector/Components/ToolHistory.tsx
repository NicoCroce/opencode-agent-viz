import { Container } from '@app/Application/Components';
import { formatDuration } from '@app/Application/Helpers';
import type { TToolHistoryEntry } from '../Inspector.entity';

interface ToolHistoryProps {
  tools: TToolHistoryEntry[];
}

const STATUS_COLOR: Record<string, string> = {
  running: 'text-status-running',
  completed: 'text-status-done',
  error: 'text-status-error',
  pending: 'text-status-idle',
};

export const ToolHistory = ({ tools }: ToolHistoryProps) => {
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

  return (
    <Container space="small">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Herramientas
      </span>
      <Container space="small">
        {tools.map((tool, index) => (
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
    </Container>
  );
};
