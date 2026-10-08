import type { ReactNode } from 'react';
import { UNAVAILABLE } from '@app/Application/Helpers';
import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';

interface DetailRowProps {
  /** Etiqueta a la izquierda (p. ej. "Nombre", "Razonamiento"). */
  label: string;
  /**
   * Valor a la derecha. `null`/`undefined` se muestran como "no disponible"
   * (constante `UNAVAILABLE`); cualquier nodo se acepta además de un string.
   */
  value?: ReactNode;
  className?: string;
}

/**
 * Fila etiqueta/valor de un panel de detalle: etiqueta atenuada a la izquierda
 * y dato monoespaciado alineado a la derecha. Extraída del `DetailRow` interno
 * de `Inspector/Components/ModelSection`.
 */
export const DetailRow = ({ label, value, className }: DetailRowProps) => (
  <Container
    row
    space="small"
    align="baseline"
    justify="between"
    className={cn('min-w-0 gap-3!', className)}
  >
    <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
    <span className="min-w-0 break-all text-right font-mono text-[11px] text-foreground">
      {value ?? UNAVAILABLE}
    </span>
  </Container>
);
