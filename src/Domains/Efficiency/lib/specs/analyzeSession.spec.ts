import { describe, expect, it } from 'vitest';
import type { SessionInfo, SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TGraphModel, TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { EMPTY_METRICS } from '@app/Domains/Graph/Graph.entity';
import {
  deriveMetrics,
  summarizeSession,
} from '@app/Domains/Graph/lib/deriveMetrics';
import type { TResourceUsage } from '@app/Domains/Inspector/Inspector.entity';
import type {
  TEfficiencyInput,
  TEfficiencySessionMeta,
} from '../../Efficiency.entity';
import { analyzeSession } from '../analyzeSession';
import { compareFindings } from '../rules';
import { MAX_FINDINGS, MAX_WEAK_SIGNALS } from '../thresholds';
import {
  buildAssistant,
  buildCompaction,
  buildIdle,
  buildLongSession,
  buildToolPart,
  buildUser,
} from './fixtures';

/**
 * T017 (engine §4, §8–§10, feature 015): casos del informe completo.
 * Spec de lógica pura (entorno `node`): fixtures deterministas, sin reloj real.
 */

const BASE_TIME = 1_700_000_000_000;
const STEP_MS = 1_000;
const TURN_SPAN_MS = 10 * STEP_MS;
const NOW = BASE_TIME + 100 * STEP_MS;

const DEFAULT_TOKENS: SessionMessageAssistant['tokens'] = {
  input: 1_200,
  output: 320,
  reasoning: 40,
  cache: { read: 900, write: 120 },
};

const NO_CACHE_TOKENS: SessionMessageAssistant['tokens'] = {
  input: 1_200,
  output: 320,
  reasoning: 40,
  cache: { read: 0, write: 0 },
};

const PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
];

interface TurnOptions {
  outcome?: 'succeeded' | 'failed' | 'interrupted';
  assistants?: number;
  toolsPerAssistant?: number;
  toolStatus?: 'completed' | 'error';
  tokens?: SessionMessageAssistant['tokens'];
  close?: boolean;
  retry?: boolean;
}

/** Un turno de la raíz: `user` + N pasos assistant (con tools) + `idle` opcional. */
const turn = (index: number, options: TurnOptions = {}): TSessionMessage[] => {
  const {
    outcome = 'succeeded',
    assistants = 1,
    toolsPerAssistant = 3,
    toolStatus = 'completed',
    tokens = DEFAULT_TOKENS,
    close = true,
    retry = false,
  } = options;
  const start = BASE_TIME + index * TURN_SPAN_MS;
  const messages: TSessionMessage[] = [
    buildUser({
      id: `user-${index}`,
      time: { created: start },
      text: PROMPTS[(index - 1) % PROMPTS.length],
    }),
  ];

  for (let step = 0; step < assistants; step += 1) {
    const created = start + 100 + step * 300;
    const content = Array.from({ length: toolsPerAssistant }, (_, tool) =>
      buildToolPart({
        id: `tool-${index}-${step}-${tool}`,
        name: 'read',
        status: toolStatus,
        input: { filePath: `/repo/src/archivo-${index}-${step}-${tool}.ts` },
        created: created + tool,
        ran: created + 50 + tool,
        completed: created + 150 + tool,
      }),
    );
    messages.push(
      buildAssistant({
        id: `assistant-${index}-${step}`,
        time: { created, completed: created + 250 },
        content,
        cost: 0.01,
        tokens,
        ...(retry
          ? {
              retry: {
                attempt: 3,
                at: created,
                error: { type: 'api', message: 'límite temporal' },
              },
            }
          : {}),
      }),
    );
  }

  if (close) {
    messages.push(
      buildIdle(outcome, {
        id: `idle-${index}`,
        time: { created: start + 5 * STEP_MS },
      }),
    );
  }
  return messages;
};

const cleanMessages = (): TSessionMessage[] =>
  [1, 2, 3, 4].flatMap((index) => turn(index));

const input = (
  messagesBySession: Record<string, TSessionMessage[]>,
  sessions: Record<string, TEfficiencySessionMeta> = { root: {} },
): TEfficiencyInput => ({
  rootSessionId: 'root',
  messagesBySession,
  sessions,
  now: NOW,
});

describe('analyzeSession', () => {
  it('puntúa una sesión limpia con las dimensiones disponibles', () => {
    const report = analyzeSession(input({ root: cleanMessages() }));

    expect(report.status).toBe('ok');
    expect(report.score).toBe(100);
    expect(report.band).toBe('eficiente');
    expect(report.coverage).toBe(65.5);
    expect(report.confidence).toBe('baja');
    expect(report.dimensions).toHaveLength(4);
    expect(report.turns).toHaveLength(4);
    expect(report.findings).toEqual([]);
    expect(report.weakSignals).toEqual([]);
    expect(report.totals.toolCalls).toBe(12);
    expect(report.totals.compactions).toBe(0);
  });

  it('baja la nota cuando hay errores, reintentos e interrupciones', () => {
    const messages = [1, 2, 3, 4].flatMap((index) =>
      turn(index, {
        outcome: 'interrupted',
        assistants: 3,
        toolsPerAssistant: 1,
        toolStatus: 'error',
        retry: true,
      }),
    );

    const report = analyzeSession(input({ root: messages }));

    expect(report.status).toBe('ok');
    expect(report.score).not.toBeNull();
    expect(report.score).toBeLessThan(70);
    expect(report.band).toBe('friccion');
    expect(report.totals.toolErrors).toBe(12);
    expect(report.totals.retries).toBe(12);
    expect(report.findings.map((finding) => finding.ruleId)).toEqual([
      'RES-2',
      'RES-1',
      'INP-2',
    ]);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.weakSignals.map((finding) => finding.ruleId)).toEqual([
      'RES-5',
    ]);
    expect(report.findings.every((finding) => finding.penalizes)).toBe(true);
    expect(report.weakSignals.every((finding) => !finding.penalizes)).toBe(
      true,
    );
    expect(
      [...report.findings, ...report.weakSignals].every(
        (finding) => (finding.evidence.messageId ?? '').length > 0,
      ),
    ).toBe(true);
    expect(report.findings).toEqual([...report.findings].sort(compareFindings));
    expect(report.weakSignals).toEqual(
      [...report.weakSignals].sort(compareFindings),
    );
  });

  it('puebla el turno con la señal de los hallazgos de su ventana', () => {
    const messages = [1, 2, 3, 4].flatMap((index) =>
      turn(index, { toolStatus: 'error' }),
    );

    const report = analyzeSession(input({ root: messages }));
    const res1 = report.findings.find((finding) => finding.ruleId === 'RES-1');
    const turnIndex = res1?.evidence.turnIndex;

    expect(res1).toBeDefined();
    expect(turnIndex).toBeDefined();
    expect(
      report.turns.find((item) => item.index === turnIndex)?.signals,
    ).toContain('RES-1');
  });

  it('respeta el cap de hallazgos y de señales débiles', () => {
    const report = analyzeSession(input({ root: buildLongSession(200) }));

    expect(report.findings.length).toBeLessThanOrEqual(MAX_FINDINGS);
    expect(report.weakSignals.length).toBeLessThanOrEqual(MAX_WEAK_SIGNALS);
    expect(report.findings.every((finding) => finding.penalizes)).toBe(true);
    expect(report.weakSignals.every((finding) => !finding.penalizes)).toBe(
      true,
    );
  });

  it('omite un candidato sin ancla (messageId vacío)', () => {
    const messages: TSessionMessage[] = [
      buildUser({
        id: 'user-1',
        time: { created: BASE_TIME },
        text: PROMPTS[0],
      }),
      buildAssistant({
        id: '',
        time: { created: BASE_TIME + 100, completed: BASE_TIME + 400 },
        content: [
          buildToolPart({
            id: 'tool-sin-ancla',
            status: 'error',
            created: BASE_TIME + 150,
            ran: BASE_TIME + 200,
            completed: BASE_TIME + 300,
          }),
        ],
      }),
      buildIdle('failed', {
        id: 'idle-sin-ancla',
        time: { created: BASE_TIME + 500 },
      }),
    ];

    const report = analyzeSession(input({ root: messages }));

    expect(report.findings.map((finding) => finding.ruleId)).not.toContain(
      'RES-1',
    );
    expect(
      report.findings.every(
        (finding) => (finding.evidence.messageId ?? '').length > 0,
      ),
    ).toBe(true);
  });

  it('es determinista con hallazgos y señales', () => {
    const messages = () =>
      [1, 2, 3, 4].flatMap((index) =>
        turn(index, {
          outcome: 'interrupted',
          assistants: 2,
          toolsPerAssistant: 1,
          toolStatus: 'error',
          retry: true,
        }),
      );

    const first = analyzeSession(input({ root: messages() }));
    const second = analyzeSession(input({ root: messages() }));

    expect(first.findings.length).toBeGreaterThan(0);
    expect(first.weakSignals.length).toBeGreaterThan(0);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('no puntúa una sesión en curso y conserva las métricas crudas', () => {
    const report = analyzeSession(
      input({ root: cleanMessages() }, { root: { status: 'active' } }),
    );

    expect(report.status).toBe('in_progress');
    expect(report.score).toBeNull();
    expect(report.band).toBeNull();
    expect(report.dimensions).toHaveLength(4);
    expect(report.turns).toHaveLength(4);
    expect(report.coverage).toBe(65.5);
    expect(report.totals.toolCalls).toBe(12);
  });

  it('marca muestra insuficiente con menos de dos turnos cerrados', () => {
    const report = analyzeSession(input({ root: turn(1) }));

    expect(report.status).toBe('insufficient');
    expect(report.score).toBeNull();
    expect(report.band).toBeNull();
    expect(report.turns).toHaveLength(1);
    expect(report.coverage).toBe(35.5);
  });

  it('marca muestra insuficiente cuando la cobertura baja de 60', () => {
    const messages = [1, 2].flatMap((index) => turn(index));
    const report = analyzeSession(input({ root: messages }));

    expect(report.status).toBe('insufficient');
    expect(report.coverage).toBe(35.5);
    expect(report.score).toBeNull();
  });

  it('devuelve no_data sin mensajes y cuando la raíz no está en sessions', () => {
    const empty = analyzeSession(input({ root: [] }));
    expect(empty.status).toBe('no_data');
    expect(empty.score).toBeNull();
    expect(empty.band).toBeNull();
    expect(empty.confidence).toBeNull();
    expect(empty.coverage).toBe(0);
    expect(empty.dimensions).toEqual([]);
    expect(empty.turns).toEqual([]);
    expect(empty.notes).toEqual([]);
    expect(empty.totals.cost).toBeNull();
    expect(empty.totals.toolCalls).toBe(0);

    const unknownRoot = analyzeSession(
      input({ root: cleanMessages() }, { otra: {} }),
    );
    expect(unknownRoot.status).toBe('no_data');
  });

  it('declara el subárbol parcial y fuerza confianza baja', () => {
    const report = analyzeSession(
      input(
        { root: cleanMessages() },
        { root: {}, child: { parentID: 'root' } },
      ),
    );

    expect(report.status).toBe('ok');
    expect(report.confidence).toBe('baja');
    expect(report.notes[0]).toBe(
      'Subárbol parcial: 1 sesiones sin mensajes cargados; el análisis puede estar incompleto.',
    );
    expect(report.coverage).toBe(65.5);
  });

  it('fuerza confianza baja con el grafo truncado sin sesiones ausentes', () => {
    const messages = [1, 2, 3, 4, 5, 6, 7].flatMap((index) =>
      turn(index, { assistants: 3, toolsPerAssistant: 1 }),
    );

    const complete = analyzeSession(input({ root: messages }));

    expect(complete.status).toBe('ok');
    expect(complete.coverage).toBe(100);
    expect(complete.confidence).toBe('alta');
    expect(complete.notes).toEqual([]);

    const truncated = analyzeSession({
      ...input({ root: messages }),
      truncated: true,
    });

    expect(truncated.status).toBe('ok');
    expect(truncated.coverage).toBe(100);
    expect(truncated.confidence).toBe('baja');
    expect(truncated.notes).toEqual([]);
  });

  it('ordena las notas según data-model §7', () => {
    const start = BASE_TIME;
    const messages: TSessionMessage[] = [
      buildUser({ id: 'user-1', time: { created: start } }),
      buildAssistant({
        id: 'assistant-1',
        time: { created: start + STEP_MS, completed: start + 2 * STEP_MS },
        tokens: undefined,
      }),
      buildCompaction('auto', {
        id: 'compaction-1',
        time: { created: start + 2 * STEP_MS },
      }),
      buildUser({
        id: 'user-2',
        time: { created: start + 10 * STEP_MS },
      }),
      buildAssistant({
        id: 'assistant-2',
        time: {
          created: start + 11 * STEP_MS,
          completed: start + 12 * STEP_MS,
        },
        tokens: undefined,
      }),
    ];

    const report = analyzeSession(
      input({ root: messages }, { root: {}, child: { parentID: 'root' } }),
    );

    expect(report.notes).toEqual([
      'Subárbol parcial: 1 sesiones sin mensajes cargados; el análisis puede estar incompleto.',
      'Tokens no disponibles: la ventana de contexto y la caché se omiten.',
      'La compactación del turno 1 puede afectar a los turnos siguientes.',
      'El turno abierto no entra en los denominadores.',
      'No hay un cierre (idle) para la sesión; el resultado se omite.',
      'Los totales derivan de los pasos assistant; la compactación se muestra aparte.',
    ]);
  });

  it('anota la caché no reportada cuando hay tokens', () => {
    const messages = [1, 2, 3, 4].flatMap((index) =>
      turn(index, { tokens: NO_CACHE_TOKENS }),
    );

    const report = analyzeSession(input({ root: messages }));

    expect(report.notes).toEqual([
      'La caché no está reportada por el proveedor; Contexto se calcula solo con compactaciones.',
    ]);
  });

  it('es determinista con la misma entrada', () => {
    const first = analyzeSession(input({ root: cleanMessages() }));
    const second = analyzeSession(input({ root: cleanMessages() }));

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('analiza 200 mensajes en menos de 1 s', () => {
    const messages = buildLongSession(200);
    const startedAt = performance.now();
    const report = analyzeSession(input({ root: messages }));
    const elapsedMs = performance.now() - startedAt;

    expect(report.status).not.toBe('no_data');
    expect(elapsedMs).toBeLessThan(1_000);
  });

  it('coincide con summarizeSession en una sesión de un nodo', () => {
    const messages = cleanMessages();
    const report = analyzeSession(input({ root: messages }));

    const metrics = deriveMetrics({ messages, now: NOW });
    const node: TGraphNode = {
      id: 'root',
      type: 'agent',
      position: { x: 0, y: 0 },
      data: {
        sessionId: 'root',
        title: null,
        createdAt: null,
        updatedAt: null,
        agentName: 'develop',
        directory: '/repo',
        model: null,
        status: 'succeeded',
        retry: null,
        interruptReason: null,
        metrics: { ...EMPTY_METRICS, ...metrics },
        isRoot: true,
        currentTool: null,
        parallel: null,
      },
    };
    const graph: TGraphModel = { nodes: [node], edges: [] };
    const root: SessionInfo = {
      id: 'root',
      projectID: 'project',
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      time: { created: BASE_TIME, updated: NOW },
      location: { directory: '/repo' },
      title: 'Root',
    };
    const resources: TResourceUsage = {
      mcpServers: [],
      instructions: [],
      skills: [],
      tools: [],
      availability: 'available',
    };

    const summary = summarizeSession(root, graph, resources, NOW);

    expect(report.totals.cost).toBe(summary.metrics.cost);
    expect(report.totals.tokensIn).toBe(summary.metrics.tokens?.input ?? null);
    expect(report.totals.tokensOut).toBe(
      summary.metrics.tokens?.output ?? null,
    );
    expect(report.totals.cacheRead).toBe(
      summary.metrics.tokens?.cacheRead ?? null,
    );
    expect(report.totals.cacheWrite).toBe(
      summary.metrics.tokens?.cacheWrite ?? null,
    );
  });
});
