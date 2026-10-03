import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Metric } from '../Metric';

describe('Metric', () => {
  it('renders the value when available', () => {
    render(<Metric label="Duración" value="1m 23s" />);
    expect(screen.getByText('Duración')).toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
  });

  it('renders an unavailable marker instead of a zero when value is null', () => {
    render(<Metric label="Costo" value={null} />);
    const value = screen.getByLabelText('no disponible');
    expect(value).toHaveTextContent('—');
    expect(value).toHaveTextContent('no disponible');
  });
});
