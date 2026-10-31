import { describe, expect, it } from 'vitest';
import type { TGraphNode } from '@app/Domains/Graph';
import type { TSessionGroup } from '@app/Domains/Sessions';
import {
  countRailSessions,
  deriveGraphPaneHeadline,
  HEADLINE_TONE,
} from '../workspaceHeadline';

/**
 * Cabecera del grafo (eyebrow + título) y conteo del rail: funciones puras
 * sobre el resumen ya agregado y los nodos cargados.
 */

const ZERO_COUNTS = {
  runningCount: 0,
  retryingCount: 0,
  compactingCount: 0,
  waitingCount: 0,
  errorCount: 0,
  interruptedCount: 0,
  succeededCount: 0,
  createdCount: 0,
};

const node = (
  sessionId: string,
  title: string | null,
  agentName = 'build',
): TGraphNode =>
  ({
    id: sessionId,
    type: 'agent',
    position: { x: 0, y: 0 },
    data: { sessionId, title, agentName },
  }) as unknown as TGraphNode;

describe('deriveGraphPaneHeadline', () => {
  it('counts the loaded agents and reads the root title', () => {
    const headline = deriveGraphPaneHeadline(
      [node('root', 'refactor-auth-flow'), node('child', 'specs')],
      'root',
      { ...ZERO_COUNTS, runningCount: 1 },
    );

    expect(headline.agentCount).toBe(2);
    expect(headline.title).toBe('refactor-auth-flow');
    expect(headline.statusLabel).toBe('En curso');
    expect(headline.tone).toBe(HEADLINE_TONE.RUNNING);
  });

  it('falls back to the agent name when the root has no title', () => {
    const headline = deriveGraphPaneHeadline(
      [node('root', null, 'sddorch')],
      'root',
      null,
    );

    expect(headline.title).toBe('sddorch');
  });

  it('has no title nor status without a root node or summary', () => {
    const headline = deriveGraphPaneHeadline([], 'root', null);

    expect(headline).toEqual({
      statusLabel: null,
      tone: HEADLINE_TONE.IDLE,
      agentCount: 0,
      title: null,
    });
  });

  it('prioritises a pending wait over activity', () => {
    const headline = deriveGraphPaneHeadline([], null, {
      ...ZERO_COUNTS,
      runningCount: 2,
      waitingCount: 1,
    });

    expect(headline.statusLabel).toBe('Esperando');
    expect(headline.tone).toBe(HEADLINE_TONE.WAITING);
  });

  it('treats retrying/compacting as activity', () => {
    const headline = deriveGraphPaneHeadline([], null, {
      ...ZERO_COUNTS,
      compactingCount: 1,
    });

    expect(headline.tone).toBe(HEADLINE_TONE.RUNNING);
  });

  it('reports an error once nothing is active', () => {
    const headline = deriveGraphPaneHeadline([], null, {
      ...ZERO_COUNTS,
      errorCount: 1,
      succeededCount: 3,
    });

    expect(headline.statusLabel).toBe('Con error');
    expect(headline.tone).toBe(HEADLINE_TONE.ERROR);
  });

  it('labels a finished session as terminated with a neutral tone', () => {
    const headline = deriveGraphPaneHeadline([], null, {
      ...ZERO_COUNTS,
      succeededCount: 3,
    });

    expect(headline.statusLabel).toBe('Terminada');
    expect(headline.tone).toBe(HEADLINE_TONE.IDLE);
  });
});

describe('countRailSessions', () => {
  it('sums the root sessions of every project group', () => {
    const groups = [
      { directory: '/a', items: [{}, {}] },
      { directory: '/b', items: [{}] },
    ] as unknown as TSessionGroup[];

    expect(countRailSessions(groups)).toBe(3);
    expect(countRailSessions([])).toBe(0);
  });
});
