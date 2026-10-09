import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';
import { EmptyScreenError } from './EmptyScreenError';
import { ListSkeleton } from './ListSkeleton';
import { SectionHeading } from './SectionHeading';

/** Texto del estado vacío por defecto cuando no se aporta `empty`/`emptyLabel`. */
const DEFAULT_EMPTY_LABEL = 'Sin datos';

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
    <Container space="small" className={cn(className)} {...props}>
      {resolvedHeading}
      {content}
    </Container>
  );
};
