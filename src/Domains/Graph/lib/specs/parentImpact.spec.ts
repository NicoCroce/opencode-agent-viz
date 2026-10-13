import { describe, expect, it } from 'vitest';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { deriveParentImpact } from '../metrics/parentImpact';

type SdkTokens = {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
};

const userMessage = (text: string): TSessionMessage => ({
  info: { id: 'u1', type: 'user', time: { created: 0 }, text },
  parts: [],
});

const assistantMessage = (
  parts: TSessionMessage['parts'],
  tokens?: SdkTokens,
): TSessionMessage => ({
  info: {
    id: 'a1',
    type: 'assistant',
    agent: 'develop',
    model: { id: 'm', providerID: 'p' },
    time: { created: 0, completed: 1 },
    content: parts,
    ...(tokens ? { tokens } : {}),
  },
  parts,
});

const spawnTool = (
  name: string,
  sessionID: string,
  result: string,
): TSessionMessage['parts'][number] => ({
  type: 'tool',
  id: 'tool-1',
  name,
  state: {
    status: 'completed',
    input: {},
    content: [{ type: 'text', text: result }],
    metadata: { sessionID },
  },
  time: { created: 0, completed: 1 },
});

const tokens = (cacheRead: number): SdkTokens => ({
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: cacheRead, write: 0 },
});

describe('deriveParentImpact · C6 (aporte al padre)', () => {
  it('halla el tool de spawn por metadata.sessionID y reparte el aporte', () => {
    const parentMessages = [
      userMessage('u'.repeat(100)),
      assistantMessage([spawnTool('subagent', 'child', 'r'.repeat(50))], tokens(1000)),
    ];

    const impact = deriveParentImpact('parent', parentMessages, 'child');

    // chars padre = 100 (user) + 2 (JSON.stringify({})) + 50 (resultado) = 152.
    expect(impact?.addedChars).toBe(50);
    expect(impact?.pctOfParent).toBeCloseTo((50 / 152) * 100, 5);
    expect(impact?.addedTokens).toBe(Math.round((1000 * 50) / 152));
    expect(impact?.parentId).toBe('parent');
  });

  it('también reconoce el tool `task` del historial antiguo', () => {
    const parentMessages = [
      userMessage('u'.repeat(10)),
      assistantMessage([spawnTool('task', 'child', 'ok')]),
    ];

    const impact = deriveParentImpact('parent', parentMessages, 'child');

    expect(impact?.addedChars).toBe(2);
  });

  it('devuelve null cuando el sessionID no coincide con ningún tool', () => {
    const parentMessages = [
      assistantMessage([spawnTool('subagent', 'otro-hijo', 'x')]),
    ];

    expect(deriveParentImpact('parent', parentMessages, 'child')).toBeNull();
  });

  it('devuelve null sin mensajes del padre (nodo raíz)', () => {
    expect(deriveParentImpact('parent', [], 'child')).toBeNull();
  });

  it('devuelve null cuando ningún tool abre una sesión hija', () => {
    const parentMessages = [
      assistantMessage([
        {
          type: 'tool',
          id: 'read',
          name: 'read',
          state: {
            status: 'completed',
            input: {},
            content: [{ type: 'text', text: 'contenido' }],
            metadata: {},
          },
          time: { created: 0, completed: 1 },
        },
      ]),
    ];

    expect(deriveParentImpact('parent', parentMessages, 'child')).toBeNull();
  });

  it('deja addedTokens en null sin ventana medible del padre', () => {
    const parentMessages = [
      userMessage('u'.repeat(10)),
      assistantMessage([spawnTool('subagent', 'child', 'ok')]),
    ];

    const impact = deriveParentImpact('parent', parentMessages, 'child');

    expect(impact?.addedChars).toBe(2);
    expect(impact?.pctOfParent).not.toBeNull();
    expect(impact?.addedTokens).toBeNull();
  });
});
