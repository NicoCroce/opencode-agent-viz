/**
 * Specs de `turns.ts` (feature 015): segmentación de turnos, atribución del
 * subárbol y totales (engine §10). Todos los tiempos son fijos; ningún caso lee
 * el reloj ni depende del orden de `Object.keys`.
 */
import { describe, expect, it } from 'vitest';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TEfficiencyInput } from '../../Efficiency.entity';
import { buildFacts, buildTotals } from '../turns';
import {
  buildAssistant,
  buildCompaction,
  buildIdle,
  buildToolPart,
  buildUser,
} from './fixtures';

/** Base temporal alineada con los builders de `fixtures.ts`. */
const BASE = 1_700_000_000_000;

const makeInput = (
  messagesBySession: TEfficiencyInput['messagesBySession'],
  sessions: TEfficiencyInput['sessions'] = { root: {} },
  now?: number,
): TEfficiencyInput => ({
  rootSessionId: 'root',
  messagesBySession,
  sessions,
  ...(now === undefined ? {} : { now }),
});

/** Assistant con tiempos explícitos (creado/completado). */
const assistantAt = (
  id: string,
  created: number,
  overrides: Partial<SessionMessageAssistant> = {},
): ReturnType<typeof buildAssistant> =>
  buildAssistant({
    id,
    time: { created, completed: created + 1_000 },
    ...overrides,
  });

describe('buildFacts — segmentación de turnos', () => {
  it('cierra un turno normal con el primer idle que tiene pasos', () => {
    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u1' }),
          buildAssistant({
            id: 'a1',
            content: [buildToolPart({ id: 't1' })],
          }),
          buildIdle('succeeded', { id: 'i1' }),
        ],
      }),
    );

    expect(facts.users).toHaveLength(1);
    expect(facts.turns).toHaveLength(1);
    const [turn] = facts.turns;
    expect(turn.index).toBe(1);
    expect(turn.closed).toBe(true);
    expect(turn.outcome).toBe('succeeded');
    expect(turn.steps).toBe(1);
    expect(turn.toolCalls).toBe(1);
    expect(turn.toolErrors).toBe(0);
    expect(turn.cost).toBeCloseTo(0.012);
    expect(turn.durationMs).toBe(4_000);
    expect(turn.signals).toEqual([]);
    expect(facts.closedTurns).toBe(1);
    expect(facts.outcome).toBe('succeeded');
  });

  it('cierra el turno como interrumpido cuando llega el siguiente user', () => {
    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u1' }),
          buildAssistant({ id: 'a1' }),
          buildUser({ id: 'u2', time: { created: BASE + 5_000 } }),
          buildIdle('succeeded', {
            id: 'i2',
            time: { created: BASE + 9_000 },
          }),
        ],
      }),
    );

    expect(facts.turns).toHaveLength(2);
    expect(facts.turns[0].closed).toBe(true);
    expect(facts.turns[0].outcome).toBe('interrupted');
    expect(facts.turns[0].durationMs).toBe(5_000);
    // El idle de U2 no tiene pasos del turno actual: es la cancelación de U1.
    expect(facts.turns[1].closed).toBe(false);
    expect(facts.turns[1].outcome).toBeNull();
    expect(facts.closedTurns).toBe(1);
    expect(facts.interruptions).toEqual([
      expect.objectContaining({ messageId: 'u2', kind: 'user', turnIndex: 1 }),
    ]);
    expect(facts.outcome).toBe('succeeded');
  });

  it('ignora el idle de cancelación y cierra el turno nuevo con su propio idle', () => {
    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u1' }),
          buildAssistant({ id: 'a1' }),
          buildUser({ id: 'u2', time: { created: BASE + 5_000 } }),
          buildIdle('interrupted', {
            id: 'i-cancel',
            time: { created: BASE + 5_500 },
          }),
          assistantAt('a2', BASE + 6_000),
          buildIdle('succeeded', {
            id: 'i2',
            time: { created: BASE + 9_000 },
          }),
        ],
      }),
    );

    expect(facts.turns).toHaveLength(2);
    expect(facts.turns[1].closed).toBe(true);
    expect(facts.turns[1].outcome).toBe('succeeded');
    expect(facts.turns[1].durationMs).toBe(4_000);
    expect(facts.turns[1].steps).toBe(1);
    expect(facts.closedTurns).toBe(2);
    expect(facts.interruptions).toHaveLength(1);
    expect(facts.interruptions[0].messageId).toBe('u2');
  });

  it('deja abierto el último turno y usa now solo para su duración', () => {
    const messages = { root: [buildUser({ id: 'u1' }), buildAssistant({ id: 'a1' })] };

    const withoutClock = buildFacts(makeInput(messages));
    expect(withoutClock.turns[0].closed).toBe(false);
    expect(withoutClock.turns[0].outcome).toBeNull();
    expect(withoutClock.turns[0].durationMs).toBeNull();
    expect(withoutClock.closedTurns).toBe(0);

    const withClock = buildFacts(makeInput(messages, { root: {} }, BASE + 10_000));
    expect(withClock.turns[0].durationMs).toBe(10_000);
  });

  it('numera 1..N y deja como máximo un turno abierto al final', () => {
    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u1' }),
          assistantAt('a1', BASE + 1_000),
          buildIdle('succeeded', {
            id: 'i1',
            time: { created: BASE + 3_000 },
          }),
          buildUser({ id: 'u2', time: { created: BASE + 4_000 } }),
          assistantAt('a2', BASE + 5_000),
          buildIdle('failed', { id: 'i2', time: { created: BASE + 7_000 } }),
          buildUser({ id: 'u3', time: { created: BASE + 8_000 } }),
          assistantAt('a3', BASE + 9_000),
        ],
      }),
    );

    expect(facts.turns.map((turn) => turn.index)).toEqual([1, 2, 3]);
    expect(facts.turns.map((turn) => turn.closed)).toEqual([true, true, false]);
    expect(facts.turns.map((turn) => turn.outcome)).toEqual([
      'succeeded',
      'failed',
      null,
    ]);
    expect(facts.turns.filter((turn) => !turn.closed)).toHaveLength(1);
    expect(facts.turns[facts.turns.length - 1].closed).toBe(false);
    expect(facts.closedTurns).toBe(2);
  });
});

describe('buildFacts — input humano y subárbol', () => {
  it('atribuye pasos del subagente por tiempo e ignora sus user/idle', () => {
    const facts = buildFacts(
      makeInput(
        {
          root: [
            buildUser({ id: 'u1' }),
            assistantAt('a-root', BASE + 1_000),
            buildIdle('succeeded', {
              id: 'i1',
              time: { created: BASE + 10_000 },
            }),
          ],
          sub: [
            buildUser({ id: 'su1', time: { created: BASE + 500 } }),
            assistantAt('a-sub', BASE + 2_000),
            buildIdle('failed', {
              id: 'si1',
              time: { created: BASE + 3_000 },
            }),
          ],
        },
        { root: {}, sub: { parentID: 'root' } },
      ),
    );

    expect(facts.users.map((user) => user.messageId)).toEqual(['u1']);
    expect(facts.turns).toHaveLength(1);
    expect(facts.turns[0].steps).toBe(2);
    expect(facts.turns[0].cost).toBeCloseTo(0.024);
    expect(facts.assistants.map((step) => step.sessionId)).toEqual(
      expect.arrayContaining(['root', 'sub']),
    );
    // El idle del subagente no cierra ni define el outcome de la raíz.
    expect(facts.outcome).toBe('succeeded');
    expect(facts.idles).toHaveLength(1);
  });

  it('ordena los ids de sesión sin mensajes cargados (raíz excluida)', () => {
    const facts = buildFacts(
      makeInput({ root: [buildUser({ id: 'u1' })] }, {
        root: {},
        b: { parentID: 'root' },
        a: { parentID: 'root' },
      }),
    );

    expect(facts.missingSessionIds).toEqual(['a', 'b']);
  });

  it('ignora los mensajes sin time.created para turnos y totales', () => {
    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u-sin-tiempo', time: undefined }),
          buildAssistant({ id: 'a-sin-tiempo', time: undefined }),
          buildUser({ id: 'u1' }),
          assistantAt('a1', BASE + 1_000),
          buildIdle('succeeded', {
            id: 'i1',
            time: { created: BASE + 4_000 },
          }),
        ],
      }),
    );

    expect(facts.users.map((user) => user.messageId)).toEqual(['u1']);
    expect(facts.assistants.map((step) => step.messageId)).toEqual(['a1']);
    expect(facts.turns).toHaveLength(1);
    expect(facts.turns[0].steps).toBe(1);
    expect(buildTotals(facts).cost).toBeCloseTo(0.012);
  });

  it('no muta la entrada y es determinista en dos ejecuciones', () => {
    const input = makeInput({
      root: [
        buildUser({ id: 'u1' }),
        buildAssistant({ id: 'a1', content: [buildToolPart({ id: 't1' })] }),
        buildIdle('succeeded', { id: 'i1' }),
        buildUser({ id: 'u2', time: { created: BASE + 5_000 } }),
        assistantAt('a2', BASE + 6_000),
      ],
    });
    const snapshot = JSON.stringify(input);

    const first = buildFacts(input);
    const second = buildFacts(input);

    expect(JSON.stringify(input)).toBe(snapshot);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe('buildTotals — engine §7', () => {
  it('suma token/coste assistant-only (sin compactación) y mide la ventana en la raíz', () => {
    const facts = buildFacts(
      makeInput(
        {
          root: [
            buildUser({ id: 'u1' }),
            assistantAt('a1', BASE + 1_000),
            assistantAt('a2', BASE + 2_000, {
              cost: 0.008,
              tokens: {
                input: 100,
                output: 10,
                reasoning: 0,
                cache: { read: 50, write: 5 },
              },
            }),
            buildCompaction('auto', {
              id: 'c1',
              time: { created: BASE + 2_500 },
              cost: 9,
              tokens: {
                input: 7_777,
                output: 7_777,
                reasoning: 0,
                cache: { read: 7_777, write: 7_777 },
              },
            }),
            buildIdle('succeeded', {
              id: 'i1',
              time: { created: BASE + 4_000 },
            }),
          ],
          sub: [assistantAt('a-sub', BASE + 3_000, { cost: 0.5 })],
        },
        { root: {}, sub: { parentID: 'root' } },
      ),
    );

    const totals = buildTotals(facts);

    expect(totals.cost).toBeCloseTo(0.52);
    expect(totals.tokensIn).toBe(2_500);
    expect(totals.cacheRead).toBe(1_850);
    expect(totals.cacheWrite).toBe(245);
    expect(totals.windowTokens).toBe(155);
    expect(totals.compactions).toBe(1);
  });

  it('devuelve null cuando no se reportaron tokens/coste y 0 real en conteos', () => {
    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u1' }),
          buildAssistant({
            id: 'a1',
            cost: undefined,
            tokens: undefined,
            content: [buildToolPart({ id: 't1' })],
          }),
          buildIdle('succeeded', { id: 'i1' }),
        ],
      }),
    );

    const totals = buildTotals(facts);

    expect(totals.cost).toBeNull();
    expect(totals.tokensIn).toBeNull();
    expect(totals.tokensOut).toBeNull();
    expect(totals.cacheRead).toBeNull();
    expect(totals.cacheWrite).toBeNull();
    expect(totals.windowTokens).toBeNull();
    expect(totals.latencyP95Ms).toBe(1_000);
    expect(totals.slowToolCalls).toBe(0);
    expect(totals.compactions).toBe(0);
    expect(totals.retries).toBe(0);
    expect(totals.toolErrors).toBe(0);
    expect(totals.toolCalls).toBe(1);
  });

  it('excluye tools sin completar de la latencia y no inventa su duración', () => {
    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u1' }),
          buildAssistant({
            id: 'a1',
            time: { created: BASE + 1_000, completed: BASE + 2_000 },
            content: [
              buildToolPart({
                id: 't-running',
                status: 'running',
                created: BASE + 1_100,
                ran: BASE + 1_200,
              }),
              buildToolPart({
                id: 't-done',
                created: BASE + 1_300,
                ran: BASE + 1_400,
                completed: BASE + 1_500,
              }),
            ],
          }),
          buildIdle('succeeded', {
            id: 'i1',
            time: { created: BASE + 4_000 },
          }),
        ],
      }),
    );

    const running = facts.tools.find((tool) => tool.toolId === 't-running');
    expect(running).toMatchObject({
      status: 'running',
      completedAt: null,
      durationMs: null,
      output: '',
    });

    const totals = buildTotals(facts);
    expect(totals.toolCalls).toBe(2);
    expect(totals.latencyP95Ms).toBe(100);
    expect(totals.slowToolCalls).toBe(0);
    expect(totals.toolErrors).toBe(0);
  });

  it('calcula p95 nearest-rank y tools lentas sobre el subárbol', () => {
    const tool = (
      id: string,
      created: number,
      duration: number,
    ): ReturnType<typeof buildToolPart> =>
      buildToolPart({
        id,
        created,
        ran: created + 100,
        completed: created + 100 + duration,
      });

    const facts = buildFacts(
      makeInput({
        root: [
          buildUser({ id: 'u1' }),
          buildAssistant({
            id: 'a1',
            content: [
              tool('t1', BASE + 1_000, 1_000),
              tool('t2', BASE + 3_000, 2_000),
            ],
          }),
          buildAssistant({
            id: 'a2',
            time: { created: BASE + 7_000, completed: BASE + 8_000 },
            content: [tool('t3', BASE + 7_100, 65_000)],
          }),
          buildIdle('succeeded', {
            id: 'i1',
            time: { created: BASE + 80_000 },
          }),
        ],
      }),
    );

    const totals = buildTotals(facts);

    expect(facts.toolDurationsMs).toEqual([1_000, 2_000, 65_000]);
    expect(totals.latencyP95Ms).toBe(65_000);
    expect(totals.slowToolCalls).toBe(1);
    expect(totals.toolCalls).toBe(3);
    expect(totals.toolErrors).toBe(0);
  });
});
