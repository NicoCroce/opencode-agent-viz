import { AttachmentList } from '@app/Application/Components/Molecules';
import type { THistoryUserEntry } from '@app/Domains/History/History.entity';

interface UserEntryBodyProps {
  entry: THistoryUserEntry;
}

/** Prompt del usuario: texto + adjuntos normalizados (FR-007). */
export const UserEntryBody = ({ entry }: UserEntryBodyProps) => (
  <>
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
      {entry.text}
    </p>
    <AttachmentList attachments={entry.attachments} />
  </>
);
