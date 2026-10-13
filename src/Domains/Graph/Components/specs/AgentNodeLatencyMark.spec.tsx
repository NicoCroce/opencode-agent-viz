import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TLatencyReport } from '../../Graph.entity';
import { AgentNodeLatencyMark } from '../AgentNodeLatencyMark';

const report = (overrides: Partial<TLatencyReport> = {}): TLatencyReport => ({
  samples: [
    { stepId: 's1', startedAt: 0, ttftMs: 100, totalMs: 1000 },
    { stepId: 's2', startedAt: 1000, ttftMs: 120, totalMs: 1100 },
  ],
  medianMs: 1000,
  reference: 'node',
  anomalies: [],
  ...overrides,
});

describe('AgentNodeLatencyMark · L8 (FR-021/FR-023)', () => {
  it('marca la última respuesta lenta con texto y color', () => {
    render(
      <AgentNodeLatencyMark
        latency={report({
          anomalies: [
            {
              stepId: 's2',
              ratio: 2.4,
              direction: 'slow',
              referenceMs: 1000,
              reference: 'node',
            },
          ],
        })}
      />,
    );

    const mark = screen.getByTestId('node-latency-mark');
    expect(mark).toHaveTextContent('lenta');
    expect(mark).toHaveAccessibleName('Respuesta lenta');
    expect(mark).toHaveClass('text-status-error');
    expect(mark).toHaveClass('border-status-error/80');
  });

  it('marca la rapidez anómala de la última respuesta (bidireccional)', () => {
    render(
      <AgentNodeLatencyMark
        latency={report({
          anomalies: [
            {
              stepId: 's2',
              ratio: 0.3,
              direction: 'fast',
              referenceMs: 1000,
              reference: 'agent',
            },
          ],
        })}
      />,
    );

    const mark = screen.getByTestId('node-latency-mark');
    expect(mark).toHaveTextContent('rápida');
    expect(mark).toHaveAccessibleName('Respuesta rápida');
    expect(mark).toHaveClass('text-status-waiting');
    expect(mark).toHaveClass('border-status-waiting/80');
  });

  it('no marca cuando la anomalía es de una respuesta anterior, no la última', () => {
    render(
      <AgentNodeLatencyMark
        latency={report({
          anomalies: [
            {
              stepId: 's1',
              ratio: 3,
              direction: 'slow',
              referenceMs: 1000,
              reference: 'node',
            },
          ],
        })}
      />,
    );

    expect(screen.queryByTestId('node-latency-mark')).not.toBeInTheDocument();
  });

  it('no marca sin serie ni anomalías', () => {
    render(<AgentNodeLatencyMark latency={report()} />);
    expect(screen.queryByTestId('node-latency-mark')).not.toBeInTheDocument();

    render(<AgentNodeLatencyMark latency={null} />);
    expect(screen.queryByTestId('node-latency-mark')).not.toBeInTheDocument();
  });
});
