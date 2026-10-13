import { describe, expect, it } from 'vitest';
import { deriveResources } from '../deriveResources';

/**
 * Contexto (T041/T045 proveen la derivación pura `deriveSkills`): este spec fija que
 * `deriveResources` **propaga** las skills ya derivadas a `TResourceUsage.skills`
 * en lugar del `skills: []` hardcodeado (`contracts/inspector-skills-contract.md` §2, FR-009).
 */
const skills = [
  {
    name: 'frontend-design',
    count: 2,
    estTokens: 3400,
    firstLoadedAt: 1_710_000_000_000,
  },
  {
    name: 'test-generator',
    count: 1,
    estTokens: null,
    firstLoadedAt: 1_710_000_005_000,
  },
];

const base = {
  mcpServers: [{ name: 'context7', status: { status: 'connected' as const } }],
  instructions: [
    { key: '.opencode/instructions/app.instructions.md', value: null },
  ],
  tools: ['bash', 'read'],
};

describe('deriveResources', () => {
  it('propaga las skills ya derivadas al view-model', () => {
    const resources = deriveResources({ ...base, skills });

    expect(resources.skills).toEqual(skills);
  });

  it('preserva el orden de las skills recibidas', () => {
    const resources = deriveResources({ ...base, skills });

    expect(resources.skills.map((skill) => skill.name)).toEqual([
      'frontend-design',
      'test-generator',
    ]);
  });

  it('no inventa skills cuando no hay ninguna derivada', () => {
    const resources = deriveResources({ ...base, skills: [] });

    expect(resources.skills).toEqual([]);
  });

  it('mantiene MCP, instrucciones y tools sin cambios', () => {
    const resources = deriveResources({ ...base, skills });

    expect(resources.mcpServers).toEqual([{ name: 'context7', status: 'connected' }]);
    expect(resources.instructions).toEqual([
      '.opencode/instructions/app.instructions.md',
    ]);
    expect(resources.tools).toEqual(['bash', 'read']);
    expect(resources.availability).toBe('available');
  });

  it('no muta las skills derivadas que recibe', () => {
    deriveResources({ ...base, skills });

    expect(skills.map((skill) => skill.name)).toEqual([
      'frontend-design',
      'test-generator',
    ]);
  });
});
