import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UNAVAILABLE } from '@app/Application/Helpers/formatDuration';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import { ModelSection } from '../ModelSection';

type Model = TGraphNode['data']['model'];

describe('ModelSection', () => {
  it('shows the section header and the provider/id model name', () => {
    const model: Model = { providerID: 'opencode', id: 'deepseek' };

    render(<ModelSection model={model} />);

    expect(screen.getByText('Modelo')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
  });

  it('shows the reasoning variant when present', () => {
    const model: Model = {
      providerID: 'opencode-go',
      id: 'deepseek-v4.1-flash',
      variant: 'high',
    };

    render(<ModelSection model={model} />);

    expect(
      screen.getByText('opencode-go/deepseek-v4.1-flash'),
    ).toBeInTheDocument();
    expect(screen.getByText('Razonamiento')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('falls back to "no disponible" when the variant is missing', () => {
    const model: Model = { providerID: 'opencode', id: 'deepseek' };

    render(<ModelSection model={model} />);

    expect(screen.getByText('Razonamiento')).toBeInTheDocument();
    expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
  });

  it('falls back to "no disponible" for both rows when there is no model', () => {
    render(<ModelSection model={null} />);

    expect(screen.getByText('Modelo')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Razonamiento')).toBeInTheDocument();
    expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(2);
  });
});
