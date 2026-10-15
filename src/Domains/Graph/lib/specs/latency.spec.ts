import { describe, expect, it } from 'vitest';
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type { TLatencySample, TModelPace } from '../../Graph.entity';
import {
  MIN_EXCESS_MS,
  MIN_EXPECTED_MS,
  deriveLatency,
  detectAnomalies,
  expectedGenerationMs,
} from '../metrics/latency';

const MODEL = 'p/m';

type TToolTime = Extract<TContentPart, { type: 'tool' }>['time'];

const tool = (name: string, time: TToolTime): TContentPart => ({
  type: 'tool',
  id: `call_${name}_${time.created}`,
  name,
  state: { status: 'completed', input: {}, content: [{ type: 'text', text: 'ok' }] },
  time,
});

const reasoning = (created: number): TContentPart => ({
  type: 'reasoning',
  text: '…',
  time: { created, completed: created + 10 },
});

const assistant = (
  id: string,
  time: { created: number; streamed?: number; completed?: number },
  options: { content?: TContentPart[]; output?: number; reasoning?: number } = {},
): TSessionMessage => {
  const content = options.content ?? [];
  return {
    info: {
      id,
      type: 'assistant',
      agent: 'develop',
      model: { id: 'm', providerID: 'p' },
      time,
      content,
      ...(options.output === undefined
        ? {}
        : {
            tokens: {
              input: 1000,
              output: options.output,
              reasoning: options.reasoning ?? 0,
              cache: { read: 0, write: 0 },
            },
          }),
    },
    parts: content,
  };
};

const pace = (overrides: Partial<TModelPace> = {}): TModelPace => ({
  model: MODEL,
  baseMs: 1000,
  msPerToken: 10,
  samples: 20,
  ...overrides,
});

const sample = (overrides: Partial<TLatencySample> = {}): TLatencySample => ({
  stepId: 's',
  startedAt: 0,
  model: MODEL,
  firstOutputMs: null,
  generationMs: 1000,
  totalMs: 1000,
  toolMs: 0,
  subagentMs: 0,
  humanMs: 0,
  topTool: null,
  outputTokens: 100,
  expectedMs: 1000,
  ...overrides,
});

describe('deriveLatency · muestras', () => {
  it('deriva generación y total desde time, ordena por inicio y descarta las incompletas', () => {
    const report = deriveLatency([
      assistant('b', { created: 2000, streamed: 2100, completed: 2600 }),
      assistant('a', { created: 1000, streamed: 1100, completed: 1900 }),
      assistant('sin-fin', { created: 3000 }),
    ]);

    expect(report.samples.map((s) => s.stepId)).toEqual(['a', 'b']);
    expect(report.samples[0]).toMatchObject({
      startedAt: 1000,
      model: MODEL,
      generationMs: 100,
      totalMs: 900,
    });
  });

  it('deja la generación en null sin time.streamed', () => {
    const [s] = deriveLatency([assistant('a', { created: 0, completed: 500 })]).samples;

    expect(s.generationMs).toBeNull();
    expect(s.totalMs).toBe(500);
  });

  it('cuenta como tokens generados la salida más el razonamiento', () => {
    const [s] = deriveLatency([
      assistant('a', { created: 0, streamed: 10, completed: 20 }, { output: 300, reasoning: 200 }),
    ]).samples;

    expect(s.outputTokens).toBe(500);
  });

  it('sin tokens reportados, outputTokens es null (nunca 0 inventado)', () => {
    const [s] = deriveLatency([assistant('a', { created: 0, streamed: 10, completed: 20 })]).samples;

    expect(s.outputTokens).toBeNull();
  });
});

describe('deriveLatency · desglose por respuesta', () => {
  it('la primera salida es el inicio más temprano de razonamiento o herramienta', () => {
    const [s] = deriveLatency([
      assistant(
        'a',
        { created: 1000, streamed: 5000, completed: 5100 },
        { content: [tool('read', { created: 2500, ran: 5000, completed: 5010 }), reasoning(1800)] },
      ),
    ]).samples;

    expect(s.firstOutputMs).toBe(800);
  });

  it('sin razonamiento ni herramientas con hora, la primera salida es null', () => {
    const [s] = deriveLatency([assistant('a', { created: 0, streamed: 10, completed: 20 })]).samples;

    expect(s.firstOutputMs).toBeNull();
  });

  it('separa herramientas, subagentes y espera humana; mide desde ran', () => {
    const [s] = deriveLatency([
      assistant(
        'a',
        { created: 0, streamed: 1000, completed: 100_000 },
        {
          content: [
            tool('shell', { created: 200, ran: 1000, completed: 31_000 }),
            tool('read', { created: 300, ran: 1000, completed: 1010 }),
            tool('subagent', { created: 400, ran: 1000, completed: 61_000 }),
            tool('question', { created: 500, ran: 1000, completed: 91_000 }),
          ],
        },
      ),
    ]).samples;

    expect(s.toolMs).toBe(30_000);
    expect(s.subagentMs).toBe(60_000);
    expect(s.humanMs).toBe(90_000);
    expect(s.topTool).toBe('shell');
  });

  it('no suma dos veces las herramientas que corren en paralelo', () => {
    const [s] = deriveLatency([
      assistant(
        'a',
        { created: 0, streamed: 1000, completed: 20_000 },
        {
          content: [
            tool('subagent', { created: 0, ran: 1000, completed: 11_000 }),
            tool('task', { created: 0, ran: 6000, completed: 16_000 }),
          ],
        },
      ),
    ]).samples;

    expect(s.subagentMs).toBe(15_000);
  });

  it('sin time.ran usa time.created, y omite las herramientas sin fin', () => {
    const [s] = deriveLatency([
      assistant(
        'a',
        { created: 0, streamed: 100, completed: 5000 },
        {
          content: [
            tool('shell', { created: 1000, completed: 3000 }),
            tool('edit', { created: 1000, ran: 1500 }),
          ],
        },
      ),
    ]).samples;

    expect(s.toolMs).toBe(2000);
    expect(s.topTool).toBe('shell');
  });
});

describe('expectedGenerationMs', () => {
  it('es base + ritmo × tokens, con un piso para respuestas mínimas', () => {
    expect(expectedGenerationMs(pace(), 400)).toBe(5000);
    expect(expectedGenerationMs(pace({ baseMs: 0, msPerToken: 0 }), 1)).toBe(MIN_EXPECTED_MS);
  });
});

describe('deriveLatency · esperado por modelo', () => {
  it('asigna a cada muestra lo esperado para su modelo y sus tokens', () => {
    const report = deriveLatency(
      [assistant('a', { created: 0, streamed: 6000, completed: 6100 }, { output: 400 })],
      { paces: { [MODEL]: pace() } },
    );

    expect(report.samples[0].expectedMs).toBe(5000);
    expect(report.paces).toEqual([pace()]);
  });

  it('sin ritmo del modelo, o sin tokens, no hay esperado ni anomalía', () => {
    const report = deriveLatency(
      [
        assistant('a', { created: 0, streamed: 60_000, completed: 60_100 }, { output: 400 }),
        assistant('b', { created: 0, streamed: 60_000, completed: 60_100 }),
      ],
      { paces: {} },
    );

    expect(report.samples.map((s) => s.expectedMs)).toEqual([null, null]);
    expect(report.paces).toEqual([]);
    expect(report.anomalies).toEqual([]);
  });
});

describe('detectAnomalies', () => {
  it('marca lenta la generación que supera el umbral y el exceso mínimo', () => {
    const anomalies = detectAnomalies(
      [sample({ stepId: 'lenta', generationMs: 12_000, expectedMs: 5000 })],
      1,
    );

    expect(anomalies).toEqual([
      { stepId: 'lenta', ratio: 2.4, expectedMs: 5000, excessMs: 7000 },
    ]);
  });

  it('no marca una respuesta corta aunque duplique lo esperado: el exceso no llega al mínimo', () => {
    const anomalies = detectAnomalies(
      [sample({ generationMs: 3000, expectedMs: 1000 })],
      1,
    );

    expect(MIN_EXCESS_MS).toBe(5000);
    expect(anomalies).toEqual([]);
  });

  it('no marca una respuesta larga que tarda lo que corresponde a sus tokens', () => {
    expect(
      detectAnomalies([sample({ generationMs: 60_000, expectedMs: 50_000 })], 1),
    ).toEqual([]);
  });

  it('no marca por rapidez: una respuesta rápida no es una anomalía', () => {
    expect(
      detectAnomalies([sample({ generationMs: 100, expectedMs: 20_000 })], 1),
    ).toEqual([]);
  });

  it('las esperas de herramientas, subagentes o del usuario no cuentan como lentitud', () => {
    expect(
      detectAnomalies(
        [
          sample({
            generationMs: 5000,
            expectedMs: 5000,
            totalMs: 3_600_000,
            humanMs: 3_000_000,
            subagentMs: 500_000,
            toolMs: 95_000,
          }),
        ],
        1,
      ),
    ).toEqual([]);
  });

  it('un umbral más bajo marca desviaciones más chicas', () => {
    const samples = [sample({ generationMs: 16_000, expectedMs: 10_000 })];

    expect(detectAnomalies(samples, 1)).toEqual([]);
    expect(detectAnomalies(samples, 0.5)).toHaveLength(1);
  });
});
