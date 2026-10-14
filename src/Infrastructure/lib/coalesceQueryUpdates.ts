import type { TQueryUpdate } from '@app/Domains/Graph/lib/eventReducer';
import { sameQueryKey } from '@app/Application/Helpers/queryKey';

type TSetUpdate = Extract<TQueryUpdate, { kind: 'set' }>;
type TInvalidateUpdate = Extract<TQueryUpdate, { kind: 'invalidate' }>;

/** Compone dos updaters en orden de aplicación: `first` y luego `second`. */
const composeUpdaters = (
  first: TSetUpdate['updater'],
  second: TSetUpdate['updater'],
): TSetUpdate['updater'] => (prev) => second(first(prev));

/** Update representativo de una `queryKey`, con el índice del último que lo generó. */
type TRepresentative<TUpdate extends TQueryUpdate> = {
  update: TUpdate;
  order: number;
};

/**
 * Comprime los updates de cache de un mismo flush SSE sin cambiar el resultado
 * **observable** de la caché (datos y `isInvalidated`), no la secuencia de
 * llamadas al `queryClient`.
 *
 * Por cada `queryKey` **exacta** se conserva un único representante:
 * - los `set` se fusionan en uno solo componiendo sus `updater` en orden;
 * - los `invalidate` repetidos colapsan en el último.
 *
 * El representante se coloca en la posición del **último** update de su clase,
 * no en la del primero. Es lo que preserva el orden frente a las invalidaciones
 * **por prefijo**: `invalidateQueries` de TanStack casa por prefijo, así que
 * `set(K)`, `invalidate(P)` (con `P` prefijo de `K`), `set(K)` debe dejar a `K`
 * sin invalidar. Con el `set` compuesto emitido en su última posición, la
 * invalidación intermedia queda antes del `set` final y el efecto final coincide
 * con el de aplicar los updates en orden. Un run de `set` interrumpido por un
 * `invalidate` que lo cubre tampoco colapsa en `set, invalidate`: es imposible
 * sin perder el `set` final, así que se reordena en su lugar.
 */
export const coalesceQueryUpdates = (
  updates: readonly TQueryUpdate[],
): TQueryUpdate[] => {
  const setReps: TRepresentative<TSetUpdate>[] = [];
  const invalidateReps: TRepresentative<TInvalidateUpdate>[] = [];

  for (let order = 0; order < updates.length; order += 1) {
    const update = updates[order];

    if (update.kind === 'invalidate') {
      const existing = invalidateReps.find((rep) =>
        sameQueryKey(rep.update.queryKey, update.queryKey),
      );
      if (existing === undefined) {
        invalidateReps.push({ update, order });
      } else {
        existing.order = order;
      }
      continue;
    }

    const existing = setReps.find((rep) =>
      sameQueryKey(rep.update.queryKey, update.queryKey),
    );
    if (existing === undefined) {
      setReps.push({ update, order });
      continue;
    }
    existing.update = {
      kind: 'set',
      queryKey: existing.update.queryKey,
      updater: composeUpdaters(existing.update.updater, update.updater),
    };
    existing.order = order;
  }

  return [...setReps, ...invalidateReps]
    .sort((a, b) => a.order - b.order)
    .map((rep) => rep.update);
};
