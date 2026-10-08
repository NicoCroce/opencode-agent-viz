type TNoticeTone = 'system' | 'synthetic';

/** Color del texto según el aviso; system en primer plano, synthetic atenuado. */
const TONE_CLASS: Record<TNoticeTone, string> = {
  system: 'text-foreground',
  synthetic: 'text-muted-foreground',
};

interface NoticeEntryBodyProps {
  text: string;
  description: string | null;
  tone: TNoticeTone;
}

/** Descripción opcional de system/synthetic; se omite si no existe. */
const Description = ({ value }: { value: string | null }) =>
  value ? <p className="text-xs text-muted-foreground">{value}</p> : null;

/** Aviso de sistema o entrada sintética (FR-003). */
export const NoticeEntryBody = ({
  text,
  description,
  tone,
}: NoticeEntryBodyProps) => (
  <>
    <p
      className={`whitespace-pre-wrap break-words text-xs ${TONE_CLASS[tone]}`}
    >
      {text}
    </p>
    <Description value={description} />
  </>
);
