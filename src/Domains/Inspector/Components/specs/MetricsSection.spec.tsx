import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { TNodeMetrics } from '@app/Domains/Graph/Graph.entity';
import { MetricsSection } from '../MetricsSection';

const makeMetrics = (overrides: Partial<TNodeMetrics> = {}): TNodeMetrics => ({
  durationMs: 3000,
  startedAt: 0,
  endedAt: 3000,
  cost: 0.02,
  tokens: null,
  invocations: 2,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
  ...overrides,
});

/** Acota las consultas a la sección `Métricas` (su contenedor raíz). */
const withinMetricsSection = () => {
  const heading = screen.getByText('Métricas');
  return within(heading.parentElement as HTMLElement);
};

describe('MetricsSection', () => {
  it('renders the loop warning inside Métricas when hasLoop is true', () => {
    render(
      <MetricsSection
        metrics={makeMetrics({
          hasLoop: true,
          retryCount: 2,
          loopEvidence: ['Misma herramienta repetida 3 veces'],
        })}
      />,
    );

    const section = withinMetricsSection();
    expect(section.getByText('Posible loop · 2 reintentos')).toBeInTheDocument();
    expect(
      section.getByText('Misma herramienta repetida 3 veces'),
    ).toBeInTheDocument();
  });

  it('uses the singular form for a single retry', () => {
    render(
      <MetricsSection
        metrics={makeMetrics({
          hasLoop: true,
          retryCount: 1,
          loopEvidence: ['Reintento detectado'],
        })}
      />,
    );

    expect(
      withinMetricsSection().getByText('Posible loop · 1 reintento'),
    ).toBeInTheDocument();
  });

  it('does not render the loop warning when hasLoop is false', () => {
    render(
      <MetricsSection
        metrics={makeMetrics({
          hasLoop: false,
          retryCount: 3,
          loopEvidence: ['Evidencia que no debe mostrarse'],
        })}
      />,
    );

    expect(screen.queryByText(/Posible loop/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Evidencia que no debe mostrarse'),
    ).not.toBeInTheDocument();
  });
});
