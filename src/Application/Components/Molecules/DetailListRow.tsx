import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';

interface DetailListRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Fila de una lista de detalles: extremos separados, centrado vertical y borde
 * inferior separador (el último sin borde). No impone estructura interna, así
 * sirve para pares nombre/valor, estados o cualquier contenido en fila.
 *
 * Migra los `div` con `flex` usados hoy en `ToolStats`/`ToolHistory` a
 * `<Container>` (AGENTS §8.4).
 */
export const DetailListRow = ({
  children,
  className,
  ...props
}: DetailListRowProps) => (
  <Container
    row
    space="small"
    align="center"
    justify="between"
    className={cn('border-b border-border py-1 last:border-b-0', className)}
    {...props}
  >
    {children}
  </Container>
);
