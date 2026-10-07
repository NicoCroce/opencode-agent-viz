import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { GutterNode, type TGutterNodeData } from '../ExecutionLanes';
import type { TNodeStatus } from '../../Graph.entity';

const pad = (value: number): string => String(value).padStart(2, '0');

const stamp = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const START = new Date(2024, 0, 15, 9, 5).getTime();
const END = new Date(2024, 0, 15, 17, 42).getTime();

const data: TGutterNodeData = {
  level: 0,
  startedAt: START,
  endedAt: END,
  count: 1,
  status: 'succeeded',
  active: false,
};

const renderGutter = (overrides: Partial<TGutterNodeData> = {}) =>
  render(
    <GutterNode
      {...({
        id: 'gutter-0',
        type: 'gutter',
        data: { ...data, ...overrides },
        selected: false,
        dragging: false,
        zIndex: 0,
        isConnectable: false,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
      } as unknown as ComponentProps<typeof GutterNode>)}
    />,
  );

describe('GutterNode — ventana temporal', () => {
  it('shows the start and end date-time range', () => {
    renderGutter();

    expect(
      screen.getByText(`${stamp(START)} – ${stamp(END)}`),
    ).toBeInTheDocument();
  });

  it('shows "en curso" as the end while the level is running', () => {
    renderGutter({ status: 'running' });

    expect(
      screen.getByText(`${stamp(START)} – en curso`),
    ).toBeInTheDocument();
  });

  it('keeps the duration and the agent count', () => {
    renderGutter({ count: 3 });

    expect(screen.getByText('8h 37m')).toBeInTheDocument();
    expect(screen.getByText('∥ 3 en paralelo')).toBeInTheDocument();
  });

  it('labels a single-agent level as "1 agente"', () => {
    renderGutter();

    expect(screen.getByText('1 agente')).toBeInTheDocument();
  });
});

describe('GutterNode — punto de estado (STATUS_DOT, 9 estados)', () => {
  const dotClass = (status: TNodeStatus): string => {
    const { container } = renderGutter({ status });
    return container.querySelector('.rounded-full')?.className ?? '';
  };

  it.each([
    ['created', 'bg-status-idle'],
    ['running', 'bg-status-running'],
    ['retrying', 'bg-status-running'],
    ['compacting', 'bg-status-running'],
    ['waiting-permission', 'bg-status-waiting'],
    ['waiting-input', 'bg-status-waiting'],
    ['succeeded', 'bg-status-done'],
    ['failed', 'bg-status-error'],
    ['interrupted', 'bg-status-error'],
  ] as const)('colorea %s con %s', (status, expected) => {
    expect(dotClass(status)).toContain(expected);
  });

  it.each([
    'retrying',
    'compacting',
    'waiting-permission',
    'waiting-input',
  ] as const)('trata %s como activo ("en curso")', (status) => {
    renderGutter({ status });

    expect(
      screen.getByText(`${stamp(START)} – en curso`),
    ).toBeInTheDocument();
  });
});
