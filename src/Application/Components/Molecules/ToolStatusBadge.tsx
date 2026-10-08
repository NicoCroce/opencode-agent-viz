import { cn } from '@app/Application/lib/utils';
import {
  TOOL_STATUS_COLOR,
  TOOL_STATUS_LABEL,
  type TToolStatus,
} from '@app/Application/Helpers/toolStatus';

interface ToolStatusBadgeProps {
  /** Estado real de la llamada a herramienta. */
  status: TToolStatus;
  /**
   * `true` (por defecto): etiqueta legible + color (`ToolCallEntry`).
   * `false`: estado crudo + color, sin etiqueta (`ToolHistory`).
   */
  label?: boolean;
  className?: string;
}

/**
 * Estado de una llamada a herramienta, siempre coloreado (FR-004/FR-011).
 *
 * Los mapas compartidos cubren la unión completa
 * (`streaming/running/completed/error/pending`), de modo que ningún estado cae
 * a un color de fallback silencioso. Con `label={false}` reproduce el
 * comportamiento de `ToolHistory` (estado crudo, sin etiqueta).
 */
export const ToolStatusBadge = ({
  status,
  label = true,
  className,
}: ToolStatusBadgeProps) => (
  <span
    className={cn(
      'shrink-0 font-mono text-[11px]',
      TOOL_STATUS_COLOR[status],
      className,
    )}
  >
    {label ? TOOL_STATUS_LABEL[status] : status}
  </span>
);
