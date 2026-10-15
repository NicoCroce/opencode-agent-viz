import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  latencyAnomaly,
  latencyReport,
  latencySample,
} from '@app/test/latencyFixtures';
import type { TLatencyReport } from '../../Graph.entity';
import { AgentNodeLatencyMark } from '../AgentNodeLatencyMark';

const report = (overrides: Partial<TLatencyReport> = {}): TLatencyReport =>
  latencyReport({
    samples: [
      latencySample({ stepId: 's1', startedAt: 0 }),
      latencySample({ stepId: 's2', startedAt: 1000 }),
    ],
    ...overrides,
  });

describe('AgentNodeLatencyMark · L8 (FR-021/FR-023)', () => {
  it('marca la última respuesta lenta con texto, color y la magnitud en la etiqueta', () => {
    render(
      <AgentNodeLatencyMark
        latency={report({ anomalies: [latencyAnomaly({ stepId: 's2', ratio: 2.4 })] })}
      />,
    );

    const mark = screen.getByTestId('node-latency-mark');
    expect(mark).toHaveTextContent('▲ lenta');
    expect(mark).toHaveAccessibleName(
      'Respuesta lenta: ×2.4 lo esperado para sus tokens',
    );
    expect(mark).toHaveClass('text-status-error');
    expect(mark).toHaveClass('border-status-error/80');
  });

  it('no marca cuando la anomalía es de una respuesta anterior, no la última', () => {
    render(
      <AgentNodeLatencyMark
        latency={report({ anomalies: [latencyAnomaly({ stepId: 's1', ratio: 3 })] })}
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
