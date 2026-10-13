import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

/**
 * Mocks **por barrel** (mismos que documenta el arnés): se conservan los hooks
 * reales y el modelo por fases, y solo los componentes pesados quedan como
 * marcadores. Los `vi.mock` se hoistean, por eso los factories importan el arnés
 * de forma dinámica.
 */
vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock } = await import('./harness');
  return { opencodeService: serviceMock };
});
vi.mock('@app/Domains/Graph', async () => {
  const { mockGraphBarrel } = await import('./harness');
  return mockGraphBarrel();
});
vi.mock('@app/Domains/Sessions', async () => {
  const { mockSessionsBarrel } = await import('./harness');
  return mockSessionsBarrel();
});
vi.mock('@app/Domains/Chat', async () => {
  const { mockChatBarrel } = await import('./harness');
  return mockChatBarrel();
});
vi.mock('@app/Domains/Inspector', async () => {
  const { mockInspectorBarrel } = await import('./harness');
  return mockInspectorBarrel();
});
vi.mock('@app/Domains/History', async () => {
  const { mockHistoryBarrel } = await import('./harness');
  return mockHistoryBarrel();
});

import {
  buildSessionInfo,
  createIntegrationQueryClient,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

/**
 * Frontera U2↔U3/U6 — precedencia de `Escape` (T021).
 *
 * Ejercita la coordinación **desde la página** (`WorkspacePage` +
 * `useWorkspaceEscape` + `isFocusWithinChat`) con el modelo real, el panel de
 * detalle real (que hospeda el control de fullscreen) y el marcador del chat:
 *
 *   1. Foco **fuera** del chat, con fullscreen y selección ⇒ el primer `Escape`
 *      cierra el fullscreen y **no** limpia la selección; el segundo la limpia.
 *   2. Foco **dentro** de `[data-testid="chat-panel"]` ⇒ no propaga (ni cierra
 *      el fullscreen ni limpia la selección); al salir del chat sí actúa.
 *   3. Sin fullscreen ni selección ⇒ el listener global no se registra.
 *
 * El caso 1 cubre el camino feliz; el 2 es el caso negativo obligatorio de la
 * frontera. Las tres suites comparten el arnés (`harness.tsx`, sin editarlo).
 */

const resetHarness = (): void => {
  resetServiceMock();
};

beforeEach(resetHarness);

afterEach(() => {
  vi.restoreAllMocks();
});

/** Renderiza el workspace en escritorio y espera a la fase estructural. */
const renderDesktop = async (): Promise<void> => {
  const client = createIntegrationQueryClient();
  seedSessions(client, [buildSessionInfo()]);
  seedSubtree(client, [buildSessionInfo()]);
  seedDevice(client, false);

  await renderWorkspace(client);

  await waitFor(() =>
    expect(screen.getByTestId(TESTID.agentGraph)).toBeInTheDocument(),
  );
};

/** Selecciona el primer nodo del grafo (habilita el listener de `Escape`). */
const selectFirstNode = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));
};

/** Entra en pantalla completa desde el control real de la cabecera del panel. */
const toggleFullscreen = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
};

/** Abre la pestaña Chat (escritorio) y devuelve su composer. */
const openChat = async (): Promise<HTMLTextAreaElement> => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Chat/ }), {
    button: 0,
  });
  return screen.findByRole('textbox', { name: 'Mensaje' });
};

const inspectorColumn = (): HTMLElement =>
  screen.getByTestId('inspector-column');

const graph = (): HTMLElement => screen.getByTestId(TESTID.agentGraph);

describe('workspaceEscape — precedencia de Escape (T021, FR-009, U2↔U3/U6)', () => {
  it('foco fuera del chat: cierra primero el fullscreen y después limpia la selección', async () => {
    await renderDesktop();
    selectFirstNode();
    toggleFullscreen();

    expect(inspectorColumn()).toHaveAttribute('data-fullscreen', 'true');
    expect(graph()).toHaveAttribute('data-selected', INTEGRATION_SESSION_ID);

    // El foco quedó en el control de fullscreen (fuera del chat): el primer
    // `Escape` cierra el fullscreen y conserva la selección.
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(inspectorColumn()).not.toHaveAttribute('data-fullscreen'),
    );
    expect(graph()).toHaveAttribute('data-selected', INTEGRATION_SESSION_ID);

    // El segundo `Escape` (ya sin fullscreen) limpia la selección.
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(graph()).toHaveAttribute('data-selected', ''),
    );
  });

  it('foco dentro del chat: no cierra el fullscreen ni limpia la selección', async () => {
    await renderDesktop();
    toggleFullscreen();
    selectFirstNode();

    const composer = await openChat();
    act(() => composer.focus());

    fireEvent.keyDown(window, { key: 'Escape' });

    // El `Escape` pertenece al composer: no se propaga a la página.
    expect(inspectorColumn()).toHaveAttribute('data-fullscreen', 'true');
    expect(graph()).toHaveAttribute('data-selected', INTEGRATION_SESSION_ID);

    // Fuera del chat, el listener sí actúa: prueba que el bloqueo era el foco.
    act(() => composer.blur());
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(inspectorColumn()).not.toHaveAttribute('data-fullscreen'),
    );
    expect(graph()).toHaveAttribute('data-selected', INTEGRATION_SESSION_ID);
  });

  it('sin fullscreen ni selección el listener global no se registra', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const keydownAdds = (): number =>
      addSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    const keydownRemoves = (): number =>
      removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;

    await renderDesktop();

    // Estado inicial: ni fullscreen ni selección ⇒ sin listener de `keydown`.
    expect(keydownAdds()).toBe(0);

    // `Escape` no encuentra nada que cerrar ni limpiar.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(graph()).toHaveAttribute('data-selected', '');
    expect(keydownAdds()).toBe(0);

    // La selección activa el listener; el `Escape` la limpia y lo retira.
    selectFirstNode();
    expect(keydownAdds()).toBe(1);

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(graph()).toHaveAttribute('data-selected', ''));
    expect(keydownRemoves()).toBe(1);
    expect(keydownAdds()).toBe(1);
  });
});
