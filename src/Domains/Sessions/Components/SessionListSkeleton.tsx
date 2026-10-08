import { ListSkeleton } from '@app/Application/Components/Molecules';

/**
 * Esqueleto de carga del listado de sesiones.
 *
 * Consume `ListSkeleton` (SH-13) en lugar de montar sus propios `Skeleton`
 * inline, eliminando el andamiaje duplicado. Mantiene las 5 líneas que el
 * contrato de estados (FR-019) espera en la fase de carga.
 */
export const SessionListSkeleton = () => <ListSkeleton lines={5} />;
