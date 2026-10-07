import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorsSection } from '../ErrorsSection';

describe('ErrorsSection', () => {
  it('shows the section header and an explicit empty state when there are no errors', () => {
    render(<ErrorsSection errors={[]} />);

    expect(screen.getByText('Errores')).toBeInTheDocument();
    expect(screen.getByText('Sin errores.')).toBeInTheDocument();
  });

  it('lists one row per error message', () => {
    render(
      <ErrorsSection
        errors={[
          { message: 'Fallo de red', at: 0 },
          { message: 'Timeout del modelo', at: 1000 },
        ]}
      />,
    );

    expect(screen.getByText('Fallo de red')).toBeInTheDocument();
    expect(screen.getByText('Timeout del modelo')).toBeInTheDocument();
    expect(screen.queryByText('Sin errores.')).not.toBeInTheDocument();
  });

  it('renders each error message with the error status style', () => {
    render(<ErrorsSection errors={[{ message: 'Fallo de red', at: 0 }]} />);

    expect(screen.getByText('Fallo de red')).toHaveClass('text-status-error');
  });
});
