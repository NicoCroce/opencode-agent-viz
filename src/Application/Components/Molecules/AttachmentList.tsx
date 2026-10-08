import type { THistoryAttachment } from '@app/Domains/History/History.entity';

/** Tipo de adjunto de un prompt de usuario (FR-007). */
const ATTACHMENT_LABEL: Record<THistoryAttachment['kind'], string> = {
  file: 'archivo',
  agent: 'agente',
  skill: 'skill',
};

interface AttachmentListProps {
  /** Adjuntos normalizados del prompt de usuario (FR-007). */
  attachments: THistoryAttachment[];
}

/**
 * Lista de adjuntos de un prompt de usuario (FR-007).
 *
 * Presentación pura: cada adjunto muestra su tipo y su nombre (o "sin nombre"
 * cuando no lo tiene) en un `<ul>` de chips, que se conserva como lista
 * semántica. Se omite por completo cuando no hay adjuntos. Reutilizable por el
 * histórico y cualquier vista de prompt. No accede al SDK ni a hooks.
 */
export const AttachmentList = ({ attachments }: AttachmentListProps) => {
  if (attachments.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1">
      {attachments.map((attachment, index) => (
        <li
          key={`${attachment.kind}-${index}`}
          className="rounded-flat border border-border bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
        >
          <span className="text-foreground">
            {ATTACHMENT_LABEL[attachment.kind]}
          </span>
          {' · '}
          {attachment.name ?? 'sin nombre'}
        </li>
      ))}
    </ul>
  );
};
