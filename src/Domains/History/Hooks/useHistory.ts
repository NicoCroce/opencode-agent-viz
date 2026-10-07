import { useCallback, useState } from 'react';
import type { THistoryTarget } from '../History.entity';

/** Estado de vista del overlay de histórico y su navegación de linaje. */
export interface UseHistoryResult {
  /** Sesión cuyo histórico está abierto; `null` = overlay cerrado. */
  targetId: THistoryTarget;
  /** Abre el histórico de `sessionId` (detalle del agente o doble clic en el nodo). */
  open: (sessionId: string) => void;
  /** Cierra el overlay y devuelve al grafo conservando la selección (FR-014). */
  close: () => void;
  /** Cambia el objetivo al padre/hijo sin cerrar el overlay (FR-012). */
  navigateTo: (sessionId: string) => void;
}

/**
 * Controla el overlay de histórico completo de un agente o subagente
 * (FR-008/012/014).
 *
 * Estado de vista local, sin persistencia (Principio IV): se pierde al
 * desmontar. `WorkspacePage` lo posee y lo cablea con el grafo, el inspector y
 * el `HistoryModal`; al cambiar la sesión raíz es el llamador quien invoca
 * `close()`, y si el objetivo desaparece del grafo el overlay se marca "no
 * disponible" y se cierra (edge cases del contrato).
 *
 * `navigateTo` y `open` fijan el mismo `targetId`; se distinguen por intención:
 * `open` abre desde el grafo/inspector y `navigateTo` recorre el linaje
 * padre↔hijo manteniendo el overlay abierto.
 */
export const useHistory = (): UseHistoryResult => {
  const [targetId, setTargetId] = useState<THistoryTarget>(null);

  const open = useCallback((sessionId: string) => setTargetId(sessionId), []);

  const close = useCallback(() => setTargetId(null), []);

  const navigateTo = useCallback(
    (sessionId: string) => setTargetId(sessionId),
    [],
  );

  return { targetId, open, close, navigateTo };
};
