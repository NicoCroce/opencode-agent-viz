import { Loader2 } from 'lucide-react';
import { cn } from '@app/Application/lib/utils';

interface SpinnerProps {
  className?: string;
}

/** Indicador de carga de trazo, alineado con el resto de iconos de la consola. */
export const Spinner = ({ className }: SpinnerProps) => (
  <Loader2
    aria-hidden
    className={cn('size-4 animate-spin text-muted-foreground', className)}
    strokeWidth={1.8}
  />
);
