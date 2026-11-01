import { Container, Skeleton } from '@app/Application/Components';

/**
 * Esqueleto de carga del panel de eficiencia (contrato §4).
 *
 * Anuncia el estado con `role="status"` y un texto accesible; no renderiza
 * nota, métricas ni datos: solo la silueta de los bloques del informe.
 */
export const EfficiencySkeleton = () => (
  <Container space="medium" className="p-6" role="status">
    <span className="sr-only">Cargando análisis…</span>
    <Skeleton className="h-8 w-40 rounded-flat" />
    <Skeleton className="h-4 w-56 rounded-flat" />
    <Skeleton className="h-24 w-full rounded-flat" />
    <Skeleton className="h-24 w-full rounded-flat" />
  </Container>
);
