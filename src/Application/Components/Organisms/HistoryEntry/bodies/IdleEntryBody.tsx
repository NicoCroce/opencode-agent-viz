import { OUTCOME_LABEL } from '@app/Application/Helpers/outcomeLabel';
import type { THistoryIdleEntry } from '@app/Domains/History/History.entity';

interface IdleEntryBodyProps {
  entry: THistoryIdleEntry;
}

/** Cierre de turno con su resultado terminal. */
export const IdleEntryBody = ({ entry }: IdleEntryBodyProps) => (
  <p className="font-mono text-[11px] text-muted-foreground">
    {OUTCOME_LABEL[entry.outcome]}
  </p>
);
