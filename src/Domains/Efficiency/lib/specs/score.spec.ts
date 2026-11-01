import { describe, expect, it } from 'vitest';
import type { TDimensionKey, TDimensionResult } from '../../Efficiency.entity';
import type {
  TAssistantFact,
  TCompactionFact,
  TFacts,
  TInterruptionFact,
  TQuestionFact,
  TTokenStep,
  TToolFact,
} from '../turns';
import {
  bandFor,
  buildScore,
  computeCoverage,
  globalScore,
} from '../score';

/**
 * T013 (engine §4.4–§4.7 y §5, feature 015): casos límite de la puntuación.
 * Spec de lógica pura (entorno `node`, sin DOM): construye `TFacts` a mano para
 * aislar cada indicador, dimensión, cobertura y confianza.
 */

// ---------------------------------------------------------------------------
// Builders de hechos
// ---------------------------------------------------------------------------

const assistant = (index: number): TAssistantFact => ({
  sessionId: 'root',
  messageId: `assistant-${index}`,
  at: index,
  cost: null,
  tokens: null,
  hasError: false,
  toolCalls: 0,
  toolErrors: 0,
  retry: null,
  turnIndex: null,
});

const tool = (
  index: number,
  status: TToolFact['status'] = 'completed',
): TToolFact => ({
  sessionId: 'root',
  messageId: `assistant-${index}`,
  toolId: `tool-${index}`,
  name: 'read',
  status,
  at: index,
  startedAt: index,
  completedAt: index + 1,
  durationMs: 1,
  signature: `read\u0000${index}`,
  output: '',
  filePath: null,
  isWrite: false,
  isQuestion: false,
  turnIndex: null,
});

const tokenStep = (
  index: number,
  overrides: Partial<TTokenStep> = {},
): TTokenStep => ({
  messageId: `assistant-${index}`,
  at: index,
  input: 400,
  output: 20,
  cacheRead: 600,
  cacheWrite: 0,
  ...overrides,
});

const compaction = (
  index: number,
  overrides: Partial<TCompactionFact> = {},
): TCompactionFact => ({
  sessionId: 'root',
  messageId: `compaction-${index}`,
  at: index,
  reason: 'auto',
  turnIndex: null,
  ...overrides,
});

const interruption = (turnIndex: number): TInterruptionFact => ({
  sessionId: 'root',
  messageId: `user-interrupt-${turnIndex}`,
  at: turnIndex,
  kind: 'user',
  turnIndex,
});

const question = (index: number, repeated = false): TQuestionFact => ({
  sessionId: 'root',
  messageId: `question-${index}`,
  toolId: `tool-question-${index}`,
  at: index,
  text: `¿Confirmas el paso ${index} del plan?`,
  repeated,
  turnIndex: index,
});

const facts = (overrides: Partial<TFacts> = {}): TFacts => ({
  users: [],
  assistants: [],
  tools: [],
  idles: [],
  compactions: [],
  turns: [],
  closedTurns: 0,
  outcome: null,
  openErrors: false,
  toolErrors: 0,
  retries: [],
  redundantCalls: [],
  reformulationPairs: [],
  eligiblePairs: 0,
  interruptions: [],
  questionCalls: [],
  repeatedQuestions: [],
  firstWrite: null,
  filesTouched: 0,
  toolDurationsMs: [],
  rootTokenSteps: [],
  windowTokens: null,
  missingSessionIds: [],
  ...overrides,
});

const steps = (count: number): TAssistantFact[] =>
  Array.from({ length: count }, (_, index) => assistant(index));

const calls = (count: number): TToolFact[] =>
  Array.from({ length: count }, (_, index) => tool(index));

const cacheSteps = (count: number): TTokenStep[] =>
  Array.from({ length: count }, (_, index) => tokenStep(index));

/** Hechos sin fricción y con todas las dimensiones disponibles. */
const cleanFacts = (overrides: Partial<TFacts> = {}): TFacts =>
  facts({
    assistants: steps(10),
    tools: calls(20),
    closedTurns: 6,
    eligiblePairs: 6,
    outcome: 'succeeded',
    rootTokenSteps: cacheSteps(10),
    ...overrides,
  });

const dimensionOf = (
  dimensions: readonly TDimensionResult[],
  key: TDimensionKey,
): TDimensionResult => {
  const found = dimensions.find((dimension) => dimension.key === key);
  if (found === undefined) throw new Error(`dimensión ausente: ${key}`);
  return found;
};

const indicatorOf = (
  dimensions: readonly TDimensionResult[],
  key: string,
) => {
  for (const dimension of dimensions) {
    const found = dimension.indicators.find(
      (indicator) => indicator.key === key,
    );
    if (found !== undefined) return found;
  }
  return undefined;
};

const scoreOf = (overrides: Partial<TFacts> = {}, isPartial = false) =>
  buildScore(cleanFacts(overrides), { rootSessionId: 'root', isPartial });

// ---------------------------------------------------------------------------
// Dimensiones disponibles / omitidas por mínimo
// ---------------------------------------------------------------------------

describe('dimensiones disponibles y omitidas', () => {
  it('omite Entrada si INP-1 no llega a 3 pares elegibles', () => {
    const result = scoreOf({ eligiblePairs: 2, closedTurns: 3 });
    const entrada = dimensionOf(result.dimensions, 'entrada');

    expect(entrada.available).toBe(false);
    expect(entrada.value).toBeNull();
    expect(indicatorOf(result.dimensions, 'INP-1')).toMatchObject({
      count: 2,
      minimum: 3,
    });
  });

  it('dispone de Entrada con 3 pares elegibles', () => {
    const result = scoreOf({ eligiblePairs: 3, closedTurns: 3 });
    const entrada = dimensionOf(result.dimensions, 'entrada');

    expect(entrada.available).toBe(true);
    expect(entrada.value).toBe(100);
  });

  it('omite Ejecución si hay menos de 10 tool calls', () => {
    const result = scoreOf({ assistants: steps(10), tools: calls(9) });
    const ejecucion = dimensionOf(result.dimensions, 'ejecucion');

    expect(ejecucion.available).toBe(false);
    expect(ejecucion.value).toBeNull();
    expect(indicatorOf(result.dimensions, 'RES-1')).toMatchObject({
      count: 9,
      minimum: 10,
    });
  });

  it('omite Ejecución si hay menos de 5 pasos aunque haya 10 calls', () => {
    const result = scoreOf({ assistants: steps(4), tools: calls(10) });

    expect(dimensionOf(result.dimensions, 'ejecucion').available).toBe(false);
  });

  it('dispone de Ejecución con 10 calls y 5 pasos', () => {
    const result = scoreOf({ assistants: steps(5), tools: calls(10) });
    const ejecucion = dimensionOf(result.dimensions, 'ejecucion');

    expect(ejecucion.available).toBe(true);
    expect(ejecucion.value).toBe(100);
  });

  it('omite Resultado sin outcome conocido', () => {
    const result = scoreOf({ outcome: null });

    expect(dimensionOf(result.dimensions, 'resultado').available).toBe(false);
    expect(dimensionOf(result.dimensions, 'resultado').value).toBeNull();
  });

  it('renormaliza el global sobre las dimensiones disponibles', () => {
    const result = scoreOf({
      eligiblePairs: 0,
      assistants: [],
      tools: [],
      outcome: 'succeeded',
    });

    expect(dimensionOf(result.dimensions, 'entrada').available).toBe(false);
    expect(dimensionOf(result.dimensions, 'ejecucion').available).toBe(false);
    expect(result.score).toBe(100);
    expect(globalScore([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Caché omitida y cobertura
// ---------------------------------------------------------------------------

describe('caché omitida', () => {
  it('descuenta 4,5 puntos cuando hay caché y desaparecen al omitirla', () => {
    const withCache = scoreOf();
    const omitted = scoreOf({ rootTokenSteps: [] });

    expect(withCache.cacheOmitted).toBe(false);
    expect(withCache.coverage).toBe(100);
    expect(omitted.cacheOmitted).toBe(true);
    expect(omitted.coverage).toBe(95.5);
    expect(withCache.coverage - omitted.coverage).toBe(4.5);
  });

  it('omite la caché con menos de 10 pasos con tokens y deja el indicador a la vista', () => {
    const result = scoreOf({ rootTokenSteps: cacheSteps(2) });
    const cache = indicatorOf(result.dimensions, 'CACHE');

    expect(result.cacheOmitted).toBe(true);
    expect(result.coverage).toBe(95.5);
    expect(cache).toMatchObject({ count: 2, minimum: 10 });
    expect(dimensionOf(result.dimensions, 'contexto').value).toBe(100);
  });

  it('omite la caché sin evidencia del proveedor (todo a 0) y no expone el indicador', () => {
    const noCache = Array.from({ length: 10 }, (_, index) =>
      tokenStep(index, { cacheRead: 0, cacheWrite: 0, input: 500 }),
    );
    const result = scoreOf({ rootTokenSteps: noCache });

    expect(result.cacheOmitted).toBe(true);
    expect(indicatorOf(result.dimensions, 'CACHE')).toBeUndefined();
    expect(result.coverage).toBe(95.5);
  });

  it('puntúa la caché como calidad: hitRate / 0,6 acotado a 1', () => {
    const hitRate06 = scoreOf(); // 600 / (600 + 400) = 0,6
    const hitRate04 = scoreOf({
      rootTokenSteps: Array.from({ length: 10 }, (_, index) =>
        tokenStep(index, { cacheRead: 400, input: 600 }),
      ),
    });

    expect(indicatorOf(hitRate06.dimensions, 'CACHE')).toMatchObject({
      ratio: 0.6,
      cap: 0.6,
      score: 1,
    });
    expect(
      indicatorOf(hitRate04.dimensions, 'CACHE')?.score,
    ).toBeCloseTo(2 / 3, 10);
    expect(dimensionOf(hitRate04.dimensions, 'contexto').value).toBeCloseTo(
      90,
      5,
    );
  });
});

// ---------------------------------------------------------------------------
// RES-4 y OUTCOME
// ---------------------------------------------------------------------------

describe('RES-4 (compactaciones automáticas de la raíz)', () => {
  it('no resta con la primera compactación', () => {
    const result = scoreOf({
      compactions: [compaction(0)],
      rootTokenSteps: [],
    });
    const res4 = indicatorOf(result.dimensions, 'RES-4');

    expect(res4).toMatchObject({ ratio: 0, cap: 2, score: 1, count: 1 });
    expect(dimensionOf(result.dimensions, 'contexto').value).toBe(100);
  });

  it('resta la mitad con la segunda y llega a 0 con la tercera', () => {
    const second = scoreOf({
      compactions: [compaction(0), compaction(1)],
      rootTokenSteps: [],
    });
    const third = scoreOf({
      compactions: [compaction(0), compaction(1), compaction(2)],
      rootTokenSteps: [],
    });

    expect(indicatorOf(second.dimensions, 'RES-4')).toMatchObject({
      ratio: 1,
      score: 0.5,
    });
    expect(dimensionOf(second.dimensions, 'contexto').value).toBe(50);
    expect(indicatorOf(third.dimensions, 'RES-4')).toMatchObject({
      ratio: 2,
      score: 0,
    });
    expect(dimensionOf(third.dimensions, 'contexto').value).toBe(0);
  });

  it('no cuenta compactaciones manuales ni de subagentes', () => {
    const result = scoreOf({
      compactions: [
        compaction(0, { reason: 'manual' }),
        compaction(1, { sessionId: 'child' }),
      ],
      rootTokenSteps: [],
    });

    expect(indicatorOf(result.dimensions, 'RES-4')?.count).toBe(0);
    expect(dimensionOf(result.dimensions, 'contexto').value).toBe(100);
  });
});

describe('OUTCOME', () => {
  it.each([
    ['succeeded', 1],
    ['interrupted', 0.5],
    ['failed', 0],
  ] as const)('puntúa %s con %s', (outcome, value) => {
    const result = scoreOf({ outcome });
    const resultado = dimensionOf(result.dimensions, 'resultado');

    expect(indicatorOf(result.dimensions, 'OUTCOME')).toMatchObject({
      ratio: 1 - value,
      score: value,
      count: 1,
      minimum: 1,
    });
    expect(resultado.value).toBe(100 * (0.7 * value + 0.3));
  });
});

// ---------------------------------------------------------------------------
// Cobertura, bandas y redondeo
// ---------------------------------------------------------------------------

describe('INP-2, INP-3 y OPEN_ERRORS', () => {
  it('puntúa INP-2 con la proporción de turnos interrumpidos y su tope 0,33', () => {
    const oneOfThree = scoreOf({
      closedTurns: 3,
      interruptions: [interruption(1)],
    });
    const inp2 = indicatorOf(oneOfThree.dimensions, 'INP-2');

    expect(inp2).toMatchObject({ cap: 0.33, count: 3 });
    expect(inp2?.ratio).toBeCloseTo(1 / 3, 10);
    expect(inp2?.score).toBe(0);

    const oneOfSix = scoreOf({
      closedTurns: 6,
      interruptions: [interruption(1)],
    });
    const belowCap = indicatorOf(oneOfSix.dimensions, 'INP-2');

    expect(belowCap?.ratio).toBeCloseTo(1 / 6, 10);
    expect(belowCap?.score).toBeCloseTo(1 - 1 / 6 / 0.33, 10);
  });

  it('puntúa INP-3 por preguntas repetidas y no resta si no hubo preguntas', () => {
    const halfRepeated = scoreOf({
      questionCalls: [question(1), question(2)],
      repeatedQuestions: [question(2, true)],
    });
    const inp3 = indicatorOf(halfRepeated.dimensions, 'INP-3');

    expect(inp3).toMatchObject({ cap: 1, count: 2 });
    expect(inp3?.ratio).toBe(0.5);
    expect(inp3?.score).toBe(0.5);

    const noQuestions = scoreOf({
      questionCalls: [],
      repeatedQuestions: [],
    });
    expect(indicatorOf(noQuestions.dimensions, 'INP-3')).toMatchObject({
      count: 0,
      ratio: 0,
      score: 1,
    });
    expect(dimensionOf(noQuestions.dimensions, 'entrada').value).toBe(100);
  });

  it('puntúa OPEN_ERRORS de forma binaria y nunca lo omite', () => {
    const clean = scoreOf();
    const open = scoreOf({ openErrors: true });

    expect(indicatorOf(clean.dimensions, 'OPEN_ERRORS')).toMatchObject({
      ratio: 0,
      cap: 1,
      score: 1,
      count: 1,
      minimum: 0,
    });
    expect(indicatorOf(open.dimensions, 'OPEN_ERRORS')).toMatchObject({
      ratio: 1,
      cap: 1,
      score: 0,
    });
    expect(dimensionOf(open.dimensions, 'resultado').value).toBe(70);
  });
});

describe('cobertura (engine §4.4)', () => {
  it('cruza el umbral de 60 solo cuando los pesos disponibles lo alcanzan', () => {
    const below = scoreOf({
      eligiblePairs: 0,
      assistants: [],
      tools: [],
      outcome: 'succeeded',
      rootTokenSteps: [],
    });
    const above = scoreOf({
      eligiblePairs: 0,
      assistants: steps(5),
      tools: calls(10),
      outcome: 'succeeded',
      rootTokenSteps: [],
    });

    // Solo Contexto (15) + Resultado (25), menos 4,5 de caché omitida.
    expect(below.coverage).toBe(35.5);
    // Ejecución (30) + Contexto (15) + Resultado (25), menos 4,5.
    expect(above.coverage).toBe(65.5);
    expect(below.coverage).toBeLessThan(60);
    expect(above.coverage).toBeGreaterThanOrEqual(60);
  });

  it('no descuenta la caché si Contexto no está disponible', () => {
    const entrada: TDimensionResult = {
      key: 'entrada',
      weight: 30,
      value: 100,
      available: true,
      indicators: [],
    };

    expect(computeCoverage([entrada], true)).toBe(30);
  });
});

describe('bandas y redondeo', () => {
  it('aplica los límites 85/70/50', () => {
    expect(bandFor(null)).toBeNull();
    expect(bandFor(0)).toBe('friccion');
    expect(bandFor(49)).toBe('friccion');
    expect(bandFor(50)).toBe('mejorable');
    expect(bandFor(69)).toBe('mejorable');
    expect(bandFor(70)).toBe('aceptable');
    expect(bandFor(84)).toBe('aceptable');
    expect(bandFor(85)).toBe('eficiente');
    expect(bandFor(100)).toBe('eficiente');
  });

  it('redondea el global al entero más cercano', () => {
    // Entrada/Ejecución/Contexto 100 y Resultado 70 ⇒ 92,5 ⇒ 93.
    const result = scoreOf({ openErrors: true });

    expect(dimensionOf(result.dimensions, 'resultado').value).toBe(70);
    expect(result.score).toBe(93);
    expect(bandFor(result.score)).toBe('eficiente');
  });
});

// ---------------------------------------------------------------------------
// Confianza (engine §4.6)
// ---------------------------------------------------------------------------

describe('confianza', () => {
  it('es alta con cobertura ≥85, doble muestra y subárbol completo', () => {
    expect(scoreOf().confidence).toBe('alta');
  });

  it('es media con la muestra justa aunque la cobertura sea completa', () => {
    const result = scoreOf({ eligiblePairs: 3 });

    expect(result.coverage).toBe(100);
    expect(result.confidence).toBe('media');
  });

  it('es baja con cobertura <70', () => {
    const result = scoreOf({
      eligiblePairs: 0,
      assistants: [],
      tools: [],
      outcome: 'succeeded',
      rootTokenSteps: [],
    });

    expect(result.coverage).toBe(35.5);
    expect(result.confidence).toBe('baja');
  });

  it('es baja si el subárbol es parcial aunque la cobertura sea completa', () => {
    expect(scoreOf({}, true).confidence).toBe('baja');
  });
});
