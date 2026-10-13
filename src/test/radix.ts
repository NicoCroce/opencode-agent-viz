import userEvent from '@testing-library/user-event';

/**
 * Radix (`Select`, `AlertDialog`, `Popover`, `Tabs`) usa APIs que jsdom no
 * implementa. Se instalan una sola vez desde `setup.ts`; un spec puede seguir
 * sobrescribiéndolas con `vi.fn()` si necesita espiarlas.
 */
export const installRadixPolyfills = (): void => {
  const proto = Element.prototype;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => undefined;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => undefined;
  if (!proto.scrollIntoView) proto.scrollIntoView = () => undefined;
};

/**
 * `userEvent` para Radix: con el portal abierto Radix bloquea el puntero fuera
 * de él, así que se desactiva la comprobación de `pointer-events`. Tras abrir un
 * overlay, espera el foco con `await screen.findBy…` / `waitFor` (Radix lo mueve
 * con `setTimeout`) para evitar warnings `act(...)`.
 */
export const setupRadixUser = () => userEvent.setup({ pointerEventsCheck: 0 });
