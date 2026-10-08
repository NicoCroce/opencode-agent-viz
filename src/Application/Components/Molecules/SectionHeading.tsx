import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';

interface SectionHeadingProps extends HTMLAttributes<HTMLSpanElement> {
  /** Texto del encabezado (normalmente el nombre de la sección). */
  children: ReactNode;
  className?: string;
}

/**
 * Encabezado de sección del panel: versalitas atenuadas de 11px.
 *
 * Centraliza el patrón `<span>` repetido en las secciones del Inspector y en
 * `Application`/`History`. Presentación pura (sin lógica ni estado). Reenvía los
 * atributos nativos del `<span>` (p. ej. `title`), de modo que los consumidores
 * que necesitan un tooltip o un `data-*` no deban envolverlo en un `<span>` extra.
 */
export const SectionHeading = ({
  children,
  className,
  ...props
}: SectionHeadingProps) => (
  <span
    className={cn(
      'text-[11px] font-medium uppercase tracking-wide text-muted-foreground',
      className,
    )}
    {...props}
  >
    {children}
  </span>
);
