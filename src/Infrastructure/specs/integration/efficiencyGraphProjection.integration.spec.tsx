/**
 * U38 (T059) — E2E de la frontera U4↔U1: **data-model §1.2/§5.2/§5.3 + engine §4**.
 *
 * Monta `WorkspacePage` con el arnés (modelo y hooks reales) y lee la
 * **proyección real** del grafo (`buildEfficiencySessions`) para alimentar el
 * motor real (`analyzeSession`). Así se ejerce la cadena completa:
 *
 *   grafo (aristas + estado de nodo) → sesiones del motor → estado/parcialidad
 *
 * Casos:
 * - Un hijo activo se proyecta `active` y el informe queda `in_progress`/sin nota.
 * - Un hijo sin mensajes en caché ⇒ `isPartial`, `missingSessionIds` (banner) y
 *   confianza baja, sin inventar ceros para ese nodo.
 * - Una sesión presente en `messagesBySession` pero fuera de `sessions` se
 *   analiza igual (sus pasos/tokens cuentan) sin crear una sesión ficticia.
 *
 * Negativos: raíz inexistente ⇒ `no_data` sin informe inventado; una arista
 * hacia un nodo ausente no crea sesión.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionMessageAssistant, SessionStatus } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type {
  TGraphModel,
  TNodeMetrics,
} from '@app/Domains/Graph/Graph.entity';
import { useGraphModel } from '@app/Domains/Graph/Hooks/useGraphModel';
import { analyzeSession } from '@app/Domains/Efficiency/lib/analyzeSession';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';
import { setupRadixUser } from '@app/test/radix';
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
  serviceMock,
  seedDevice,
  seedMessages,
  seedSessions,
  seedSubtree,
} from './harness';

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

const ROOT = INTEGRATION_SESSION_ID;
const CHILD = INTEGRATION_CHILD_SESSION_ID;
const ORPHAN = 'ses_orphan';
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
const INTEGRATION_TIMEOUT_MS = 20_000;

/** Cuatro pedidos distintos: pares elegibles sin reformulación (INP-1). */
const PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
];

const toolAt = (
  id: string,
  start: number,
  offset: number,
): SessionMessageAssistant['content'][number] => {
  const created = start + offset;
  return buildToolPart({
    id,
    name: 'read',
    input: { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created,
    completed: created + 100,
  });
};

/** Turno cerrado con dos pasos y tres herramientas (muestra suficiente). */
const turnMessages = (index: number): TSessionMessage[] => {
  const start = BASE + index * TURN_MS;
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
        toolAt(`tool-${index}-a`, start, 200),
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

/** Raíz con cuatro turnos cerrados: informe puntuable (`ok`). */
const rootMessages = (): TSessionMessage[] =>
  [1, 2, 3, 4].flatMap(turnMessages);

/** Hija con actividad: sus pasos/herramientas entran en totales y turnos. */
const childMessages = (): TSessionMessage[] => [
  buildAssistant({
    id: 'child-assistant',
    time: { created: BASE + 100, completed: BASE + 900 },
    content: [toolAt('child-tool', BASE, 200)],
  }),
];

/** Sesión fuera del mapa: un assistant con tokens/coste y una herramienta. */
const orphanMessages = (): TSessionMessage[] => [
  buildAssistant({
    id: 'orphan-assistant',
    cost: 0.5,
    tokens: {
      input: 100,
      output: 20,
      reasoning: 0,
      cache: { read: 10, write: 5 },
    },
    time: { created: BASE + 100, completed: BASE + 900 },
    content: [toolAt('orphan-tool', BASE, 200)],
  }),
];

const BUSY: SessionStatus = { type: 'busy' };

interface TGraphProbeState {
  model: TGraphModel | null;
}

let probe: TGraphProbeState = { model: null };

/** Sonda del modelo real de la página (mismo hook y mismo `QueryClient`). */
const GraphModelProbe = () => {
  const { graph } = useGraphModel(ROOT, INTEGRATION_DIRECTORY, {
    isLoading: false,
    isError: false,
  });

  useEffect(() => {
    probe.model = graph;
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

const waitForModel = async (): Promise<TGraphModel> => {
  await waitFor(() => expect(probe.model).not.toBeNull());
  return probe.model as TGraphModel;
};

const openEfficiency = async (): Promise<HTMLElement> => {
  const user = setupRadixUser();
  await user.click(screen.getByRole('button', { name: 'Eficiencia' }));
  return screen.findByRole('dialog', { name: 'Eficiencia de la sesión' });
};

const enrichmentOf = (nodeId: string): string | null => {
  const marker = screen.getByTestId(TESTID.agentGraph);
  const nodes = JSON.parse(marker.getAttribute('data-nodes') ?? '[]') as Array<{
    id: string;
    enrichment: string | null;
  }>;
  return nodes.find((node) => node.id === nodeId)?.enrichment ?? null;
};

const reportFor = (
  model: TGraphModel,
  messagesBySession: Record<string, TSessionMessage[]>,
) =>
  analyzeSession({
    rootSessionId: ROOT,
    messagesBySession,
    sessions: buildEfficiencySessions(model),
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

beforeEach(() => {
  probe = { model: null };
  resetServiceMock();
});

describe('integración U4↔U1 — proyección del grafo al informe', () => {
  it('convierte un hijo activo en sesión `active` y deja el informe en curso', async () => {
    const client = createIntegrationQueryClient();
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: CHILD,
      parentID: ROOT,
      agent: 'explore',
    });
    seedSessions(client, [root], { status: { [CHILD]: BUSY } });
    seedSubtree(client, [root, child]);
    seedMessages(client, {
      [ROOT]: rootMessages(),
      [CHILD]: childMessages(),
    });
    seedDevice(client, false);

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);

    mountProbe(client);
    const model = await waitForModel();
    const sessions = buildEfficiencySessions(model);

    expect(sessions[ROOT]).toEqual({ status: 'idle' });
    expect(sessions[CHILD]).toEqual({ parentID: ROOT, status: 'active' });

    const report = reportFor(model, {
      [ROOT]: rootMessages(),
      [CHILD]: childMessages(),
    });
    expect(report.status).toBe('in_progress');
    expect(report.score).toBeNull();
    expect(report.band).toBeNull();
    expect(report.turns).toHaveLength(4);

    const dialog = await openEfficiency();
    expect(
      screen.getByText('Sesión en curso: sin nota'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Datos disponibles')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar análisis de eficiencia' }),
    ).toBeVisible();
    expect(dialog).toBeInTheDocument();
  }, INTEGRATION_TIMEOUT_MS);

  it('declara parcial el hijo sin mensajes, con confianza baja y banner', async () => {
    const client = createIntegrationQueryClient();
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: CHILD,
      parentID: ROOT,
      agent: 'explore',
    });
    seedSessions(client, [root]);
    seedSubtree(client, [root, child]);
    seedMessages(client, { [ROOT]: rootMessages() });
    seedDevice(client, false);
    // La hija no tiene mensajes: el intento de carga falla y la caché no se
    // rellena, así que la ausencia se declara en lugar de inventar `[]`.
    serviceMock.getSessionMessages.mockRejectedValue(new Error('sin datos'));

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);
    expect(enrichmentOf(CHILD)).not.toBe('ready');

    const user = setupRadixUser();
    await user.click(screen.getByRole('button', { name: 'Eficiencia' }));
    await screen.findByRole('dialog', { name: 'Eficiencia de la sesión' });

    expect(
      screen.getByText('Análisis parcial: 1 sesiones sin datos'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /de 100/ })).toBeInTheDocument();

    mountProbe(client);
    const model = await waitForModel();
    const report = reportFor(model, { [ROOT]: rootMessages() });

    expect(report.status).toBe('ok');
    expect(report.confidence).toBe('baja');
    expect(report.notes).toContain(
      'Subárbol parcial: 1 sesiones sin mensajes cargados; el análisis puede estar incompleto.',
    );
    // Sin mensajes de la hija no se inventan sus ceros: solo cuentan las 12
    // herramientas de la raíz, no las 13 del subárbol completo.
    expect(report.totals.toolCalls).toBe(12);
  }, INTEGRATION_TIMEOUT_MS);

  it('analiza una sesión fuera de `sessions` sin crear la sesión ni inventar ceros', async () => {
    const client = createIntegrationQueryClient();
    const root = buildSessionInfo();
    const child = buildSessionInfo({
      id: CHILD,
      parentID: ROOT,
      agent: 'explore',
    });
    seedSessions(client, [root]);
    seedSubtree(client, [root, child]);
    seedMessages(client, {
      [ROOT]: rootMessages(),
      [CHILD]: childMessages(),
    });
    seedDevice(client, false);

    await renderWorkspace(client);
    await flushIdle();
    await screen.findByTestId(TESTID.agentGraph);

    mountProbe(client);
    const model = await waitForModel();
    const sessions = buildEfficiencySessions(model);

    expect(sessions[ORPHAN]).toBeUndefined();

    const outside = reportFor(model, {
      [ROOT]: rootMessages(),
      [CHILD]: childMessages(),
      [ORPHAN]: orphanMessages(),
    });
    const inside = analyzeSession({
      rootSessionId: ROOT,
      messagesBySession: {
        [ROOT]: rootMessages(),
        [CHILD]: childMessages(),
        [ORPHAN]: orphanMessages(),
      },
      sessions: { ...sessions, [ORPHAN]: { status: 'idle' } },
    });

    // La sesión fuera del mapa entra en el análisis con sus datos reales (no
    // aparecen ceros): sus totales son idénticos a los de incluida en el mapa.
    expect(outside.totals).toEqual(inside.totals);
    expect(outside.totals.cost).toBeGreaterThan(0);
    expect(outside.totals.toolCalls).toBe(14);
    expect(outside.totals.tokensIn).toBe(9 * 1_200 + 100);
  });

  it('con una raíz inexistente devuelve `no_data` sin informe inventado', () => {
    const sessions = {
      [ROOT]: { status: 'idle' as const },
    };

    const report = analyzeSession({
      rootSessionId: 'ses_inexistente',
      messagesBySession: { [ROOT]: rootMessages() },
      sessions,
    });

    expect(report.status).toBe('no_data');
    expect(report.score).toBeNull();
    expect(report.band).toBeNull();
    expect(report.confidence).toBeNull();
    expect(report.dimensions).toEqual([]);
    expect(report.findings).toEqual([]);
    expect(report.weakSignals).toEqual([]);
    expect(report.turns).toEqual([]);
    expect(report.totals.cost).toBeNull();
    expect(report.notes).toEqual([]);
  });

  it('una arista hacia un nodo ausente no crea una sesión fantasma', () => {
    const graph: TGraphModel = {
      nodes: [
        buildGraphNode({
          sessionId: ROOT,
          metrics: metrics(),
        }),
      ],
      edges: [
        {
          id: 'edge-root-ghost',
          source: ROOT,
          target: 'ses_ghost',
          type: 'agent',
        },
      ],
    };

    const sessions = buildEfficiencySessions(graph);

    expect(Object.keys(sessions)).toEqual([ROOT]);
    expect(sessions.ses_ghost).toBeUndefined();
    expect(sessions[ROOT]).toEqual({ status: 'idle' });
    // La arista saliente no convierte a la raíz en hija de nadie.
    expect(sessions[ROOT].parentID).toBeUndefined();
  });
});
