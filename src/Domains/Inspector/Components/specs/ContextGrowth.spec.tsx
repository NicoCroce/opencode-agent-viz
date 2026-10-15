import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TContextGrowthPoint } from '@app/Domains/Graph/Graph.entity';
import { ContextGrowth } from '../ContextGrowth';

const points: TContextGrowthPoint[] = [
  { stepId: 'a1', startedAt: 10, windowTokens: 1000 },
  { stepId: 'a2', startedAt: 20, windowTokens: 4000 },
  { stepId: 'a3', startedAt: 30, windowTokens: 2500 },
];

const stubReducedMotion = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

afterEach(() => vi.unstubAllGlobals());

describe('ContextGrowth · FR-016', () => {
  it('resume la tendencia en la etiqueta accesible y en texto visible', () => {
    render(<ContextGrowth points={points} />);

    const chart = screen.getByRole('img', {
      name: 'Evolución del contexto: 3 pasos, de 1.0k a 2.5k tokens',
    });
    expect(chart.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText('1.0k → 2.5k tok · 3 pasos')).toBeInTheDocument();
  });

  it('no dibuja nada sin puntos', () => {
    render(<ContextGrowth points={[]} />);

    expect(screen.queryByTestId('context-growth')).not.toBeInTheDocument();
  });

  it('con un solo punto muestra el valor sin sparkline', () => {
    render(<ContextGrowth points={[points[0]]} />);

    expect(
      screen.getByRole('img', {
        name: 'Evolución del contexto: 1 paso, de 1.0k a 1.0k tokens',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('1.0k → 1.0k tok · 1 paso')).toBeInTheDocument();
  });

  it('anima la aparición con un recorte, sin guiones en el trazo', () => {
    stubReducedMotion(false);
    const { container } = render(<ContextGrowth points={points} />);

    expect(container.querySelector('svg')).toHaveClass('growth-reveal');
    // Un guion con `pathLength` y `non-scaling-stroke` deja huecos al estirar.
    const line = container.querySelector('polyline');
    expect(line).not.toHaveAttribute('pathLength');
    expect(line).not.toHaveAttribute('stroke-dasharray');
  });

  it('deja el gráfico estático con `prefers-reduced-motion`', () => {
    stubReducedMotion(true);
    const { container } = render(<ContextGrowth points={points} />);

    expect(container.querySelector('svg')).not.toHaveClass('growth-reveal');
    expect(container.querySelector('polyline')).toHaveAttribute('points');
  });

  it('marca cada compactación y la cuenta en el resumen', () => {
    render(
      <ContextGrowth
        points={points}
        compactions={[
          { id: 'c1', at: 15, status: 'completed', reason: 'auto' },
          { id: 'c2', at: 25, status: 'failed', reason: 'auto' },
        ]}
      />,
    );

    expect(screen.getAllByTestId('context-growth-compaction')).toHaveLength(2);
    expect(
      screen.getByRole('img', {
        name: 'Evolución del contexto: 3 pasos, de 1.0k a 2.5k tokens, 2 compactaciones',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1.0k → 2.5k tok · 3 pasos · 2 compactaciones'),
    ).toBeInTheDocument();
  });

  it('con el límite del modelo dibuja su línea y lo nombra', () => {
    render(<ContextGrowth points={points} limitTokens={200_000} />);

    expect(screen.getByTestId('context-growth-limit')).toBeInTheDocument();
    expect(
      screen.getByText('1.0k → 2.5k tok · 3 pasos · límite 200.0k'),
    ).toBeInTheDocument();
  });

  it('sin límite conocido no dibuja la línea del límite', () => {
    render(<ContextGrowth points={points} />);

    expect(screen.queryByTestId('context-growth-limit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('context-growth-compaction')).not.toBeInTheDocument();
  });
});
