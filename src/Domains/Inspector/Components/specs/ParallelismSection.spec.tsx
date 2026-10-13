import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TNodeSpeedup } from '@app/Domains/Graph/Graph.entity';
import { ParallelismSection } from '../ParallelismSection';

const speedup = (overrides: Partial<TNodeSpeedup> = {}): TNodeSpeedup => ({
  groupId: 'g1',
  size: 3,
  serialMs: 240_000,
  wallMs: 100_000,
  speedup: 2.4,
  efficiency: 0.8,
  provisional: false,
  ...overrides,
});

describe('ParallelismSection · S5 (FR-009)', () => {
  it('muestra tamaño, serial, real, aceleración y eficiencia', () => {
    render(<ParallelismSection speedup={speedup()} />);

    const section = screen.getByTestId('parallelism-section');
    expect(section).toHaveTextContent('Paralelismo');
    expect(screen.getByText('Agentes en paralelo')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Tiempo en serie')).toBeInTheDocument();
    expect(screen.getByText('4m 0s')).toBeInTheDocument();
    expect(screen.getByText('Tiempo real')).toBeInTheDocument();
    expect(screen.getByText('1m 40s')).toBeInTheDocument();
    expect(screen.getByText('Aceleración')).toBeInTheDocument();
    expect(screen.getByText('×2.4')).toBeInTheDocument();
    expect(screen.getByText('Eficiencia')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('etiqueta la aceleración provisional en texto', () => {
    render(<ParallelismSection speedup={speedup({ provisional: true })} />);

    expect(screen.getByText('provisional')).toBeInTheDocument();
  });

  it('no se renderiza cuando el nodo corrió solo', () => {
    render(<ParallelismSection speedup={null} />);

    expect(screen.queryByTestId('parallelism-section')).not.toBeInTheDocument();
  });

  it('no se renderiza sin aceleración calculable', () => {
    render(<ParallelismSection speedup={speedup({ speedup: null })} />);

    expect(screen.queryByTestId('parallelism-section')).not.toBeInTheDocument();
  });

  it('cae a "no disponible" en serial/eficiencia ausentes (SC-007)', () => {
    render(
      <ParallelismSection
        speedup={speedup({ serialMs: null, efficiency: null })}
      />,
    );

    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
