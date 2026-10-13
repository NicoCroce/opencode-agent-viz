import { Container, Skeleton } from '@app/Application/Components';

/**
 * Esqueleto de carga de la sección de contexto (FR-017; Principio VI). Se
 * muestra mientras los mensajes del nodo aún no están disponibles.
 */
export const ContextSectionSkeleton = () => (
  <Container space="small" data-testid="context-section-skeleton">
    <Skeleton className="h-2 w-full rounded-flat" />
    <Skeleton className="h-3 w-3/4" />
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-3 w-1/2" />
  </Container>
);
