import { cn } from '@app/Application/lib/utils';
import { ListSkeleton } from '@app/Application/Components/Molecules';

interface SessionListSkeletonProps {
  /**
   * Enmarca las líneas en el mismo contenedor `rounded-xl` de la tabla de la
   * página. Por defecto `false`: el rail del espacio de trabajo no cambia.
   */
  framed?: boolean;
}

/**
 * Esqueleto de carga del listado de sesiones.
 *
 * Consume `ListSkeleton` (SH-13) en lugar de montar sus propios `Skeleton`
 * inline, eliminando el andamiaje duplicado. Mantiene las 5 líneas que el
 * contrato de estados (FR-019) espera en la fase de carga.
 */
export const SessionListSkeleton = ({
  framed = false,
}: SessionListSkeletonProps) => (
  <ListSkeleton
    lines={5}
    className={cn(
      framed && 'rounded-xl border border-border bg-surface-1 p-[18px]',
    )}
  />
);
