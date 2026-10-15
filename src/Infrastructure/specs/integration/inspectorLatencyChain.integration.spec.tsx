/**
 * U19 (T015) — E2E de frontera **U6↔U2↔U4**: cadena contexto/latencia → pestaña
 * **Latencia** (`contracts/inspector-section-tabs-contract.md` §5, FR-009).
 *
 * Monta el `InspectorPanel` **real** (no el marcador) dentro de
 * `renderWithProviders` + `createIntegrationQueryClient` con el SDK doblado por
 * el arnés (`serviceMock`/`resetServiceMock`) y la caché sembrada antes del
 * render: el contexto de la sesión (`sessions.context(id)`) por `seedQueryData`
 * y el umbral de anomalía en el store global para que el control sea
 * determinista.
 *
 * 1. **Camino feliz**: la pestaña Latencia conserva la sección **completa** —
 *    referencia de umbral, control del umbral y listado de respuestas medidas
 *    con sus anomalías (FR-009) — y las anomalías **no** filtran ni deshabilitan
 *    la sección: siguen montadas todas las respuestas, el control sigue visible
 *    y operativo.
 * 2. **Caso negativo (dato inexistente / 404)**: la fuente de contexto/latencia
 *    responde 404 ⇒ estado de **error** visible en Latencia y **nunca** el vacío
 *    falso ("Sin respuestas medidas"). La pestaña Latencia sigue montada.
 *
 * Nota de frontera: en la implementación vigente `useContextMetrics` expone
 * `isError`/`isLoading` desde los mensajes del padre (`getSessionMessages`), no
 * desde `getSessionContext`; el caso negativo rechaza **ambas** fuentes para que
 * la aserción cubra la cadena tal como está cableada hoy y siga siendo válida
 * si `converge` reconduce la latencia a `useSessionContext`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { STORE_KEY } from '@app/Application/Hooks';
import { DEFAULT_ANOMALY_THRESHOLD } from '@app/Application/Helpers/anomalyThreshold';
import { queryKeys } from '@app/Domains/queryKeys';
import { InspectorPanel } from '@app/Domains/Inspector/Components/InspectorPanel';
import { latencyAnomaly, latencySample } from '@app/test/latencyFixtures';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import {
  createIntegrationQueryClient,
  resetServiceMock,
  seedQueryData,
  serviceMock,
} from './harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
});

const SESSION_ID = 'ses_latency';
const PARENT_SESSION_ID = 'ses_parent';

const START = new Date(2024, 0, 15, 9, 5).getTime();
const MINUTE = 60_000;

/** `data-testid` congelado de la sección de latencia (contrato §5). */
const LATENCY_SECTION_TEST_ID = 'latency-section';

/** Etiqueta exacta de la pestaña (contrato §1, FR-005). */
const LATENCY_TAB_LABEL = 'Latencia';

/** Nodo mínimo del grafo; `context` aporta la serie de latencia (US6). */
const buildNode = (
  sessionId: string,
  context?: TGraphNode['data']['context'],
): TGraphNode => ({
  id: sessionId,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId,
    title: `Tarea ${sessionId}`,
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
    context,
  },
});

/**
 * Contexto del nodo con dos respuestas medidas y una anomalía (`s1`, lenta):
 * `s2` tarda lo esperado (su demora es de herramientas), de modo que un filtro
 * por anomalías dejaría de listarla y la guardia de "no filtra" tendría
 * contenido que comprobar.
 */
const latencyContext = (): TGraphNode['data']['context'] => ({
  breakdown: {
    buckets: [],
    chars: 0,
    windowTokens: null,
    hasTokens: false,
  },
  window: {
    windowTokens: null,
    cacheRead: null,
    cacheWrite: null,
    hitRate: null,
    costPerKToken: null,
  },
  latency: {
    samples: [
      latencySample({
        stepId: 's1',
        startedAt: START,
        generationMs: 12_000,
        totalMs: 12_500,
        outputTokens: 400,
        expectedMs: 5000,
      }),
      latencySample({
        stepId: 's2',
        startedAt: START + MINUTE,
        generationMs: 4000,
        totalMs: 34_000,
        toolMs: 30_000,
        topTool: 'shell',
      }),
    ],
    paces: [{ model: 'p/m', baseMs: 1000, msPerToken: 10, samples: 20 }],
    anomalies: [latencyAnomaly({ stepId: 's1', ratio: 2.4, expectedMs: 5000, excessMs: 7000 })],
  },
  provisional: false,
});

/**
 * Caché sembrada **antes** del render: el contexto de la sesión (clave
 * `sessions.context(id)`, `seedQueryData`) y el umbral del store global. Sin
 * sembrar los mensajes de la sesión, `resetServiceMock` los deja vacíos.
 */
const seedLatencyCache = (client: QueryClient): void => {
  seedQueryData(client, queryKeys.sessions.context(SESSION_ID), []);
  // `resetServiceMock` no deja valor por defecto para el diff: se siembra vacío
  // para que la sección de Archivos resuelva sin aviso de query indefinida.
  seedQueryData(client, queryKeys.sessions.diff(SESSION_ID), []);
  seedQueryData(client, [STORE_KEY.anomalyThreshold], DEFAULT_ANOMALY_THRESHOLD);
};

const renderPanel = (
  node: TGraphNode,
  options: { invokedBy?: TGraphNode } = {},
) =>
  renderWithProviders(<InspectorPanel node={node} invokedBy={options.invokedBy} />, {
    queryClient: createIntegrationQueryClient(),
    seed: seedLatencyCache,
  });

/** Lleva el foco/servicio Radix al tablist para poder pulsar la pestaña. */
const getLatencyTab = (): HTMLElement =>
  screen.getByRole('tab', { name: LATENCY_TAB_LABEL });

const openLatencyTab = async (): Promise<HTMLElement> => {
  const user = setupRadixUser();
  await user.click(getLatencyTab());
  await waitFor(() =>
    expect(getLatencyTab()).toHaveAttribute('aria-selected', 'true'),
  );
  return screen.getByTestId(LATENCY_SECTION_TEST_ID);
};

beforeEach(() => {
  resetServiceMock(serviceMock);
  globalThis.localStorage?.clear();
});

describe('InspectorPanel — cadena contexto/latencia → pestaña Latencia (§5, FR-009)', () => {
  it('muestra la sección completa: reparto, ritmo del modelo, umbral y respuestas lentas', async () => {
    renderPanel(buildNode(SESSION_ID, latencyContext()));

    const section = await openLatencyTab();

    // Reparto del tiempo del nodo (modelo 16 s, herramientas 30 s).
    expect(within(section).getByText('Reparto del tiempo')).toBeInTheDocument();
    expect(within(section).getByText('16s · 35%')).toBeInTheDocument();
    expect(within(section).getByText('30s · 65%')).toBeInTheDocument();

    // Ritmo esperado del modelo, la referencia de la detección (FR-020).
    expect(within(section).getByText('Ritmo esperado del modelo')).toBeInTheDocument();
    expect(
      within(section).getByText('1.0s + 10.0 ms/tok · 20 resp.'),
    ).toBeInTheDocument();

    // Control del umbral (FR-022): valor por defecto, el doble de lo esperado.
    expect(within(section).getByText('Umbral de lentitud')).toBeInTheDocument();
    const slider = within(section).getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', 'Umbral de lentitud: ×2.0 lo esperado');
    expect(slider).toHaveValue('100');
    expect(slider).not.toBeDisabled();

    // Respuestas con su desglose: la causa principal va primero.
    expect(within(section).getByText('Respuestas')).toBeInTheDocument();
    expect(within(section).getByText('total 12s')).toBeInTheDocument();
    expect(within(section).getByText('total 34s')).toBeInTheDocument();
    expect(within(section).getByText('herramientas 30s (shell)')).toBeInTheDocument();

    // Respuestas lentas con su magnitud y lo esperado (FR-021/FR-023).
    expect(within(section).getByText('Respuestas lentas')).toBeInTheDocument();
    expect(
      within(section).getByText('×2.4 · +7.0s sobre 5.0s'),
    ).toBeInTheDocument();
  });

  it('las anomalías no filtran ni deshabilitan la sección: siguen todas las respuestas y el control opera', async () => {
    renderPanel(buildNode(SESSION_ID, latencyContext()));

    const section = await openLatencyTab();

    // Dos listas (Respuestas + Respuestas lentas) y las tres filas: la respuesta
    // no lenta (`s2`) sigue listada, así que la anomalía no filtró el listado.
    expect(within(section).getAllByRole('list')).toHaveLength(2);
    expect(within(section).getAllByRole('listitem')).toHaveLength(3);

    // El control sigue operativo (no deshabilitado por la anomalía): al moverlo
    // el umbral se propaga al store compartido y se refleja en la etiqueta.
    const slider = within(section).getByRole('slider');
    expect(slider).not.toBeDisabled();

    fireEvent.change(slider, { target: { value: '200' } });

    await waitFor(() =>
      expect(screen.getByTestId(LATENCY_SECTION_TEST_ID)).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(within(section).getByRole('slider')).toHaveAttribute(
        'aria-label',
        'Umbral de lentitud: ×3.0 lo esperado',
      ),
    );
    expect(within(section).getByText('×3.0')).toBeInTheDocument();
  });

  it('con la fuente de contexto en 404 muestra error en Latencia y nunca el vacío falso', async () => {
    // Dato inexistente (404): fallan las fuerzas de la cadena —el contexto de la
    // sesión y los mensajes que alimentan las métricas de contexto.
    serviceMock.getSessionContext.mockRejectedValue(new Error('404'));
    serviceMock.getSessionMessages.mockRejectedValue(new Error('404'));

    const parent = buildNode(PARENT_SESSION_ID);
    renderPanel(buildNode(SESSION_ID, latencyContext()), { invokedBy: parent });

    const section = await openLatencyTab();

    // Error visible (error → carga → vacío → datos, Principio VI).
    await waitFor(() =>
      expect(within(section).getByText('Error')).toBeInTheDocument(),
    );
    expect(
      within(section).getByText('Ocurrió un error al cargar los datos'),
    ).toBeInTheDocument();

    // Nunca vacío falso: el estado vacío legítimo no se muestra bajo el error.
    expect(
      within(section).queryByText('Sin respuestas medidas'),
    ).not.toBeInTheDocument();
  });
});
