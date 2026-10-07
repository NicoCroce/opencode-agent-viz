import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvancedSection } from '../AdvancedSection';

const CONTENT = 'Herramientas';

describe('AdvancedSection', () => {
  it('starts collapsed and does not mount its children', () => {
    render(
      <AdvancedSection>
        <p>{CONTENT}</p>
      </AdvancedSection>,
    );

    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();

    const control = screen.getByRole('button', { name: 'Avanzado' });
    expect(control).toHaveAttribute('aria-expanded', 'false');
  });

  it('links the control to its content region via aria-controls', async () => {
    const user = userEvent.setup();
    render(
      <AdvancedSection>
        <p>{CONTENT}</p>
      </AdvancedSection>,
    );

    const control = screen.getByRole('button', { name: 'Avanzado' });
    const regionId = control.getAttribute('aria-controls');
    expect(regionId).toBeTruthy();

    await user.click(control);

    const region = screen.getByRole('region', { name: 'Avanzado' });
    expect(region).toHaveAttribute('id', regionId);
  });

  it('mounts the children on expand and unmounts them on collapse', async () => {
    const user = userEvent.setup();
    render(
      <AdvancedSection>
        <p>{CONTENT}</p>
      </AdvancedSection>,
    );

    const control = screen.getByRole('button', { name: 'Avanzado' });

    await user.click(control);

    expect(control).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(CONTENT)).toBeInTheDocument();

    await user.click(control);

    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
  });

  it('accepts defaultExpanded and starts open', () => {
    render(
      <AdvancedSection defaultExpanded>
        <p>{CONTENT}</p>
      </AdvancedSection>,
    );

    expect(
      screen.getByRole('button', { name: 'Avanzado' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });

  it('supports a controlled mode that delegates toggling to onToggle', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    const { rerender } = render(
      <AdvancedSection expanded={false} onToggle={onToggle}>
        <p>{CONTENT}</p>
      </AdvancedSection>,
    );

    const control = screen.getByRole('button', { name: 'Avanzado' });
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();

    await user.click(control);

    // Modo controlado: no alterna por sí solo, delega la decisión en onToggle.
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();

    rerender(
      <AdvancedSection expanded onToggle={onToggle}>
        <p>{CONTENT}</p>
      </AdvancedSection>,
    );

    expect(
      screen.getByRole('button', { name: 'Avanzado' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });
});
