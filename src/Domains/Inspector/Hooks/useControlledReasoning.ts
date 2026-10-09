import {
  useReasoningVisibility,
  type TReasoningVisibility,
} from '@app/Application/Hooks';

/**
 * Resuelve la visibilidad del razonamiento en modo controlado o local.
 *
 * Si el llamador impone `showReasoning`/`onToggle` (US2, `WorkspacePage`, que
 * comparte el estado con el overlay), se usan esos; si se omiten, el panel la
 * gestiona localmente con `useReasoningVisibility` (modo no controlado, US1).
 *
 * @param {boolean} [showReasoning] - Visibilidad impuesta por el llamador.
 * @param {() => void} [onToggle] - Alternancia impuesta por el llamador.
 * @returns {TReasoningVisibility} `visible` y `toggle` resueltos.
 */
export const useControlledReasoning = (
  showReasoning?: boolean,
  onToggle?: () => void,
): TReasoningVisibility => {
  const local = useReasoningVisibility(false);

  return {
    visible: showReasoning ?? local.visible,
    toggle: onToggle ?? local.toggle,
  };
};
