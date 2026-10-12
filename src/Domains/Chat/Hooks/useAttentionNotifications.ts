import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { TAttentionItem } from '../Chat.entity';

/**
 * Aviso efímero accesible de atención (FR-009; `attention-contract.md §2`).
 *
 * Cuando aparece un pendiente **nuevo** en la lista derivada (`TAttentionItem[]`
 * de `deriveAttention`/`useSessionAttention`) dispara un toast de `sonner`, que
 * ya es una **live region** (`<Toaster />` montado en `App.tsx`): el anuncio sale
 * de la lista, **nunca** de un delta de stream. La acción del toast lleva a la
 * request **origen** (FR-010): el consumidor aporta `onNavigate` y recibe el
 * `TAttentionItem` completo, cuyo `sessionId` puede ser el de una sesión hija.
 *
 * **Dedupe por `item.id`**: cada pendiente se notifica una sola vez durante la
 * vida del hook; si el mismo `id` vuelve a aparecer (o la lista se re-renderiza
 * con una nueva referencia pero igual contenido) no se re-notifica (A5).
 *
 * Toda la lógica vive en el hook (AGENTS §4); el `Toaster`/tema es T065 y no se
 * toca aquí.
 */

/** Etiqueta de la acción del toast que enfoca la request origen (FR-010). */
export const ATTENTION_TOAST_ACTION_LABEL = 'Ver pendiente';

/** Manejador que navega/enfoca la request origen de un pendiente (FR-010). */
export type TAttentionNavigateHandler = (item: TAttentionItem) => void;

/** Descripción accesible del pendiente: tipo del pendiente anunciado. */
const describeKind = (kind: TAttentionItem['kind']): string =>
  kind === 'permission' ? 'Permiso pendiente' : 'Pregunta pendiente';

/**
 * `useAttentionNotifications(items, onNavigate?)` — toast deduplicado por `id`.
 *
 * - Notifica cada `item` cuyo `id` no se haya anunciado antes (incluidos los
 *   presentes al montar: para el operador son igualmente nuevos).
 * - La acción del toast invoca `onNavigate(item)` con el `sessionId` de origen.
 * - No emite nada por cambios de contenido ya vistos (dedupe estable).
 */
export const useAttentionNotifications = (
  items: TAttentionItem[],
  onNavigate?: TAttentionNavigateHandler,
): void => {
  const notifiedIds = useRef<Set<string>>(new Set());
  const navigateRef = useRef<TAttentionNavigateHandler | undefined>(onNavigate);

  // Mantiene la referencia más reciente sin re-disparar el efecto de anuncio por
  // el manejador (la navegación no debe ser causa de un nuevo toast).
  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    for (const item of items) {
      if (notifiedIds.current.has(item.id)) continue;

      // Marca antes de notificar: evita doble anuncio si el efecto se re-ejecuta
      // (p. ej. StrictMode) o si el ítem reaparece con el mismo `id`.
      notifiedIds.current.add(item.id);

      toast(item.title, {
        description: describeKind(item.kind),
        action: {
          label: ATTENTION_TOAST_ACTION_LABEL,
          onClick: () => navigateRef.current?.(item),
        },
      });
    }
  }, [items]);
};
