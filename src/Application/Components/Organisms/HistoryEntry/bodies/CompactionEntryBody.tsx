import type { ReactNode } from 'react';
import { Container } from '@app/Application/Components/Layout';
import type {
  TCompactionStatus,
  THistoryCompactionEntry,
} from '@app/Domains/History/History.entity';

/** Estado del episodio de compactación (FR-035). */
const COMPACTION_LABEL: Record<TCompactionStatus, string> = {
  running: 'En curso',
  completed: 'Completada',
  failed: 'Fallida',
};

interface CompactionEntryBodyProps {
  entry: THistoryCompactionEntry;
  sessionId: string | null;
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/** Episodio de compactación: estado, motivo, resumen y contexto inyectado (FR-035). */
export const CompactionEntryBody = ({
  entry,
  sessionId,
  renderCompactionContext,
}: CompactionEntryBodyProps) => (
  <Container space="none" className="gap-1!">
    <p className="font-mono text-[11px] text-muted-foreground">
      <span className="text-foreground">{COMPACTION_LABEL[entry.status]}</span>
      {` · ${entry.reason}`}
    </p>
    {entry.summary ? (
      <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {entry.summary}
      </p>
    ) : null}
    {sessionId && renderCompactionContext
      ? renderCompactionContext(sessionId)
      : null}
  </Container>
);
