import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TLatencyReport } from '@app/Domains/Graph/Graph.entity';
import {
  latencyAnomaly,
  latencyReport,
  latencySample,
} from '@app/test/latencyFixtures';
import { LatencySection } from '../LatencySection';

const START = new Date(2024, 0, 15, 9, 5).getTime();
const MINUTE = 60_000;

const report = (overrides: Partial<TLatencyReport> = {}): TLatencyReport =>
  latencyReport({
    samples: [
      latencySample({
        stepId: 's1',
        startedAt: START,
        generationMs: 2000,
        totalMs: 2100,
        outputTokens: 300,
        expectedMs: 2000,
      }),
      latencySample({
        stepId: 's2',
        startedAt: START + MINUTE,
        generationMs: 1000,
        totalMs: 31_000,
        toolMs: 30_000,
        topTool: 'shell',
        firstOutputMs: 800,
      }),
      latencySample({
        stepId: 's3',
        startedAt: START + 2 * MINUTE,
        generationMs: 12_000,
        totalMs: 12_100,
        outputTokens: 400,
        expectedMs: 5000,
      }),
    ],
    paces: [{ model: 'p/m', baseMs: 1000, msPerToken: 10, samples: 20 }],
    anomalies: [latencyAnomaly({ stepId: 's3', ratio: 2.4, expectedMs: 5000, excessMs: 7000 })],
    ...overrides,
  });

const renderSection = (props: Partial<Parameters<typeof LatencySection>[0]> = {}) =>
  render(
    <LatencySection
      latency={report()}
      threshold={1}
      onThresholdChange={vi.fn()}
      {...props}
    />,
  );

describe('LatencySection · desglose (FR-018/FR-019)', () => {
  it('reparte el tiempo del nodo entre modelo y herramientas', () => {
    renderSection();

    expect(screen.getByText('Reparto del tiempo')).toBeInTheDocument();
    expect(screen.getByText('Modelo generando')).toBeInTheDocument();
    expect(screen.getByText('15s · 33%')).toBeInTheDocument();
    expect(screen.getByText('Herramientas')).toBeInTheDocument();
    expect(screen.getByText('30s · 67%')).toBeInTheDocument();
  });

  it('explica cada respuesta empezando por la causa principal', () => {
    renderSection();

    const rows = within(screen.getByText('Respuestas').parentElement as HTMLElement)
      .getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('#2 · 09:06');
    expect(rows[1]).toHaveTextContent('total 31s');
    expect(rows[1]).toHaveTextContent(
      'herramientas 30s (shell) · modelo 1.0s · 1.ª salida 800ms',
    );
    expect(rows[0]).toHaveTextContent('modelo 2.0s (300 tok; esperado 2.0s)');
  });

  it('muestra el ritmo esperado de cada modelo', () => {
    renderSection();

    expect(screen.getByText('p/m')).toBeInTheDocument();
    expect(screen.getByText('1.0s + 10.0 ms/tok · 20 resp.')).toBeInTheDocument();
  });

  it('avisa cuando no hay datos para estimar el ritmo', () => {
    renderSection({ latency: report({ paces: [], anomalies: [] }) });

    expect(screen.getByText(/sin datos suficientes/)).toBeInTheDocument();
  });
});

describe('LatencySection · respuestas lentas (FR-021/FR-023)', () => {
  it('marca la respuesta lenta con texto y la lista con su magnitud', () => {
    renderSection();

    const badge = screen.getByText('Lenta ×2.4');
    expect(badge).toHaveClass('text-status-error', 'border-status-error/80');
    expect(screen.getByText('Respuestas lentas')).toBeInTheDocument();
    expect(screen.getByText('×2.4 · +7.0s sobre 5.0s')).toBeInTheDocument();
  });

  it('sin anomalías no muestra la lista de lentas ni ninguna marca de rapidez', () => {
    renderSection({ latency: report({ anomalies: [] }) });

    expect(screen.queryByText('Respuestas lentas')).not.toBeInTheDocument();
    expect(screen.queryByText(/Rápida/)).not.toBeInTheDocument();
  });
});

describe('LatencySection · umbral (FR-022)', () => {
  it('cambia el umbral desde un control accesible y explica qué significa', () => {
    const onThresholdChange = vi.fn();
    renderSection({ onThresholdChange });

    const slider = screen.getByRole('slider', {
      name: 'Umbral de lentitud: ×2.0 lo esperado',
    });
    expect(slider).toHaveValue('100');
    expect(slider).toHaveAccessibleDescription(/al menos 5.0s/);

    fireEvent.change(slider, { target: { value: '150' } });
    expect(onThresholdChange).toHaveBeenCalledWith(1.5);
  });

  it('amplía el área interactiva del umbral a ≥24 px sin perder foco (SC-007)', () => {
    renderSection();

    const slider = screen.getByRole('slider');
    expect(slider).toHaveClass('h-6');
    slider.focus();
    expect(slider).toHaveFocus();
  });
});

describe('LatencySection · estados de pantalla', () => {
  it('representa el estado vacío sin inventar valores', () => {
    renderSection({ latency: null });

    expect(screen.getByText('Sin respuestas medidas')).toBeInTheDocument();
    expect(screen.queryByText('Reparto del tiempo')).not.toBeInTheDocument();
  });

  it('representa los estados de carga y error', () => {
    const { rerender } = render(
      <LatencySection latency={null} threshold={1} onThresholdChange={vi.fn()} isLoading />,
    );
    expect(screen.queryByText('Sin respuestas medidas')).not.toBeInTheDocument();

    rerender(
      <LatencySection latency={null} threshold={1} onThresholdChange={vi.fn()} isError />,
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
