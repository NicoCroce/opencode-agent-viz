import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolStats } from '../ToolStats';

describe('ToolStats', () => {
  it('shows the empty state when there is no tool activity', () => {
    render(<ToolStats tools={[]} />);
    expect(
      screen.getByText('Sin actividad de herramientas todavía.'),
    ).toBeInTheDocument();
  });

  it('accepts a custom empty state label', () => {
    render(<ToolStats tools={[]} isEmptyLabel="Nada por aquí." />);
    expect(screen.getByText('Nada por aquí.')).toBeInTheDocument();
    expect(
      screen.queryByText('Sin actividad de herramientas todavía.'),
    ).not.toBeInTheDocument();
  });

  it('shows the median duration per tool alongside its call count', () => {
    render(
      <ToolStats
        tools={[
          { name: 'read', status: 'completed', startedAt: 0, endedAt: 400 },
          { name: 'read', status: 'completed', startedAt: 0, endedAt: 600 },
          { name: 'bash', status: 'completed', startedAt: 0, endedAt: 100 },
        ]}
      />,
    );

    expect(
      screen.getByText('Duración mediana por herramienta'),
    ).toBeInTheDocument();
    expect(screen.getByText('read · 2 llamadas')).toBeInTheDocument();
    expect(screen.getByText('500ms')).toBeInTheDocument();
    expect(screen.getByText('bash · 1 llamada')).toBeInTheDocument();
    expect(screen.getByText('100ms')).toBeInTheDocument();
  });

  it('shows "no disponible" when a tool has no timed executions', () => {
    render(
      <ToolStats
        tools={[
          {
            name: 'grep',
            status: 'running',
            startedAt: undefined,
            endedAt: undefined,
          },
        ]}
      />,
    );

    expect(screen.getByText('grep · 1 llamada')).toBeInTheDocument();
    expect(screen.getByText('no disponible')).toBeInTheDocument();
  });
});
