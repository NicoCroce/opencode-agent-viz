import type { ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';

interface SectionHeadingProps {
  /** Texto del encabezado (normalmente el nombre de la sección). */
  children: ReactNode;
  className?: string;
}

/**
 * Encabezado de sección del panel: versalitas atenuadas de 11px.
 *
 * Centraliza el patrón `<span>` repetido en las secciones del Inspector y en
 * `Application`/`History`. Presentación pura (sin lógica ni estado).
 */
export const SectionHeading = ({ children, className }: SectionHeadingProps) => (
  <span
    className={cn(
      'text-[11px] font-medium uppercase tracking-wide text-muted-foreground',
      className,
    )}
  >
    {children}
  </span>
);
