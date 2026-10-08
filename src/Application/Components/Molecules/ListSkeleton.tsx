import { cn } from '@app/Application/lib/utils';
import { Container } from '../Layout';
import { Skeleton } from '../ui/skeleton';

/** Número de líneas por defecto del esqueleto. */
const DEFAULT_LINES = 2;

interface ListSkeletonProps {
  /** Número de líneas esqueleto (por defecto 2). */
  lines?: number;
  className?: string;
}

/**
 * Esqueleto de carga de una lista: líneas alternas `w-full`/`w-4/5`.
 *
 * Usado por las secciones con estado `isLoading` (Principio VI). Reutiliza el
 * `Skeleton` de `ui/` y no monta contenido real.
 */
export const ListSkeleton = ({
  lines = DEFAULT_LINES,
  className,
}: ListSkeletonProps) => (
  <Container space="small" className={className}>
    {Array.from({ length: lines }, (_, index) => (
      <Skeleton
        key={index}
        className={cn('h-4 rounded-flat', index % 2 === 0 ? 'w-full' : 'w-4/5')}
      />
    ))}
  </Container>
);
