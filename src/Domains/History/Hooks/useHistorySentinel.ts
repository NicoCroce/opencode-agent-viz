import { useEffect, useRef, type RefObject } from 'react';

interface UseHistorySentinelParams {
  /** Ref del centinela superior que dispara la carga de la página anterior. */
  sentinelRef: RefObject<HTMLDivElement | null>;
  /** Quedan páginas más antiguas por cargar (FR-013). */
  hasNextPage: boolean;
  /** Se está cargando la página anterior. */
  isFetchingNextPage: boolean;
  /** La página anterior falló: no se observa hasta reintentar (FR-016). */
  isFetchNextPageError: boolean;
  /** Dispara la carga de la página anterior (más antigua). */
  fetchNextPage: () => void;
}

/**
 * Observa el centinela superior con `IntersectionObserver` y dispara
 * `fetchNextPage` cuando el usuario llega al principio, ampliando la actividad
 * sin tope fijo (FR-013). Solo observa cuando hay más páginas y no está
 * cargando ni en error; se limpia al desmontar o al cambiar de estado.
 */
export const useHistorySentinel = ({
  sentinelRef,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: UseHistorySentinelParams): void => {
  // Mantiene la última función sin re-crear el observer en cada render.
  const fetchNextPageRef = useRef(fetchNextPage);

  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage || isFetchNextPageError) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((observed) => {
      if (observed.some((entry) => entry.isIntersecting)) {
        fetchNextPageRef.current();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef, hasNextPage, isFetchingNextPage, isFetchNextPageError]);
};
