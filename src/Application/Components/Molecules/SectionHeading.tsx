import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@app/Application/lib/utils';

interface SectionHeadingProps extends HTMLAttributes<HTMLSpanElement> {
  /** Texto del encabezado (normalmente el nombre de la sección). */
  children: ReactNode;
  className?: string;
  /** Añade un pequeño marcador de señal a la izquierda. */
  marker?: boolean;
}

/**
 * Encabezado de sección del panel: versalitas atenuadas de 10px con tracking
 * amplio. El `marker` pinta una marca cyan de 4px que ancla la sección sin
 * añadir otro borde. Presentación pura (sin lógica ni estado).
 */
export const SectionHeading = ({
  children,
  className,
  marker = false,
  ...props
}: SectionHeadingProps) => (
  <span
    className={cn(
      'flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80',
      className,
    )}
    {...props}
  >
    {marker ? (
      <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-signal" />
    ) : null}
    {children}
  </span>
);
