import { cn } from '@app/Application/lib/utils';

/** Etiqueta compartida del estado "en curso". */
export const IN_PROGRESS_LABEL = 'En curso';

interface InProgressTextProps {
  className?: string;
}

/**
 * Indicador de respuesta/razonamiento aún no consolidado (FR-006).
 *
 * Presentación pura: nunca presenta texto parcial como completo; solo anuncia
 * que el contenido sigue en curso. Centraliza el literal "En curso" que hoy
 * repiten `HistoryEntry` (bloque `InProgress`), `ToolCallEntry` y el estado
 * `running` de `AgentNode`/`SessionSummaryBar`. No accede al SDK ni a hooks.
 */
export const InProgressText = ({ className }: InProgressTextProps) => (
  <span className={cn('font-mono text-[11px] text-status-running', className)}>
    {IN_PROGRESS_LABEL}
  </span>
);
