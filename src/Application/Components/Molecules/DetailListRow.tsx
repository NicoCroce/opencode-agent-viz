import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';

/**
 * Lista con borde que agrupa `DetailListRow` (radio 10px, recorte de las
 * esquinas). Se aplica en el contenedor de las filas del consumidor.
 */
export const DETAIL_LIST_CLASSNAME =
  'overflow-hidden rounded-[10px] border border-border';

/**
 * Fila de la lista: separador superior atenuado (la primera sin él) y padding
 * horizontal de la lista. Reutilizable por filas con otra maquetación (rejilla).
 */
export const DETAIL_LIST_ROW_CLASSNAME =
  'border-t border-border/60 px-3 py-[9px] first:border-t-0';

interface DetailListRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Fila de una lista de detalles: extremos separados, centrado vertical y borde
 * superior separador (la primera sin borde); va dentro de un contenedor con
 * `DETAIL_LIST_CLASSNAME`. No impone estructura interna, así
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
    className={cn(DETAIL_LIST_ROW_CLASSNAME, className)}
    {...props}
  >
    {children}
  </Container>
);
