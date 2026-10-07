import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCallEntry } from '../ToolCallEntry';
import type { TToolEntry } from '@app/Domains/History/History.entity';

/** Construye un `TToolEntry` completo (completada) y permite sobrescribir. */
const makeEntry = (overrides: Partial<TToolEntry> = {}): TToolEntry => ({
  id: 'tool-1',
  name: 'read',
  status: 'completed',
  input: { path: 'a.ts' },
  result: 'contents',
  error: null,
  startedAt: 1000,
  completedAt: 1200,
  durationMs: 200,
  ...overrides,
});

describe('ToolCallEntry', () => {
  it('expands and collapses the tool call detail', async () => {
    const user = userEvent.setup();
    render(<ToolCallEntry entry={makeEntry()} />);

    const collapsed = screen.getByRole('button', { name: /read/i });
    expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Entrada')).not.toBeInTheDocument();

    await user.click(collapsed);

    const expanded = screen.getByRole('button', { name: /read/i });
    expect(expanded).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Entrada')).toBeInTheDocument();

    await user.click(expanded);

    expect(
      screen.getByRole('button', { name: /read/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Entrada')).not.toBeInTheDocument();
  });

  it('shows the full input and result of a completed tool call', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallEntry
        entry={makeEntry({ result: 'line one\nline two', name: 'grep' })}
      />,
    );

    expect(screen.getByText('Completada')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /grep/i }));

    expect(screen.getByText('Resultado')).toBeInTheDocument();
    expect(screen.getByText(/line one/)).toBeInTheDocument();
    expect(screen.getByText(/line two/)).toBeInTheDocument();
    expect(screen.getByText(/"path": "a\.ts"/)).toBeInTheDocument();
  });

  it('shows the error of a failed tool call without inventing a result', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallEntry
        entry={makeEntry({
          status: 'error',
          result: null,
          error: 'ENOENT: no such file or directory',
        })}
      />,
    );

    expect(screen.getByText('Fallida')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /read/i }));

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(
      screen.getByText('ENOENT: no such file or directory'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Resultado')).not.toBeInTheDocument();
  });

  it('marks an unfinished tool call without a result as in progress', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallEntry
        entry={makeEntry({
          status: 'running',
          result: null,
          error: null,
          completedAt: null,
          durationMs: null,
        })}
      />,
    );

    expect(screen.getByText('Ejecutando')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /read/i }));

    expect(screen.getByText('Sin resultado todavía.')).toBeInTheDocument();
    expect(screen.queryByText('Resultado')).not.toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('labels a streaming tool call as in progress', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallEntry
        entry={makeEntry({
          status: 'streaming',
          result: null,
          error: null,
          completedAt: null,
          durationMs: null,
        })}
      />,
    );

    expect(screen.getByText('En curso')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /read/i }));

    expect(screen.getByText('Sin resultado todavía.')).toBeInTheDocument();
  });
});
