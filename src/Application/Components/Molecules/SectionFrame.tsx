import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';
import { EmptyScreenError } from './EmptyScreenError';
import { ListSkeleton } from './ListSkeleton';
import { SectionHeading } from './SectionHeading';

/** Texto del estado vacío por defecto cuando no se aporta `empty`/`emptyLabel`. */
const DEFAULT_EMPTY_LABEL = 'Sin datos';

/**
 * Tarjeta de sección (radio 10px, borde y `surface-1`, padding 14px). Se exporta
 * para agrupar bloques internos de una sección con la misma receta.
 */
export const SECTION_CARD_CLASSNAME =
  'rounded-[10px] border border-border bg-surface-1 p-3.5';

/**
 * Tarjeta de filas etiqueta/valor (`DetailRow`) con 6px entre filas. El `!`
 * gana al `gap` de `space` de `Container`, que compone con `clsx`.
 */
export const SECTION_ROWS_CARD_CLASSNAME = `${SECTION_CARD_CLASSNAME} gap-1.5!`;

/**
 * Presentación del marco: `plain` (por defecto, sin superficie) o `card` (el
 * encabezado y el contenido dentro de una tarjeta `SECTION_CARD_CLASSNAME`).
 */
export type TSectionFrameVariant = 'plain' | 'card';

interface SectionFrameProps extends HTMLAttributes<HTMLDivElement> {
  /** Encabezado textual; se renderiza con `SectionHeading`. */
  title?: string;
  /**
   * Encabezado personalizado. Tiene prioridad sobre `title`; útil si el
   * encabezado no es texto plano.
   */
  heading?: ReactNode;
  /** La consulta de la sección falló (Principio VI). */
  isError?: boolean;
  /** La consulta de la sección está en curso (Principio VI). */
  isLoading?: boolean;
  /** La sección no tiene datos que mostrar. */
  isEmpty?: boolean;
  /** Nodo de error (por defecto, `EmptyScreenError`). */
  error?: ReactNode;
  /** Nodo de carga (por defecto, `ListSkeleton`). */
  loading?: ReactNode;
  /** Nodo vacío (por defecto, un `<p>` con `emptyLabel`). */
  empty?: ReactNode;
  /** Texto del estado vacío por defecto. */
  emptyLabel?: string;
  /** Presentación del marco (por defecto `plain`). */
  variant?: TSectionFrameVariant;
  children?: ReactNode;
}

/**
 * Marco de sección con los estados de pantalla obligatorios en orden
 * **error → carga → vacío → datos** (Principio VI / FR-008).
 *
 * El encabezado y el contenido cuelgan **directamente del mismo `Container`
 * raíz** (no se añade ninguna envoltura intermedia). Esto mantiene el contrato
 * observable que verifican los specs de Inspector/`MetricsSection` con
 * `heading.parentElement`: el contenido sigue siendo descendiente del padre del
 * encabezado, en el mismo nivel DOM que hoy.
 */
export const SectionFrame = ({
  title,
  heading,
  isError = false,
  isLoading = false,
  isEmpty = false,
  error,
  loading,
  empty,
  emptyLabel = DEFAULT_EMPTY_LABEL,
  variant = 'plain',
  children,
  className,
  ...props
}: SectionFrameProps) => {
  const resolvedHeading =
    heading ??
    (title !== undefined ? <SectionHeading>{title}</SectionHeading> : null);

  let content: ReactNode = children;
  if (isError) {
    content = error ?? <EmptyScreenError />;
  } else if (isLoading) {
    content = loading ?? <ListSkeleton />;
  } else if (isEmpty) {
    content =
      empty ?? <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <Container
      space="small"
      className={cn(variant === 'card' && SECTION_CARD_CLASSNAME, className)}
      {...props}
    >
      {resolvedHeading}
      {content}
    </Container>
  );
};
