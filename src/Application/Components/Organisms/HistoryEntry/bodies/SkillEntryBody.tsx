import type { THistorySkillEntry } from '@app/Domains/History/History.entity';

interface SkillEntryBodyProps {
  entry: THistorySkillEntry;
}

/** Activación de una skill: nombre y skill, con su texto si lo trae. */
export const SkillEntryBody = ({ entry }: SkillEntryBodyProps) => (
  <>
    <p className="font-mono text-xs text-foreground">
      {entry.name}
      <span className="text-muted-foreground"> · {entry.skill}</span>
    </p>
    {entry.text ? (
      <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
        {entry.text}
      </p>
    ) : null}
  </>
);
