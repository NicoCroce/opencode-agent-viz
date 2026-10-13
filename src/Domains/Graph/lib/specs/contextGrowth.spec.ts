import { describe, expect, it } from 'vitest';
import type { SessionMessageCompaction } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { assistantMessage } from './fixtures';
import {
  deriveCompactionEffect,
  deriveContextCompactions,
  deriveContextGrowth,
} from '../metrics/contextGrowth';

/** Respuesta assistant con una ventana (`input + cache.read + cache.write`). */
const response = (
  id: string,
  created: number,
  tokens: { input: number; read: number; write: number },
) =>
  assistantMessage({
    id,
    time: { created },
    tokens: {
      input: tokens.input,
      output: 0,
      reasoning: 0,
      cache: { read: tokens.read, write: tokens.write },
    },
  });

const compaction = (
  id: string,
  at: number,
  overrides: Partial<SessionMessageCompaction> = {},
): TSessionMessage => {
  const info = {
    id,
    type: 'compaction',
    time: { created: at },
    status: 'completed',
    reason: 'auto',
    summary: 'resumen',
    ...overrides,
  } as SessionMessageCompaction;
  return { info, parts: [] };
};

describe('deriveContextGrowth · FR-016', () => {
  it('deriva un punto por paso con la ventana del mensaje', () => {
    const growth = deriveContextGrowth([
      response('a1', 10, { input: 100, read: 20, write: 5 }),
      response('a2', 20, { input: 300, read: 0, write: 0 }),
    ]);

    expect(growth).toEqual([
      { stepId: 'a1', startedAt: 10, windowTokens: 125 },
      { stepId: 'a2', startedAt: 20, windowTokens: 300 },
    ]);
  });

  it('ordena por `time.created` y omite los pasos sin tokens', () => {
    const growth = deriveContextGrowth([
      response('a3', 30, { input: 10, read: 0, write: 0 }),
      assistantMessage({ id: 'a1', time: { created: 10 }, tokens: undefined }),
      response('a2', 20, { input: 300, read: 0, write: 0 }),
    ]);

    expect(growth.map((point) => point.stepId)).toEqual(['a2', 'a3']);
  });

  it('ignora mensajes que no son assistant', () => {
    const growth = deriveContextGrowth([
      compaction('c1', 5),
      response('a1', 10, { input: 1, read: 0, write: 0 }),
    ]);

    expect(growth.map((point) => point.stepId)).toEqual(['a1']);
  });

  it('sin mensajes medibles devuelve una serie vacía', () => {
    expect(deriveContextGrowth([])).toEqual([]);
  });
});

describe('deriveContextCompactions · FR-016', () => {
  it('deriva estado y motivo reales, ordenados por tiempo', () => {
    const compactions = deriveContextCompactions([
      compaction('c2', 200, { status: 'failed' }),
      compaction('c1', 100, { reason: 'manual' }),
    ]);

    expect(compactions).toEqual([
      { id: 'c1', at: 100, status: 'completed', reason: 'manual' },
      { id: 'c2', at: 200, status: 'failed', reason: 'auto' },
    ]);
  });

  it('sin compactaciones devuelve una lista vacía', () => {
    expect(deriveContextCompactions([response('a1', 1, { input: 1, read: 0, write: 0 })])).toEqual(
      [],
    );
  });
});

describe('deriveCompactionEffect · FR-016', () => {
  const growth = [
    { stepId: 'a1', startedAt: 10, windowTokens: 1000 },
    { stepId: 'a2', startedAt: 20, windowTokens: 1200 },
    { stepId: 'a3', startedAt: 40, windowTokens: 400 },
  ];

  it('compara la ventana antes y después de la compactación', () => {
    const effect = deriveCompactionEffect(growth, {
      id: 'c1',
      at: 30,
      status: 'completed',
      reason: 'auto',
    });

    expect(effect).toEqual({ before: 1200, after: 400 });
  });

  it('deja en `null` el extremo sin pasos medidos', () => {
    const effect = deriveCompactionEffect(growth, {
      id: 'c1',
      at: 5,
      status: 'completed',
      reason: 'auto',
    });

    expect(effect).toEqual({ before: null, after: 1000 });
  });
});
