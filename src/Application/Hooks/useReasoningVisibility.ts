import { useCallback, useState } from 'react';

/** Vista de razonamiento: visibilidad local y su alternancia. */
export interface TReasoningVisibility {
  visible: boolean;
  toggle: () => void;
}

/**
 * Controla la visibilidad del razonamiento en la vista.
 *
 * Estado local de la vista, sin persistencia: se pierde al desmontar.
 * `WorkspacePage` lo posee y lo pasa al Inspector (`AnswersSection`) y al
 * overlay (`HistoryModal`) para que ambos coincidan (contrato rich-text).
 *
 * @param {boolean} [initial=false] - Valor inicial de `visible`.
 * @returns {TReasoningVisibility} `visible` y `toggle`.
 */
export const useReasoningVisibility = (
  initial: boolean = false,
): TReasoningVisibility => {
  const [visible, setVisible] = useState(initial);

  const toggle = useCallback(() => setVisible((value) => !value), []);

  return { visible, toggle };
};
