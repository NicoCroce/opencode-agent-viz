/**
 * U38 (T061) — E2E de U1↔U3↔U7: **engine §7 + overlay §5.6/R8**.
 *
 * Monta `WorkspacePage` con el arnés y comprueba que los totales del panel se
 * derivan de los mensajes reales y que la referencia estructural es el
 * `summary.metrics` real de `summarizeSession` (sin recalcularlo en el panel).
 *
 * - Coste y latencia se muestran como contexto: no entran en la nota.
 * - Un dato ausente se pinta “no disponible”, nunca `0` ni `100`.
 * - Cuando la referencia difiere de los totales (la cabecera agrega sesiones
 *   que el mapa del panel no analiza), el informe lo explica con la nota de
 *   compactación sin ocultar los datos.
 */
import { render, screen, within } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type {
  TGraphModel,
  TNodeMetrics,
  TTokenUsage,
} from '@app/Domains/Graph/Graph.entity';
import { useGraphModel } from '@app/Domains/Graph/Hooks/useGraphModel';
import { summarizeSession } from '@app/Domains/Graph/lib/metrics/summarizeSession';
import type {
  TEfficiencyReport,
  TEfficiencySessionMeta,
} from '@app/Domains/Efficiency/Efficiency.entity';
import { analyzeSession } from '@app/Domains/Efficiency/lib/analyzeSession';
import { BAND_LABEL } from '@app/Domains/Efficiency/lib/labels';
import {
  buildAssistant,
  buildCompaction,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';
import {
  formatCost,
  formatDuration,
  formatTokens,
} from '@app/Application/Helpers';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { setupRadixUser } from '@app/test/radix';
import { EfficiencyOverlay } from '../../Components/EfficiencyOverlay';
import { EMPTY_RESOURCE_USAGE } from '../../WorkspacePage.constants';
import { buildEfficiencySessions } from '../../lib/buildEfficiencySessions';
import {
  INTEGRATION_CHILD_SESSION_ID,
  INTEGRATION_DIRECTORY,
  INTEGRATION_SESSION_ID,
  TESTID,
  buildGraphNode,
  buildSessionInfo,
  createIntegrationQueryClient,
  flushIdle,
  renderWorkspace,
  resetServiceMock,
  seedDevice,
  seedMessages,
  seedSessions,
  seedSubtree,
} from './harness';

vi.mock('@app/Infrastructure/Services/opencodeClient', async () => {
  const { serviceMock: mock } = await import('./harness');
  return { opencodeService: mock };
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

const ROOT = INTEGRATION_SESSION_ID;
const CHILD = INTEGRATION_CHILD_SESSION_ID;
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
const INTEGRATION_TIMEOUT_MS = 20_000;

/** Un tool de 61 s para que la latencia p95 y las lentas sean observables. */
const SLOW_TOOL_MS = 61_000;

const PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
];

interface ToolOptions {
  durationMs?: number;
}

const toolAt = (
  id: string,
  start: number,
  offset: number,
  { durationMs = 100 }: ToolOptions = {},
): SessionMessageAssistant['content'][number] => {
  const created = start + offset;
  return buildToolPart({
    id,
    name: 'read',
    input: { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created,
    completed: created + durationMs,
  });
};

const turnMessages = (index: number): TSessionMessage[] => {
  const start = BASE + index * TURN_MS;
  const slow = index === 1 ? SLOW_TOOL_MS : 100;
  return [
    buildUser({
      id: `user-${index}`,
      text: PROMPTS[index - 1],
      time: { created: start },
    }),
    buildAssistant({
      id: `assistant-${index}-a`,
      time: { created: start + 100, completed: start + 2_000 },
      content: [
        toolAt(`tool-${index}-a`, start, 200, { durationMs: slow }),
        toolAt(`tool-${index}-b`, start, 300),
      ],
    }),
    buildAssistant({
      id: `assistant-${index}-b`,
      time: { created: start + 2_100, completed: start + 3_000 },
      content: [toolAt(`tool-${index}-c`, start, 400)],
    }),
    buildIdle('succeeded', {
      id: `idle-${index}`,
      time: { created: start + 5_000 },
    }),
  ];
};

/** Cuatro turnos cerrados con coste, tokens y latencia reales. */
const scoredMessages = (): TSessionMessage[] =>
  [1, 2, 3, 4].flatMap(turnMessages);

/** Un turno sin coste, sin tokens y sin herramientas (ningún dato). */
const absentTotalsMessages = (): TSessionMessage[] => {
  const start = BASE;
  return [
    buildUser({
      id: 'user-sin-datos',
      text: PROMPTS[0],
      time: { created: start },
    }),
    buildAssistant({
      id: 'assistant-sin-datos',
      time: { created: start + 100, completed: start + 900 },
      cost: undefined,
      tokens: undefined,
      content: [],
    }),
    buildIdle('succeeded', {
      id: 'idle-sin-datos',
      time: { created: start + 5_000 },
    }),
  ];
};

/** Cuatro turnos limpios + una compactación completada dentro del turno 2. */
const messagesWithCompaction = (): TSessionMessage[] => {
  const base = scoredMessages();
  const compaction = buildCompaction('auto', {
    id: 'compaction-1',
    time: { created: BASE + 2 * TURN_MS + 2_000 },
  });
  const insertAt = base.findIndex(
    (message) => message.info.id === 'idle-2',
  );
  return [...base.slice(0, insertAt), compaction, ...base.slice(insertAt)];
};

const tokenUsage = (
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite: number,
): TTokenUsage => ({
  input,
  output,
  reasoning: 0,
  cacheRead,
  cacheWrite,
});

const metrics = (overrides: Partial<TNodeMetrics> = {}): TNodeMetrics => ({
  durationMs: 0,
  startedAt: 0,
  endedAt: 0,
  cost: null,
  tokens: null,
  invocations: 0,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
  ...overrides,
});

let latestModel: TGraphModel | null = null;

/** Sonda del modelo real de la página (mismo hook y mismo `QueryClient`). */
const GraphModelProbe = () => {
  const { graph } = useGraphModel(ROOT, INTEGRATION_DIRECTORY, {
    isLoading: false,
    isError: false,
  });

  useEffect(() => {
    latestModel = graph;
  });

  return null;
};

const mountProbe = (client: QueryClient): void => {
  render(
    <QueryClientProvider client={client}>
      <GraphModelProbe />
    </QueryClientProvider>,
  );
};

const openEfficiency = async (): Promise<HTMLElement> => {
  const user = setupRadixUser();
  await user.click(screen.getByRole('button', { name: 'Eficiencia' }));
  return screen.findByRole('dialog', { name: 'Eficiencia de la sesión' });
};

/** Cifra de una métrica de “Totales” por su etiqueta visible. */
const metric = (label: string): HTMLElement => {
  const section = screen.getByText('Totales').parentElement;
  if (section === null) throw new Error('Sección de totales ausente');
  const heading = within(section).getByText(label).parentElement;
  if (heading === null) throw new Error(`Métrica ${label} ausente`);
  return heading;
};

const expectedReport = (
  model: TGraphModel,
  messages: TSessionMessage[],
): TEfficiencyReport =>
  analyzeSession({
    rootSessionId: ROOT,
    messagesBySession: { [ROOT]: messages },
    sessions: buildEfficiencySessions(model),
  });

const expandHowCalculated = async (): Promise<void> => {
  const user = setupRadixUser();
  await user.click(screen.getByRole('button', { name: 'Cómo se calcula' }));
};

/** Quita el coste de los assistant sin tocar tokens ni herramientas. */
const withoutCosts = (messages: TSessionMessage[]): TSessionMessage[] =>
  messages.map(({ info, parts }) =>
    info.type === 'assistant' ? { info: { ...info, cost: undefined }, parts } : { info, parts },
  );

beforeEach(() => {
  latestModel = null;
  resetServiceMock();
});

describe('integración U1↔U3↔U7 — totales y referencia', () => {
  it('deriva los totales y usa `summary.metrics` real como referencia', async () => {
    const client = createIntegrationQueryClient();
    seedSessions(client, [buildSessionInfo()]);
    seedSubtree(client, [buildSessionInfo()]);
    seedMessages(client, { [ROOT]: scoredMessages() });
    seedDevice(client, false);

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    await openEfficiency();

    mountProbe(client);
    await vi.waitFor(() => expect(latestModel).not.toBeNull());
    const model = latestModel as TGraphModel;
    const report = expectedReport(model, scoredMessages());
    expect(report.status).toBe('ok');

    // Referencia real: el mismo agregado que consume la cabecera.
    const summary = summarizeSession(
      buildSessionInfo(),
      model,
      EMPTY_RESOURCE_USAGE,
      BASE,
    );
    expect(summary.metrics.cost).toBeCloseTo(report.totals.cost as number);
    expect(summary.metrics.tokens?.input).toBe(report.totals.tokensIn);
    expect(summary.metrics.tokens?.output).toBe(report.totals.tokensOut);
    expect(summary.metrics.tokens?.cacheRead).toBe(report.totals.cacheRead);
    expect(summary.metrics.tokens?.cacheWrite).toBe(report.totals.cacheWrite);

    // Totales visibles con los valores derivados del motor.
    expect(metric('Coste')).toHaveTextContent(
      formatCost(report.totals.cost),
    );
    expect(metric('Tokens in')).toHaveTextContent(
      formatTokens(report.totals.tokensIn),
    );
    expect(metric('Tokens out')).toHaveTextContent(
      formatTokens(report.totals.tokensOut),
    );
    expect(metric('Caché lectura')).toHaveTextContent(
      formatTokens(report.totals.cacheRead),
    );
    expect(metric('Caché escritura')).toHaveTextContent(
      formatTokens(report.totals.cacheWrite),
    );
    expect(metric('Ventana de contexto')).toHaveTextContent(
      formatTokens(report.totals.windowTokens),
    );
    expect(metric('Latencia p95')).toHaveTextContent(
      formatDuration(report.totals.latencyP95Ms),
    );
    expect(metric('Llamadas >60 s')).toHaveTextContent(
      String(report.totals.slowToolCalls),
    );

    // La referencia coincide: no se pinta el contraste de la cabecera.
    expect(
      screen.queryByText('La cabecera incluye compactación; el panel no.'),
    ).not.toBeInTheDocument();

    // Coste y latencia son contexto: quitarlos no cambia la nota.
    const withoutCost = analyzeSession({
      rootSessionId: ROOT,
      messagesBySession: { [ROOT]: withoutCosts(scoredMessages()) },
      sessions: buildEfficiencySessions(model),
    });
    expect(withoutCost.score).toBe(report.score);
    expect(withoutCost.band).toBe(report.band);

    const { score, band } = report;
    expect(
      screen.getByRole('img', {
        name: `${score} de 100, ${BAND_LABEL[band as keyof typeof BAND_LABEL]}`,
      }),
    ).toHaveTextContent(String(score));

    await expandHowCalculated();
    expect(
      screen.getByText('Coste y latencia se muestran; no puntúan.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Totales derivados de mensajes; no incluyen compactación.'),
    ).toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('sin tokens, coste ni latencia muestra “no disponible”, nunca 0/100', async () => {
    const client = createIntegrationQueryClient();
    seedSessions(client, [buildSessionInfo()]);
    seedSubtree(client, [buildSessionInfo()]);
    seedMessages(client, { [ROOT]: absentTotalsMessages() });
    seedDevice(client, false);

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    const dialog = await openEfficiency();

    mountProbe(client);
    await vi.waitFor(() => expect(latestModel).not.toBeNull());
    const report = expectedReport(
      latestModel as TGraphModel,
      absentTotalsMessages(),
    );
    expect(report.totals.cost).toBeNull();
    expect(report.totals.tokensIn).toBeNull();
    expect(report.totals.tokensOut).toBeNull();
    expect(report.totals.cacheRead).toBeNull();
    expect(report.totals.cacheWrite).toBeNull();
    expect(report.totals.windowTokens).toBeNull();
    expect(report.totals.latencyP95Ms).toBeNull();

    expect(within(dialog).getAllByLabelText('no disponible')).toHaveLength(7);
    for (const label of [
      'Coste',
      'Tokens in',
      'Tokens out',
      'Caché lectura',
      'Caché escritura',
      'Ventana de contexto',
      'Latencia p95',
    ]) {
      expect(metric(label)).toHaveTextContent('—');
    }

    // Los conteos reales sí pueden ser 0; los datos ausentes nunca 0/100.
    expect(metric('Compactaciones')).toHaveTextContent('0');
    expect(metric('Llamadas a herramientas')).toHaveTextContent('0');
    expect(within(dialog).queryByText('$0.00')).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('con una referencia distinta explica la diferencia por compactación', async () => {
    const client = createIntegrationQueryClient();
    const messages = messagesWithCompaction();
    seedMessages(client, { [ROOT]: messages });

    // Grafo con métricas ya calculadas (como las de la cabecera): la raíz y una
    // hija que el mapa del panel no analiza ⇒ los totales difieren.
    const graph: TGraphModel = {
      nodes: [
        buildGraphNode({
          sessionId: ROOT,
          metrics: metrics({
            cost: 2,
            tokens: tokenUsage(2_000, 500, 3_000, 5_000),
          }),
        }),
        buildGraphNode({
          id: CHILD,
          sessionId: CHILD,
          isRoot: false,
          metrics: metrics({
            cost: 1,
            tokens: tokenUsage(1_000, 200, 1_000, 2_000),
          }),
        }),
      ],
      edges: [{ id: 'edge-root-child', source: ROOT, target: CHILD, type: 'agent' }],
    };
    const summary = summarizeSession(
      buildSessionInfo(),
      graph,
      EMPTY_RESOURCE_USAGE,
      BASE,
    );
    expect(summary.metrics.cost).toBe(3);

    const sessions: Record<string, TEfficiencySessionMeta> = {
      [ROOT]: { status: 'idle' },
    };
    const report = analyzeSession({
      rootSessionId: ROOT,
      messagesBySession: { [ROOT]: messages },
      sessions,
    });

    renderWithProviders(
      <EfficiencyOverlay
        isOpen
        rootSessionId={ROOT}
        rootTitle="Sesión raíz"
        sessions={sessions}
        rootReady
        truncated={false}
        graphError={false}
        now={BASE + 100_000}
        reference={summary.metrics}
        onClose={() => undefined}
        onRestoreFocus={() => undefined}
      />,
      { queryClient: client },
    );

    expect(
      await screen.findByRole('dialog', { name: 'Eficiencia de la sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();
    expect(
      screen.getByText('La cabecera incluye compactación; el panel no.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cabecera: coste \$3\.00/)).toBeInTheDocument();
    expect(screen.getByText(/tokens in 3\.0k/)).toBeInTheDocument();
    expect(metric('Coste')).toHaveTextContent(
      formatCost(report.totals.cost),
    );

    await expandHowCalculated();
    expect(
      screen.getByText(
        'Los totales derivan de los pasos assistant; la compactación se muestra aparte.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'La compactación del turno 2 puede afectar a los turnos siguientes.',
      ),
    ).toBeInTheDocument();
  });
});
