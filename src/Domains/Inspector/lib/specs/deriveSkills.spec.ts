import { describe, expect, it } from 'vitest';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { deriveSkills } from '../deriveSkills';

type TToolPart = Extract<TSessionMessage['parts'][number], { type: 'tool' }>;

/** 40 caracteres ÷ 4 = 10 tokens estimados (FR-009, contrato inspector-skills §1). */
const SKILL_TEXT = 'x'.repeat(40);
const SKILL_TOKENS = 10;

const assistant = (parts: TSessionMessage['parts']): TSessionMessage => ({
  info: {
    id: 'assistant-1',
    type: 'assistant',
    agent: 'develop',
    model: { id: 'model', providerID: 'provider' },
    time: { created: 0, completed: 1 },
    content: parts,
  },
  parts,
});

const completedTool = ({
  id,
  name,
  input,
  created,
  text = SKILL_TEXT,
}: {
  id: string;
  name: string;
  input: Record<string, string>;
  created: number;
  text?: string;
}): TToolPart => ({
  type: 'tool',
  id,
  name,
  state: {
    status: 'completed',
    input,
    content: [{ type: 'text', text }],
  },
  time: { created, completed: created + 1 },
});

const skill = (overrides: {
  id: string;
  input: Record<string, string>;
  created: number;
}): TToolPart => completedTool({ name: 'skill', ...overrides });

/** Skill cargada pero sin texto en `content` → estimación desconocida. */
const skillWithoutText = ({
  id,
  name,
  created,
}: {
  id: string;
  name: string;
  created: number;
}): TToolPart => ({
  type: 'tool',
  id,
  name: 'skill',
  state: {
    status: 'completed',
    input: { name },
    content: [
      { type: 'file', uri: 'file:///skills/frontend-design.md', mime: 'text/markdown' },
    ],
  },
  time: { created, completed: created + 1 },
});

const failedSkill = ({
  id,
  name,
  created,
}: {
  id: string;
  name: string;
  created: number;
}): TToolPart => ({
  type: 'tool',
  id,
  name: 'skill',
  state: {
    status: 'error',
    input: { name },
    error: { type: 'PermissionDenied', message: 'denegada por permisos' },
  },
  time: { created, completed: created + 1 },
});

describe('deriveSkills · US6 (FR-009/FR-010)', () => {
  it('toma el nombre y la estimación de tokens de una skill cargada (input.name)', () => {
    const messages = [
      assistant([
        skill({ id: 'tool-1', input: { name: 'frontend-design' }, created: 100 }),
      ]),
    ];

    expect(deriveSkills(messages)).toEqual([
      {
        name: 'frontend-design',
        count: 1,
        estTokens: SKILL_TOKENS,
        firstLoadedAt: 100,
      },
    ]);
  });

  it('usa input.id como nombre cuando input.name no está presente', () => {
    const messages = [
      assistant([
        skill({ id: 'tool-2', input: { id: 'commit-conventions' }, created: 200 }),
      ]),
    ];

    expect(deriveSkills(messages)).toEqual([
      {
        name: 'commit-conventions',
        count: 1,
        estTokens: SKILL_TOKENS,
        firstLoadedAt: 200,
      },
    ]);
  });

  it('acumula repeticiones de la misma skill en count y conserva el primer instante', () => {
    const messages = [
      assistant([
        skill({ id: 'tool-1', input: { name: 'frontend-design' }, created: 500 }),
        skill({ id: 'tool-2', input: { name: 'frontend-design' }, created: 900 }),
      ]),
    ];

    expect(deriveSkills(messages)).toEqual([
      {
        name: 'frontend-design',
        count: 2,
        estTokens: SKILL_TOKENS,
        firstLoadedAt: 500,
      },
    ]);
  });

  it('excluye las skills cuyo tool falló (state.status === "error")', () => {
    const messages = [
      assistant([
        skill({ id: 'tool-1', input: { name: 'frontend-design' }, created: 100 }),
        failedSkill({ id: 'tool-2', name: 'owasp-security-check', created: 300 }),
      ]),
    ];

    const skills = deriveSkills(messages);

    expect(skills.map(({ name }) => name)).toEqual(['frontend-design']);
    expect(skills[0].count).toBe(1);
  });

  it('deja estTokens en null cuando la skill no trae texto', () => {
    const messages = [
      assistant([skillWithoutText({ id: 'tool-1', name: 'frontend-design', created: 100 })]),
    ];

    expect(deriveSkills(messages)).toMatchObject([
      { name: 'frontend-design', count: 1, estTokens: null, firstLoadedAt: 100 },
    ]);
  });

  it('devuelve [] cuando la sesión no cargó ninguna skill', () => {
    const messages = [
      assistant([
        completedTool({
          id: 'tool-1',
          name: 'bash',
          input: { command: 'ls' },
          created: 100,
          text: 'src\nspecs\n',
        }),
      ]),
    ];

    expect(deriveSkills(messages)).toEqual([]);
  });
});
