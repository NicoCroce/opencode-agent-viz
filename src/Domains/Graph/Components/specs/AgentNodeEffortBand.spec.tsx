import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentNodeEffortBand } from '../AgentNodeEffortBand';
import type { TNodeEffort } from '../../Graph.entity';

/**
 * Banda de esfuerzo (effort-contract §5): etiqueta `esfuerzo` + barra de 5
 * segmentos + nivel `N/5`. Etiqueta y nivel son `aria-hidden` (la semántica la
 * da el medidor) y la banda no se renderiza sin esfuerzo.
 */
const effort = (overrides: Partial<TNodeEffort> = {}): TNodeEffort => ({
  level: 3,
  provisional: false,
  reasons: ['lanzó paralelos', 'supera 2× la línea'],
  ...overrides,
});

describe('AgentNodeEffortBand', () => {
  it('shows the label, the meter and the level for a final effort', () => {
    render(<AgentNodeEffortBand effort={effort({ level: 3 })} />);

    expect(screen.getByText('esfuerzo')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /^Esfuerzo 3 de 5/ }),
    ).toBeInTheDocument();
  });

  it('marks a provisional effort in the label', () => {
    render(<AgentNodeEffortBand effort={effort({ provisional: true })} />);

    expect(screen.getByText('esfuerzo · provisional')).toBeInTheDocument();
  });

  it('hides the label and the level from assistive tech (the meter carries the label)', () => {
    render(<AgentNodeEffortBand effort={effort()} />);

    expect(screen.getByText('esfuerzo')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('3/5')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing without effort', () => {
    const { container } = render(<AgentNodeEffortBand effort={null} />);
    expect(container).toBeEmptyDOMElement();

    const { container: undefinedRender } = render(
      <AgentNodeEffortBand effort={undefined} />,
    );
    expect(undefinedRender).toBeEmptyDOMElement();
  });
});
