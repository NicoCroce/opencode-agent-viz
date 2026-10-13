import { describe, expect, it } from 'vitest';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TContextCategory } from '../../Graph.entity';
import { deriveContextBreakdown } from '../metrics/contextBreakdown';

type SdkTokens = {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
};

const assistantMessage = (
  parts: TSessionMessage['parts'],
  tokens?: SdkTokens,
): TSessionMessage => ({
  info: {
    id: 'a1',
    type: 'assistant',
    agent: 'develop',
    model: { id: 'm', providerID: 'p' },
    time: { created: 0, completed: 10 },
    content: parts,
    ...(tokens ? { tokens } : {}),
  },
  parts,
});

const userMessage = (text: string): TSessionMessage => ({
  info: { id: 'u1', type: 'user', time: { created: 0 }, text },
  parts: [],
});

const tokens = (input: number, cacheRead: number, cacheWrite: number): SdkTokens => ({
  input,
  output: 0,
  reasoning: 0,
  cache: { read: cacheRead, write: cacheWrite },
});

const completedTool = (input: unknown, result: string): TSessionMessage['parts'][number] => ({
  type: 'tool',
  id: 'tool-1',
  name: 'read',
  state: {
    status: 'completed',
    input: input as Record<string, never>,
    content: [{ type: 'text', text: result }],
  },
  time: { created: 0, completed: 1 },
});

const category = (
  breakdown: ReturnType<typeof deriveContextBreakdown>,
  target: TContextCategory,
) => breakdown.buckets.find((bucket) => bucket.category === target);

describe('deriveContextBreakdown · C1 (categorías y porcentajes)', () => {
  it('clasifica cada parte y ordena por peso descendente', () => {
    const breakdown = deriveContextBreakdown([
      userMessage('x'.repeat(70)),
      assistantMessage([
        { type: 'reasoning', text: 'r'.repeat(30) },
        completedTool({ query: 'y'.repeat(10) }, 'z'.repeat(20)),
      ]),
    ]);

    expect(category(breakdown, 'userText')?.chars).toBe(70);
    expect(category(breakdown, 'reasoning')?.chars).toBe(30);
    expect(category(breakdown, 'toolResult')?.chars).toBe(20);
    // toolInput = len(JSON.stringify({query:'yyyyyyyyyy'}))
    expect(category(breakdown, 'toolInput')?.chars).toBeGreaterThan(0);
    expect(breakdown.buckets[0].category).toBe('userText');
  });

  it('los porcentajes suman 100% (SC-002)', () => {
    const breakdown = deriveContextBreakdown([
      userMessage('u'.repeat(47)),
      assistantMessage([
        { type: 'reasoning', text: 'r'.repeat(26) },
        { type: 'text', text: 't'.repeat(5) },
        completedTool({ q: 'i'.repeat(20) }, 'o'.repeat(22)),
      ]),
    ]);

    const sum = breakdown.buckets.reduce((total, bucket) => total + bucket.pct, 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it('omite las categorías sin contenido', () => {
    const breakdown = deriveContextBreakdown([userMessage('hola')]);

    expect(breakdown.buckets).toHaveLength(1);
    expect(breakdown.buckets[0].category).toBe('userText');
  });
});

describe('deriveContextBreakdown · C2/C3 (reparto de tokens)', () => {
  it('reparte los tokens de la ventana proporcional al peso de caracteres', () => {
    const breakdown = deriveContextBreakdown([
      userMessage('u'.repeat(70)),
      assistantMessage([{ type: 'reasoning', text: 'r'.repeat(30) }], tokens(0, 1000, 0)),
    ]);

    expect(breakdown.windowTokens).toBe(1000);
    expect(breakdown.hasTokens).toBe(true);
    expect(category(breakdown, 'userText')?.tokens).toBe(700);
    expect(category(breakdown, 'reasoning')?.tokens).toBe(300);
  });

  it('sin ventana medible, `hasTokens` es false y los tokens son null', () => {
    const breakdown = deriveContextBreakdown([userMessage('hola')]);

    expect(breakdown.windowTokens).toBeNull();
    expect(breakdown.hasTokens).toBe(false);
    expect(breakdown.buckets.every((bucket) => bucket.tokens === null)).toBe(true);
  });

  it('usa la ventana del último paso con tokens', () => {
    const breakdown = deriveContextBreakdown([
      assistantMessage([{ type: 'text', text: 'a' }], tokens(10, 0, 0)),
      assistantMessage([{ type: 'text', text: 'b' }], tokens(0, 0, 500)),
    ]);

    expect(breakdown.windowTokens).toBe(500);
  });
});

describe('deriveContextBreakdown · C4 (vacío)', () => {
  it('sin mensajes, el desglose queda vacío (no ceros)', () => {
    const breakdown = deriveContextBreakdown([]);

    expect(breakdown.chars).toBe(0);
    expect(breakdown.buckets).toEqual([]);
    expect(breakdown.hasTokens).toBe(false);
  });
});
