/**
 * U16 (T011) — E2E de frontera **U4↔U3**: ciclo de vida del montaje del detalle.
 *
 * Monta el `InspectorPanel` **real** (no el marcador) con `renderWithProviders` +
 * `createIntegrationQueryClient` y el SDK mockeado por el arnés
 * (`serviceMock`/`resetServiceMock`), sembrando la caché de mensajes
 * (`sessions.messages(id)`) para que el camino feliz tenga datos reales.
 *
 * Cubre `contracts/inspector-section-tabs-contract.md` §4 y `data-model.md` §2:
 *
 * 1. **Camino feliz**: nodo recién abierto ⇒ `Subagentes` activa con su contenido
 *    montado **sin acción previa** (el tablist es el último bloque del eje).
 * 2. Cambiar de nodo A→B **conserva** la pestaña elegida y el re-render no la
 *    resetea (el estado es efímero y no depende del nodo).
 * 3. **Caso negativo (dato inexistente)**: `node = null` ⇒ `InspectorEmptyPrompt`
 *    y **cero** `role="tablist"` en el documento.
 * 4. Cierre y **reapertura** del detalle ⇒ vuelve a `subagents` (remontaje, sin
 *    persistencia).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { queryKeys } from '@app/Domains/queryKeys';
import { InspectorPanel } from '@app/Domains/Inspector/Components/InspectorPanel';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  createIntegrationQueryClient,
  resetServiceMock,
  seedMessages,
  seedQueryData,
  serviceMock,
} from './harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
});

const SESSION_A = 'ses_a';
const SESSION_B = 'ses_b';

/** Nodo mínimo del grafo con identidad distinguible por sesión. */
const buildNode = (sessionId: string, title: string): TGraphNode => ({
  id: sessionId,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId,
    title,
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo',
    model: { providerID: 'opencode-go', id: 'deepseek' },
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: 0,
      startedAt: 0,
      endedAt: 0,
      cost: 0,
      tokens: null,
      invocations: 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: true,
    currentTool: null,
    parallel: null,
  },
});

/** Tool call `subagent` que `deriveTasks` traduce a una tarea delegada. */
const subagentTool = (
  description: string,
): SessionMessageAssistant['content'][number] => ({
  type: 'tool',
  id: 'tool-subagent',
  name: 'subagent',
  state: {
    status: 'completed',
    input: { description },
    content: [{ type: 'text', text: 'ok' }],
  },
  time: { created: 1000, completed: 1500 },
});

/** Mensaje asistente con una tarea delegada, envolviendo `parts` como el SDK. */
const taskMessage = (description: string): TSessionMessage => {
  const content = [subagentTool(description)];
  return {
    info: {
      id: 'assistant-1',
      time: { created: 1000, completed: 2000 },
      type: 'assistant',
      agent: 'develop',
      model: { providerID: 'opencode-go', id: 'deepseek' },
      content,
    },
    parts: content,
  };
};

/** `true` si `first` precede a `second` en el orden del DOM (FR-004). */
const isBefore = (first: HTMLElement, second: HTMLElement): boolean =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

const getTab = (name: string): HTMLElement => screen.getByRole('tab', { name });

/** Panel activo (los otros seis quedan `hidden` y Radix no monta sus hijos). */
const getActivePanel = (): HTMLElement => screen.getByRole('tabpanel');

/**
 * Caché sembrada antes del render (`staleTime: Infinity` del arnés): los
 * mensajes de la sesión (fuente de tareas y errores) y el diff vacío, que
 * `resetServiceMock` no deja con valor por defecto.
 */
const seedPanelCache = (client: QueryClient): void => {
  seedMessages(client, {
    [SESSION_A]: [taskMessage('Delegar revisión')],
    [SESSION_B]: [],
  });
  seedQueryData(client, queryKeys.sessions.diff(SESSION_A), []);
  seedQueryData(client, queryKeys.sessions.diff(SESSION_B), []);
};

beforeEach(() => {
  resetServiceMock(serviceMock);
});

describe('InspectorPanel — ciclo de vida del tablist de secciones (FR-003)', () => {
  it('abre con Subagentes activa y su contenido visible sin acción previa', async () => {
    const nodeA = buildNode(SESSION_A, 'Tarea A');

    renderWithProviders(<InspectorPanel node={nodeA} />, {
      queryClient: createIntegrationQueryClient(),
      seed: seedPanelCache,
    });

    // Pestaña inicial del contrato §4 (subagents), sin tocar nada.
    expect(getTab('Subagentes')).toHaveAttribute('aria-selected', 'true');

    // Solo el panel activo tiene hijos montados; su contenido es el de datos.
    const active = getActivePanel();
    expect(
      await within(active).findByText('Delegar revisión'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(7);

    // El tablist es el último bloque: va después del resumen continuo (FR-004).
    expect(
      isBefore(
        screen.getByText('Duración mediana por herramienta'),
        screen.getByRole('tablist'),
      ),
    ).toBe(true);
  });

  it('conserva la pestaña elegida al cambiar de nodo A→B y en el re-render', async () => {
    const user = setupRadixUser();
    const nodeA = buildNode(SESSION_A, 'Tarea A');
    const nodeB = buildNode(SESSION_B, 'Tarea B');

    const { rerender } = renderWithProviders(<InspectorPanel node={nodeA} />, {
      queryClient: createIntegrationQueryClient(),
      seed: seedPanelCache,
    });

    await user.click(getTab('Errores'));
    await waitFor(() =>
      expect(getTab('Errores')).toHaveAttribute('aria-selected', 'true'),
    );

    // Cambio de nodo sin desmontar el panel: la pestaña no se reinicia…
    rerender(<InspectorPanel node={nodeB} />);

    expect(screen.getByText('Tarea B')).toBeInTheDocument();
    expect(getTab('Errores')).toHaveAttribute('aria-selected', 'true');
    expect(within(getActivePanel()).getByText('Sin errores.')).toBeInTheDocument();

    // …y un re-render del mismo nodo tampoco la toca.
    rerender(<InspectorPanel node={nodeB} />);

    expect(getTab('Errores')).toHaveAttribute('aria-selected', 'true');
  });

  it('con node = null muestra el prompt y deja el documento sin tablist', () => {
    renderWithProviders(<InspectorPanel node={null} />, {
      queryClient: createIntegrationQueryClient(),
    });

    expect(
      screen.getByText('Selecciona un nodo del grafo para ver su detalle.'),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);
    expect(screen.queryAllByRole('tabpanel', { hidden: true })).toHaveLength(0);
  });

  it('al cerrar y reabrir el detalle vuelve a subagents (sin persistencia)', async () => {
    const user = setupRadixUser();
    const nodeA = buildNode(SESSION_A, 'Tarea A');

    const { rerender } = renderWithProviders(<InspectorPanel node={nodeA} />, {
      queryClient: createIntegrationQueryClient(),
      seed: seedPanelCache,
    });

    await user.click(getTab('Latencia'));
    await waitFor(() =>
      expect(getTab('Latencia')).toHaveAttribute('aria-selected', 'true'),
    );

    // Cierre del detalle: el prompt vacío desmonta el tablist.
    rerender(<InspectorPanel node={null} />);
    expect(screen.queryAllByRole('tablist')).toHaveLength(0);

    // Reapertura: el remontaje del componente restaura el valor inicial.
    rerender(<InspectorPanel node={nodeA} />);

    expect(getTab('Subagentes')).toHaveAttribute('aria-selected', 'true');
    expect(
      within(getActivePanel()).getByText('Subagentes'),
    ).toBeInTheDocument();
  });
});
