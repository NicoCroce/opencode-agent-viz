import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionList } from '../SessionList';
import { buildSessionGroups } from '../../specs/fixtures';

/**
 * Specs de `SessionList` (feature 005, T012/T036).
 *
 * Contrato congelado: `specs/005-session-filters/contracts/session-filters-contract.md`
 * §6.3. El listado sigue siendo presentación pura: recibe los grupos ya
 * filtrados por el hook. El conteo de sesiones por encabezado (FR-016) es
 * **opt-in** vía `showCount`: solo la página del listado lo activa, para que el
 * listado lateral del espacio de trabajo permanezca sin cambios (FR-018).
 */

const groups = buildSessionGroups([
  {
    directory: '/Users/dev/proj-a',
    sessions: [
      { id: 'a1', agentName: 'develop' },
      { id: 'a2', agentName: 'develop' },
    ],
  },
  {
    directory: '/Users/dev/proj-b',
    sessions: [{ id: 'b1', agentName: 'build' }],
  },
]);

describe('SessionList', () => {
  it('segments sessions by folder name', () => {
    render(
      <SessionList groups={groups} selectedId={null} onSelect={() => undefined} />,
    );
    expect(screen.getByText('proj-a')).toBeInTheDocument();
    expect(screen.getByText('proj-b')).toBeInTheDocument();
    expect(screen.getByText('session a1')).toBeInTheDocument();
    expect(screen.getByText('session b1')).toBeInTheDocument();
  });

  it('shows how many sessions each group is displaying when enabled (FR-016)', () => {
    render(
      <SessionList
        groups={groups}
        selectedId={null}
        onSelect={() => undefined}
        showCount
      />,
    );
    expect(screen.getByLabelText('2 sesiones')).toHaveTextContent('2');
    expect(screen.getByLabelText('1 sesión')).toHaveTextContent('1');
  });

  it('hides the per-group count by default so the workspace rail stays unchanged (FR-018)', () => {
    render(
      <SessionList groups={groups} selectedId={null} onSelect={() => undefined} />,
    );
    expect(screen.queryByLabelText('2 sesiones')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('1 sesión')).not.toBeInTheDocument();
  });

  it('counts the items it actually renders, not the whole project catalog', () => {
    // Un grupo ya filtrado por el hook puede traer menos items que el catálogo
    // del proyecto: el encabezado refleja lo mostrado, no el total (FR-016).
    const filtered = buildSessionGroups([
      {
        directory: '/Users/dev/proj-a',
        sessions: [{ id: 'a1', agentName: 'develop' }],
      },
    ]);

    render(
      <SessionList
        groups={filtered}
        selectedId={null}
        onSelect={() => undefined}
        showCount
      />,
    );
    expect(screen.getByLabelText('1 sesión')).toHaveTextContent('1');
    expect(screen.queryByLabelText('2 sesiones')).not.toBeInTheDocument();
  });
});
