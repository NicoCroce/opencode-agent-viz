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

  it('shows the error state instead of the rows and the empty state', () => {
    render(
      <ErrorsSection
        errors={[{ message: 'Fallo de red', at: 0 }]}
        isError
        isLoading={false}
      />,
    );

    expect(
      screen.getByText('Ocurrió un error al cargar los datos'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sin errores.')).not.toBeInTheDocument();
    expect(screen.queryByText('Fallo de red')).not.toBeInTheDocument();
  });

  it('shows the loading skeleton instead of the rows and the empty state', () => {
    const { container } = render(
      <ErrorsSection errors={[]} isError={false} isLoading />,
    );

    // `ListSkeleton` monta 2 líneas `animate-pulse` por defecto.
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
    expect(screen.queryByText('Sin errores.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Ocurrió un error al cargar los datos'),
    ).not.toBeInTheDocument();
  });

  it('shows the explicit empty state once the source resolved without errors', () => {
    render(<ErrorsSection errors={[]} isError={false} isLoading={false} />);

    expect(screen.getByText('Errores')).toBeInTheDocument();
    expect(screen.getByText('Sin errores.')).toBeInTheDocument();
    expect(
      screen.queryByText('Ocurrió un error al cargar los datos'),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });
});
