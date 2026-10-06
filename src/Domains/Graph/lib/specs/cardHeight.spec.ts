import { describe, expect, it } from 'vitest';
import type { TGraphNodeData } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { cardHeight } from '../cardHeight';
import { NODE_WIDTH } from '../layoutGraph';
import { MIN_NODE_HEIGHT } from '../nodeResize';

const data = (overrides: Partial<TGraphNodeData> = {}): TGraphNodeData => ({
  sessionId: 'root',
  title: 'Tarea corta',
  createdAt: null,
  updatedAt: null,
  agentName: 'develop',
  directory: '/repo',
  model: null,
  status: 'done',
  metrics: { ...EMPTY_METRICS },
  isRoot: true,
  currentTool: null,
  parallel: null,
  ...overrides,
});

describe('cardHeight', () => {
  it('grows when the model line is present', () => {
    const withoutModel = cardHeight(data(), NODE_WIDTH);
    const withModel = cardHeight(
      data({
        model: { providerID: 'opencode-go', id: 'deepseek-v4.1-flash' },
      }),
      NODE_WIDTH,
    );

    expect(withModel).toBeGreaterThan(withoutModel);
  });

  it('grows with the current-tool line', () => {
    const withoutTool = cardHeight(data(), NODE_WIDTH);
    const withTool = cardHeight(
      data({ currentTool: { name: 'bash', state: 'running' } }),
      NODE_WIDTH,
    );

    expect(withTool).toBeGreaterThan(withoutTool);
  });

  it('gives a long title two lines and a short title one', () => {
    const short = cardHeight(data({ title: 'Corta' }), NODE_WIDTH);
    const long = cardHeight(
      data({ title: 'Definiciones de ejecuciones multi subajentes en Speckit' }),
      NODE_WIDTH,
    );

    expect(long).toBeGreaterThan(short);
  });

  it('grows with the node width shrinking (longer model wraps)', () => {
    const model = {
      providerID: 'opencode-go',
      id: 'deepseek-v4.1-flash',
    };
    const wide = cardHeight(data({ model }), 420);
    const narrow = cardHeight(data({ model }), 220);

    expect(narrow).toBeGreaterThanOrEqual(wide);
  });

  it('never returns less than the minimum node height', () => {
    expect(cardHeight(data({ title: '' }), NODE_WIDTH)).toBeGreaterThanOrEqual(
      MIN_NODE_HEIGHT,
    );
  });
});
