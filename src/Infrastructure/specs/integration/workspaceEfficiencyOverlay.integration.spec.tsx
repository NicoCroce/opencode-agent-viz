import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { setupRadixUser } from '@app/test/radix';

/**
 * Mocks **por barrel** (los mismos que documenta el arnés): se conservan los
 * hooks reales (incluido `useHistory`, que abre el histórico desde el grafo) y
 * solo los componentes pesados quedan como marcadores. Los `vi.mock` se
 * hoistean, por eso los factories importan el arnés de forma dinámica.
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
  flushIdle,
  INTEGRATION_SESSION_ID,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
  seedSessions,
  seedSubtree,
  TESTID,
} from './harness';

/**
 * U39 (T040) — E2E de la frontera U5↔U7: **overlay §2/§9**.
 *
 * Monta `WorkspacePage` con el arnés y ejerce la coordinación de capas desde la
 * página, con el estado de vista real (`useEfficiencyPanel` + `useHistory`) y
 * los marcadores de Graph/History:
 *
 *   1. Exclusión mutua (FR-006): con el histórico abierto, abrir eficiencia lo
 *      cierra; con eficiencia abierta, abrir el histórico la cierra. En ningún
 *      momento conviven dos capas.
 *   2. `Escape` con el diálogo abierto: Radix lo consume y cierra **solo** el
 *      diálogo; `useWorkspaceEscape` no registra su listener, así que la
 *      selección del grafo sobrevive. Sin diálogo vuelve a limpiarla.
 *   3. Negativos: histórico cerrado y sin selección ⇒ `Escape` no registra
 *      listener ni abre/cierra nada; abrir eficiencia dos veces (o reabrirla)
 *      deja una sola capa.
 */

const ROOT = INTEGRATION_SESSION_ID;
const DIALOG_NAME = 'Eficiencia de la sesión';
const CLOSE_NAME = 'Cerrar análisis de eficiencia';
const INTEGRATION_TIMEOUT_MS = 20_000;

/** Siembra el workspace mínimo con la raíz en caché (informe `no_data`). */
const seedWorkspace = (client: QueryClient): void => {
  const root = buildSessionInfo();
  seedSessions(client, [root]);
  seedSubtree(client, [root]);
  seedMessages(client, { [ROOT]: [] });
  seedDevice(client, false);
};

/** Monta el workspace en escritorio y espera a la fase estructural. */
const renderDesktop = async (): Promise<QueryClient> => {
  const client = createIntegrationQueryClient();
  seedWorkspace(client);
  await renderWorkspace(client);
  await flushIdle();
  await screen.findByTestId(TESTID.agentGraph);
  return client;
};

const efficiencyTrigger = (): HTMLElement =>
  screen.getByRole('button', { name: 'Eficiencia' });

const openEfficiency = async (): Promise<HTMLElement> => {
  fireEvent.click(efficiencyTrigger());
  return screen.findByRole('dialog', { name: DIALOG_NAME });
};

/**
 * Disparador del histórico del marcador del grafo. Con el diálogo de eficiencia
 * abierto, Radix oculta el resto del árbol (`aria-hidden`): se busca entre los
 * elementos ocultos, como el resto de specs del workspace.
 */
const historyTrigger = (): HTMLElement =>
  screen.getByRole('button', { name: 'Abrir histórico', hidden: true });

const historyLayer = (): HTMLElement | null =>
  screen.queryByTestId(TESTID.historyModal);

const dialogLayers = (): HTMLElement[] =>
  screen.queryAllByRole('dialog', { name: DIALOG_NAME });

const expectDialogClosed = async (): Promise<void> => {
  await waitFor(() => expect(dialogLayers()).toHaveLength(0));
};

beforeEach(() => {
  resetServiceMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('integración U5↔U7 — exclusión mutua de capas (T040, FR-006)', () => {
  it('con el histórico abierto, abrir eficiencia lo cierra', async () => {
    await renderDesktop();

    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir histórico' }),
    );
    expect(await screen.findByTestId(TESTID.historyModal)).toHaveAttribute(
      'data-node',
      ROOT,
    );
    expect(dialogLayers()).toHaveLength(0);

    await openEfficiency();

    // Solo queda la capa de eficiencia: el histórico se cerró, no se ocultó.
    expect(historyLayer()).not.toBeInTheDocument();
    expect(dialogLayers()).toHaveLength(1);
  }, INTEGRATION_TIMEOUT_MS);

  it('con eficiencia abierta, abrir el histórico la cierra', async () => {
    await renderDesktop();

    await openEfficiency();
    expect(dialogLayers()).toHaveLength(1);

    fireEvent.click(historyTrigger());

    expect(await screen.findByTestId(TESTID.historyModal)).toHaveAttribute(
      'data-node',
      ROOT,
    );
    await expectDialogClosed();
    // La capa de histórico sustituye a la de eficiencia; nunca conviven.
    expect(historyLayer()).toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);
});

describe('integración U5↔U7 — Escape y selección del grafo (T040, overlay §2)', () => {
  it('con el diálogo abierto, Escape cierra solo el diálogo y conserva la selección', async () => {
    const user = setupRadixUser();
    await renderDesktop();

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));
    const graph = screen.getByTestId(TESTID.agentGraph);
    expect(graph).toHaveAttribute('data-selected', ROOT);

    await openEfficiency();
    // Radix mueve el foco al primer focusable; el `Escape` pertenece al diálogo.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: CLOSE_NAME })).toHaveFocus(),
    );

    await user.keyboard('{Escape}');

    await expectDialogClosed();
    // `useWorkspaceEscape` no registró su listener: la selección sobrevive.
    expect(graph).toHaveAttribute('data-selected', ROOT);
    expect(historyLayer()).not.toBeInTheDocument();

    // Cerrado el diálogo, el listener vuelve a registrar y limpia la selección.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(graph).toHaveAttribute('data-selected', ''));
  }, INTEGRATION_TIMEOUT_MS);

  it('negativo: histórico cerrado y sin selección ⇒ Escape no registra listener ni altera capas', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const keydownAdds = (): number =>
      addSpy.mock.calls.filter(([type]) => type === 'keydown').length;
    const keydownRemoves = (): number =>
      removeSpy.mock.calls.filter(([type]) => type === 'keydown').length;

    await renderDesktop();

    // Estado inicial: ni selección ni fullscreen ni diálogo ⇒ sin listener.
    expect(keydownAdds()).toBe(0);

    fireEvent.keyDown(window, { key: 'Escape' });

    // `Escape` no encuentra nada que cerrar ni limpiar y no abre capas.
    expect(keydownAdds()).toBe(0);
    expect(keydownRemoves()).toBe(0);
    expect(dialogLayers()).toHaveLength(0);
    expect(historyLayer()).not.toBeInTheDocument();
    expect(screen.getByTestId(TESTID.agentGraph)).toHaveAttribute(
      'data-selected',
      '',
    );
  }, INTEGRATION_TIMEOUT_MS);
});

describe('integración U5↔U7 — una sola capa de eficiencia (T040, overlay §2)', () => {
  it('negativo: abrir eficiencia dos veces no deja dos capas', async () => {
    await renderDesktop();

    fireEvent.click(efficiencyTrigger());
    await screen.findByRole('dialog', { name: DIALOG_NAME });

    // Segundo disparo con el diálogo ya abierto (el disparador está oculto para
    // la accesibilidad): `open` es idempotente y Radix no monta otro portal.
    fireEvent.click(
      screen.getByRole('button', { name: 'Eficiencia', hidden: true }),
    );

    expect(dialogLayers()).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: CLOSE_NAME }),
    ).toHaveLength(1);

    // Cerrar y reabrir tampoco acumula una segunda capa.
    fireEvent.click(screen.getByRole('button', { name: CLOSE_NAME }));
    await expectDialogClosed();

    await openEfficiency();
    expect(dialogLayers()).toHaveLength(1);
  }, INTEGRATION_TIMEOUT_MS);
});
