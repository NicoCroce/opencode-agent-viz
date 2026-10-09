import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EffortMeter } from '../EffortMeter';
import type { TNodeEffort } from '../../Graph.entity';

/**
 * S9 (effort-contract §5; FR-026/FR-027): el medidor de esfuerzo es una regleta
 * de 5 muescas de solo lectura. Se encienden `level` muescas, expone `role="img"`
 * con `aria-label` "Esfuerzo N de 5: <reasons>", atenúa sus muescas mientras el
 * nivel es provisional y nunca es un control.
 */
const effort = (overrides: Partial<TNodeEffort> = {}): TNodeEffort => ({
  level: 3,
  provisional: false,
  reasons: ['lanzó paralelos', 'supera 2× la línea'],
  ...overrides,
});

const litNotches = (): HTMLElement[] =>
  screen
    .getAllByTestId('effort-notch')
    .filter((notch) => notch.dataset.lit === 'true');

describe('EffortMeter — muescas (S9)', () => {
  it('renders five notches and lights exactly `level` of them', () => {
    render(<EffortMeter effort={effort({ level: 3 })} />);

    expect(screen.getAllByTestId('effort-notch')).toHaveLength(5);
    expect(litNotches()).toHaveLength(3);
  });

  it('lights one notch at the base level and five at the top level', () => {
    const { unmount } = render(<EffortMeter effort={effort({ level: 1, reasons: [] })} />);
    expect(litNotches()).toHaveLength(1);
    unmount();

    render(<EffortMeter effort={effort({ level: 5 })} />);
    expect(litNotches()).toHaveLength(5);
  });

  it('paints lit notches with --primary and unlit ones with a neutral token', () => {
    render(<EffortMeter effort={effort({ level: 2 })} />);
    const notches = screen.getAllByTestId('effort-notch');

    expect(notches[0]).toHaveClass('bg-primary');
    expect(notches[1]).toHaveClass('bg-primary');
    expect(notches[2]).toHaveClass('bg-border');
    expect(notches[4]).toHaveClass('bg-border');
  });
});

describe('EffortMeter — accesibilidad (S9, FR-026/FR-027)', () => {
  it('exposes an img role with the "Esfuerzo N de 5: <reasons>" label', () => {
    render(<EffortMeter effort={effort()} />);

    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Esfuerzo 3 de 5: lanzó paralelos, supera 2× la línea',
    );
  });

  it('is read-only: not a control and not focusable', () => {
    render(<EffortMeter effort={effort()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).not.toHaveAttribute('tabindex');
  });
});

describe('EffortMeter — provisional (S9)', () => {
  it('attenuates the notches while the effort is provisional', () => {
    render(<EffortMeter effort={effort({ provisional: true })} />);

    const meter = screen.getByRole('img');
    expect(meter).toHaveClass('opacity-60');
    expect(meter).toHaveAttribute('data-provisional', 'true');
  });

  it('does not attenuate a final effort', () => {
    render(<EffortMeter effort={effort({ provisional: false })} />);

    const meter = screen.getByRole('img');
    expect(meter).not.toHaveClass('opacity-60');
    expect(meter).toHaveAttribute('data-provisional', 'false');
  });
});

describe('EffortMeter — sin esfuerzo', () => {
  it('renders nothing when effort is null', () => {
    const { container } = render(<EffortMeter effort={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when effort is undefined', () => {
    const { container } = render(<EffortMeter effort={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
