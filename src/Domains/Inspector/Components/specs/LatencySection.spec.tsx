import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TLatencyReport } from '@app/Domains/Graph/Graph.entity';
import { LatencySection } from '../LatencySection';

const START = new Date(2024, 0, 15, 9, 5).getTime();
const MINUTE = 60_000;

const report = (overrides: Partial<TLatencyReport> = {}): TLatencyReport => ({
  samples: [
    { stepId: 's1', startedAt: START, ttftMs: 100, totalMs: 1000 },
    { stepId: 's2', startedAt: START + MINUTE, ttftMs: 120, totalMs: 2000 },
    { stepId: 's3', startedAt: START + 2 * MINUTE, ttftMs: 900, totalMs: 4000 },
  ],
  medianMs: 2000,
  reference: 'node',
  anomalies: [
    {
      stepId: 's3',
      ratio: 2,
      direction: 'slow',
      referenceMs: 2000,
      reference: 'node',
    },
  ],
  ...overrides,
});

const renderSection = (props: Partial<Parameters<typeof LatencySection>[0]> = {}) =>
  render(
    <LatencySection
      latency={report()}
      threshold={0.4}
      onThresholdChange={vi.fn()}
      {...props}
    />,
  );

describe('LatencySection · L9 (FR-019/FR-023)', () => {
  it('lista la serie de TTFT y latencia total por respuesta', () => {
    renderSection();

    expect(screen.getByTestId('latency-section')).toHaveTextContent('Latencia');
    expect(screen.getByText('#1 · 09:05')).toBeInTheDocument();
    expect(screen.getByText('TTFT 100ms')).toBeInTheDocument();
    expect(screen.getByText('total 1s')).toBeInTheDocument();
    expect(screen.getByText('#3 · 09:07')).toBeInTheDocument();
    expect(screen.getByText('TTFT 900ms')).toBeInTheDocument();
    expect(screen.getByText('total 4s')).toBeInTheDocument();
  });

  it('muestra la mediana de referencia y su origen', () => {
    renderSection();

    expect(screen.getByText('Referencia')).toBeInTheDocument();
    expect(screen.getByText('2s · mediana del nodo')).toBeInTheDocument();
  });

  it('lista las anomalías con magnitud y referencia', () => {
    renderSection();

    expect(screen.getByText('Anomalías')).toBeInTheDocument();
    // El texto de magnitud incluye ratio, referencia y origen.
    expect(screen.getByText('×2.0 · 2s · mediana del nodo')).toBeInTheDocument();
    // La dirección se etiqueta en texto (no solo color): en la fila de serie y
    // en la lista de anomalías.
    expect(screen.getAllByText('Lenta')).toHaveLength(2);
  });

  it('distingue la rapidez anómala con etiqueta textual', () => {
    renderSection({
      latency: report({
        anomalies: [
          {
            stepId: 's3',
            ratio: 0.3,
            direction: 'fast',
            referenceMs: 2000,
            reference: 'agent',
          },
        ],
      }),
    });

    expect(screen.getAllByText('Rápida').length).toBeGreaterThan(0);
    expect(
      screen.getByText('×0.3 · 2s · mediana del agente'),
    ).toBeInTheDocument();
  });

  it('cambia el umbral desde un control accesible', () => {
    const onThresholdChange = vi.fn();
    renderSection({ onThresholdChange });

    const slider = screen.getByRole('slider', {
      name: 'Umbral de anomalía ±40%',
    });
    expect(slider).toHaveValue('40');

    fireEvent.change(slider, { target: { value: '60' } });
    expect(onThresholdChange).toHaveBeenCalledWith(0.6);
  });

  it('amplía el área interactiva del umbral a ≥24 px sin perder etiqueta ni foco (SC-007)', () => {
    renderSection();

    const slider = screen.getByRole('slider', {
      name: 'Umbral de anomalía ±40%',
    });

    // 24 px de alto (objetivo táctil) conservando el control nativo.
    expect(slider).toHaveClass('h-6');
    // La etiqueta accesible no cambia y el control sigue enfocable por teclado.
    expect(slider).toHaveAttribute('aria-label', 'Umbral de anomalía ±40%');
    slider.focus();
    expect(slider).toHaveFocus();
  });

  it('refuerza el contraste del borde de la anomalía lenta a ≥/80 (SC-007)', () => {
    renderSection();

    expect(
      screen
        .getAllByText('Lenta')
        .some((node) => node.classList.contains('border-status-error/80')),
    ).toBe(true);
  });

  it('refuerza el contraste del borde de la anomalía rápida a ≥/80 (SC-007)', () => {
    renderSection({
      latency: report({
        anomalies: [
          {
            stepId: 's3',
            ratio: 0.3,
            direction: 'fast',
            referenceMs: 2000,
            reference: 'agent',
          },
        ],
      }),
    });

    expect(
      screen
        .getAllByText('Rápida')
        .some((node) => node.classList.contains('border-status-waiting/80')),
    ).toBe(true);
  });

  it('representa el estado vacío sin inventar valores', () => {
    renderSection({ latency: null });

    expect(screen.getByText('Sin respuestas medidas')).toBeInTheDocument();
    expect(screen.queryByText('Referencia')).not.toBeInTheDocument();
  });

  it('representa los estados de carga y error', () => {
    const { rerender } = render(
      <LatencySection latency={null} threshold={0.4} onThresholdChange={vi.fn()} isLoading />,
    );
    expect(screen.queryByText('Sin respuestas medidas')).not.toBeInTheDocument();

    rerender(
      <LatencySection latency={null} threshold={0.4} onThresholdChange={vi.fn()} isError />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
