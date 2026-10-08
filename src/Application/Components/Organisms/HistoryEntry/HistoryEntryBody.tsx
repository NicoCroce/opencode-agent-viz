import type { ReactNode } from 'react';
import type { THistoryEntry } from '@app/Domains/History/History.entity';
import { ToolCallEntry } from '../ToolCallEntry';
import { CompactionEntryBody } from './bodies/CompactionEntryBody';
import { IdleEntryBody } from './bodies/IdleEntryBody';
import { NoticeEntryBody } from './bodies/NoticeEntryBody';
import { QuestionEntryBody } from './bodies/QuestionEntryBody';
import { ShellEntryBody } from './bodies/ShellEntryBody';
import { SkillEntryBody } from './bodies/SkillEntryBody';
import {
  AgentSwitchedBody,
  LocationSwitchedBody,
  ModelSwitchedBody,
} from './bodies/SwitchEntryBody';
import { TextEntryBody } from './bodies/TextEntryBody';
import { UserEntryBody } from './bodies/UserEntryBody';

interface HistoryEntryBodyProps {
  /** Entrada del histórico cuyo cuerpo se resuelve. */
  entry: THistoryEntry;
  /** Sesión dueña; la necesita el contexto de compactación (FR-035). */
  sessionId: string | null;
  /** Render inyectado del contexto de compactación (FR-035). */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/** Cuerpo de la entrada según su `kind` (FR-003/006). */
export const HistoryEntryBody = ({
  entry,
  sessionId,
  renderCompactionContext,
}: HistoryEntryBodyProps): ReactNode => {
  switch (entry.kind) {
    case 'user':
      return <UserEntryBody entry={entry} />;
    case 'answer':
    case 'reasoning':
      return (
        <TextEntryBody
          text={entry.text}
          isComplete={entry.isComplete}
          variant={entry.kind}
        />
      );
    case 'tool':
      return <ToolCallEntry entry={entry.entry} />;
    case 'agent-switched':
      return <AgentSwitchedBody entry={entry} />;
    case 'model-switched':
      return <ModelSwitchedBody entry={entry} />;
    case 'location-switched':
      return <LocationSwitchedBody entry={entry} />;
    case 'system':
    case 'synthetic':
      return (
        <NoticeEntryBody
          text={entry.text}
          description={entry.description}
          tone={entry.kind}
        />
      );
    case 'skill':
      return <SkillEntryBody entry={entry} />;
    case 'shell':
      return <ShellEntryBody entry={entry} />;
    case 'compaction':
      return (
        <CompactionEntryBody
          entry={entry}
          sessionId={sessionId}
          renderCompactionContext={renderCompactionContext}
        />
      );
    case 'question':
      return <QuestionEntryBody entry={entry} />;
    case 'idle':
      return <IdleEntryBody entry={entry} />;
  }
};
