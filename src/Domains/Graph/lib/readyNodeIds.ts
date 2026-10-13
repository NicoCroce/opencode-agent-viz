/**
 * Deriva el conjunto de nodos ya listos del subárbol (FR-011): lo enriquecido
 * en esta visita (`enriched`) unido a los ids cuyo contenido ya está en caché
 * según el predicado inyectado `hasMessages`.
 *
 * Es una función pura y sin consultas: el predicado lo aporta el llamante (el
 * hook pasa una lectura de `queryClient.getQueryData`), de modo que `lib/` no se
 * acopla a TanStack Query ni abre peticiones. Devuelve siempre un `Set` nuevo y
 * no muta `enriched`. El predicado se evalúa para cada id de `ids` (también los
 * ya presentes en `enriched`), igual que hacía el `useMemo` inline del hook, de
 * modo que la extracción no altera el número de lecturas de caché.
 */
export const collectReadyIds = (
  ids: string[],
  enriched: ReadonlySet<string>,
  hasMessages: (id: string) => boolean,
): Set<string> => {
  const ready = new Set<string>(enriched);
  for (const id of ids) {
    if (hasMessages(id)) ready.add(id);
  }
  return ready;
};
