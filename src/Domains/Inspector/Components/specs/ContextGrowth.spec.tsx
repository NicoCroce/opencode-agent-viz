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

  it('anima el trazo solo cuando no se pide movimiento reducido', () => {
    stubReducedMotion(false);
    const { container } = render(<ContextGrowth points={points} />);
    expect(container.querySelector('polyline')).toHaveClass('growth-draw');
  });

  it('deja la línea estática con `prefers-reduced-motion`', () => {
    stubReducedMotion(true);
    const { container } = render(<ContextGrowth points={points} />);

    const line = container.querySelector('polyline');
    expect(line).not.toHaveClass('growth-draw');
    expect(line).toHaveAttribute('points');
  });
});
