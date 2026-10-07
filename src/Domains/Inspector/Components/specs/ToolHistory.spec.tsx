import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolHistory } from '../ToolHistory';
import type { TToolHistoryEntry } from '../../Inspector.entity';

const makeTools = (count: number): TToolHistoryEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `tool-${index + 1}`,
    status: 'completed',
    startedAt: 0,
    endedAt: 1000,
  }));

describe('ToolHistory', () => {
  it('shows the empty state when there is no tool activity', () => {
    render(<ToolHistory tools={[]} />);
    expect(
      screen.getByText('Sin actividad de herramientas todavía.'),
    ).toBeInTheDocument();
  });

  it('renders ten entries and an expansion control with eleven tools', () => {
    render(<ToolHistory tools={makeTools(11)} />);

    expect(screen.getByText('tool-10')).toBeInTheDocument();
    expect(screen.queryByText('tool-11')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Ver 1 más/i }),
    ).toBeInTheDocument();
  });

  it('does not render the expansion control with exactly ten tools', () => {
    render(<ToolHistory tools={makeTools(10)} />);

    expect(screen.getByText('tool-10')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('expands to reveal the remaining tools and collapses back to ten', async () => {
    const user = userEvent.setup();
    render(<ToolHistory tools={makeTools(11)} />);

    await user.click(screen.getByRole('button', { name: /Ver 1 más/i }));

    expect(screen.getByText('tool-11')).toBeInTheDocument();
    const collapse = screen.getByRole('button', { name: /Ver menos/i });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');

    await user.click(collapse);

    expect(screen.queryByText('tool-11')).not.toBeInTheDocument();
    expect(screen.getByText('tool-10')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Ver 1 más/i }),
    ).toBeInTheDocument();
  });

  it('shows the median duration per tool alongside its call count', () => {
    render(
      <ToolHistory
        tools={[
          { name: 'read', status: 'completed', startedAt: 0, endedAt: 400 },
          { name: 'read', status: 'completed', startedAt: 0, endedAt: 600 },
          { name: 'bash', status: 'completed', startedAt: 0, endedAt: 100 },
        ]}
      />,
    );

    const stats = within(screen.getByTestId('tool-history-stats'));
    expect(stats.getByText('read · 2 llamadas')).toBeInTheDocument();
    expect(stats.getByText('500ms')).toBeInTheDocument();
    expect(stats.getByText('bash · 1 llamada')).toBeInTheDocument();
    expect(stats.getByText('100ms')).toBeInTheDocument();
  });

  it('shows "no disponible" when a tool has no timed executions', () => {
    render(
      <ToolHistory
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

    const stats = within(screen.getByTestId('tool-history-stats'));
    expect(stats.getByText('grep · 1 llamada')).toBeInTheDocument();
    expect(stats.getByText('no disponible')).toBeInTheDocument();
  });

  it('keeps the individual executions while showing the statistics', () => {
    render(
      <ToolHistory
        tools={[
          { name: 'read', status: 'completed', startedAt: 0, endedAt: 400 },
          { name: 'read', status: 'error', startedAt: 0, endedAt: 600 },
        ]}
      />,
    );

    expect(screen.getAllByText('read')).toHaveLength(2);
    expect(screen.getByText('read · 2 llamadas')).toBeInTheDocument();
  });
});
