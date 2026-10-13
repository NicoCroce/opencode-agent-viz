import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TParentImpact } from '@app/Domains/Graph/Graph.entity';
import { ParentImpactRow } from '../ParentImpactRow';

const impact = (overrides: Partial<TParentImpact> = {}): TParentImpact => ({
  parentId: 'parent',
  addedChars: 420,
  addedTokens: 1200,
  pctOfParent: 12.5,
  ...overrides,
});

describe('ParentImpactRow · S4/S8 (FR-012..FR-014)', () => {
  it('muestra caracteres, porcentaje y tokens aportados', () => {
    render(<ParentImpactRow impact={impact()} />);

    expect(screen.getByText('Aporte al padre')).toBeInTheDocument();
    expect(screen.getByText('Caracteres aportados')).toBeInTheDocument();
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('1.2k')).toBeInTheDocument();
  });

  it('navega al padre desde un control operable por teclado', () => {
    const onNavigate = vi.fn();
    render(
      <ParentImpactRow
        impact={impact()}
        parentTitle="Agente raíz"
        onNavigate={onNavigate}
      />,
    );

    const control = screen.getByRole('button', {
      name: 'Ir al agente padre: Agente raíz',
    });
    control.focus();
    expect(control).toHaveFocus();

    control.click();
    expect(onNavigate).toHaveBeenCalledWith('parent');
  });

  it('cae a "no disponible" sin porcentaje ni tokens', () => {
    render(
      <ParentImpactRow impact={impact({ pctOfParent: null, addedTokens: null })} />,
    );

    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('muestra el estado vacío cuando no hay aporte', () => {
    render(<ParentImpactRow impact={null} />);

    expect(screen.getByText('Sin aporte al padre')).toBeInTheDocument();
    expect(screen.queryByText('Caracteres aportados')).not.toBeInTheDocument();
  });

  it('representa los estados de carga y error', () => {
    const { rerender } = render(<ParentImpactRow impact={null} isLoading />);
    expect(screen.queryByText('Sin aporte al padre')).not.toBeInTheDocument();

    rerender(<ParentImpactRow impact={null} isError />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
