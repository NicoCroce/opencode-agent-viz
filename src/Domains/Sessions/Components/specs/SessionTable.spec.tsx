import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionTable } from '../SessionTable';
import { buildSessionGroups } from '../../specs/fixtures';

/**
 * Specs de `SessionTable`, la presentación de escritorio de la página del
 * listado: un bloque por proyecto con encabezado y tabla, una fila por sesión
 * cuyo botón (nombre = título + agente) abre la sesión.
 */

const groups = buildSessionGroups([
  {
    directory: '/Users/dev/proj-a',
    sessions: [
      { id: 'a1', agentName: 'develop', created: 0, updated: 372_000 },
      { id: 'a2', agentName: null },
    ],
  },
  {
    directory: '/Users/dev/proj-b',
    sessions: [{ id: 'b1', agentName: 'build' }],
  },
]);

describe('SessionTable', () => {
  it('renders one named table per project with the design columns', () => {
    render(<SessionTable groups={groups} onSelect={() => undefined} />);

    const table = screen.getByRole('table', { name: 'proj-a' });
    expect(screen.getByRole('table', { name: 'proj-b' })).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Sesión', 'Estado', 'Costo', 'Duración', 'Intervalo']);
  });

  it('names each row action with the title and the agent', () => {
    render(<SessionTable groups={groups} onSelect={() => undefined} />);

    expect(
      screen.getByRole('button', { name: 'session a1 develop' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'session a2 agente no disponible' }),
    ).toBeInTheDocument();
  });

  it('calls onSelect with the session id', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<SessionTable groups={groups} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /session b1/ }));

    expect(onSelect).toHaveBeenCalledWith('b1');
  });

  it('shows status, cost and duration of each session', () => {
    render(
      <SessionTable
        groups={groups}
        statuses={{ a1: { type: 'busy' } }}
        onSelect={() => undefined}
      />,
    );

    const row = screen
      .getByRole('button', { name: /session a1/ })
      .closest('tr') as HTMLElement;
    const dot = within(row).getByRole('img', { name: 'En curso' });
    // LED encendido mientras la sesión corre.
    expect(dot).toHaveClass('glow-accent');
    expect(within(row).getByText('$0.00')).toBeInTheDocument();
    expect(within(row).getByText('6m 12s')).toBeInTheDocument();
  });

  it('shows the per-group count only when enabled (FR-016)', () => {
    const { rerender } = render(
      <SessionTable groups={groups} onSelect={() => undefined} />,
    );
    expect(screen.queryByLabelText('2 sesiones')).not.toBeInTheDocument();

    rerender(
      <SessionTable groups={groups} onSelect={() => undefined} showCount />,
    );
    expect(screen.getByLabelText('2 sesiones')).toHaveTextContent('2');
    expect(screen.getByLabelText('1 sesión')).toHaveTextContent('1');
  });
});
