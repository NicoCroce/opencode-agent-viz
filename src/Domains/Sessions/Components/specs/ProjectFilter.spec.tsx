import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TProjectOption } from '../../lib/sessionFilters';
import { ProjectFilter } from '../ProjectFilter';

/**
 * Specs de `ProjectFilter` (feature 005, FR-001..FR-005, FR-021, FR-023, SC-008).
 *
 * Contrato congelado:
 * `specs/005-session-filters/contracts/session-filters-contract.md` §3.
 *
 * El disparador es un `Button` con nombre accesible; cada opción es un
 * `Checkbox` que anuncia su estado vía `aria-checked` y lleva como nombre
 * accesible el nombre de carpeta + la ruta completa (resuelve homónimos).
 */

const options: TProjectOption[] = [
  {
    directory: '/Users/dev/proj-a',
    name: 'proj-a',
    path: '/Users/dev/proj-a',
    count: 3,
  },
  {
    directory: '/Users/dev/proj-b',
    name: 'proj-b',
    path: '/Users/dev/proj-b',
    count: 1,
  },
];

const renderFilter = (selected: string[] = [], onToggle = vi.fn()) => {
  const user = userEvent.setup();
  render(
    <ProjectFilter options={options} selected={selected} onToggle={onToggle} />,
  );
  return { user, onToggle };
};

const getTrigger = (): HTMLElement =>
  screen.getByRole('button', { name: /filtrar por proyecto/i });

const openOptions = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(getTrigger());
};

describe('ProjectFilter', () => {
  it('shows "Todos" on the trigger when no project is selected (FR-003)', () => {
    renderFilter([]);

    expect(getTrigger()).toHaveTextContent('Todos');
    expect(
      screen.getByRole('button', { name: /filtrar por proyecto: todos/i }),
    ).toBeInTheDocument();
  });

  it('summarizes a single selected project as "1 proyecto"', () => {
    renderFilter(['/Users/dev/proj-a']);

    expect(getTrigger()).toHaveTextContent('1 proyecto');
  });

  it('summarizes several selected projects as "N proyectos"', () => {
    renderFilter(['/Users/dev/proj-a', '/Users/dev/proj-b']);

    expect(getTrigger()).toHaveTextContent('2 proyectos');
  });

  it('renders one checkbox per option with folder name and full path (FR-023)', async () => {
    const { user } = renderFilter();
    await openOptions(user);

    expect(screen.getAllByRole('checkbox')).toHaveLength(options.length);
    expect(screen.getByText('proj-a')).toBeInTheDocument();
    expect(screen.getByText('/Users/dev/proj-a')).toBeInTheDocument();
    expect(screen.getByText('proj-b')).toBeInTheDocument();
    expect(screen.getByText('/Users/dev/proj-b')).toBeInTheDocument();
  });

  it('announces each option checked/unchecked through aria-checked (FR-021)', async () => {
    const { user } = renderFilter(['/Users/dev/proj-a']);
    await openOptions(user);

    expect(
      screen.getByRole('checkbox', { name: /proj-a/ }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('checkbox', { name: /proj-b/ }),
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('names each checkbox with the folder name plus the full path', async () => {
    const { user } = renderFilter();
    await openOptions(user);

    expect(
      screen.getByRole('checkbox', { name: 'proj-a /Users/dev/proj-a' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'proj-b /Users/dev/proj-b' }),
    ).toBeInTheDocument();
  });

  it('calls onToggle with the directory when a checkbox is clicked', async () => {
    const onToggle = vi.fn();
    const { user } = renderFilter([], onToggle);
    await openOptions(user);

    await user.click(screen.getByRole('checkbox', { name: /proj-b/ }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('/Users/dev/proj-b');
  });

  it('distinguishes homonymous folders by their full path (SC-008)', async () => {
    const homonyms: TProjectOption[] = [
      { directory: '/repo-a/app', name: 'app', path: '/repo-a/app', count: 1 },
      { directory: '/repo-b/app', name: 'app', path: '/repo-b/app', count: 1 },
    ];
    const user = userEvent.setup();
    render(
      <ProjectFilter options={homonyms} selected={[]} onToggle={vi.fn()} />,
    );
    await openOptions(user);

    expect(screen.getAllByText('app')).toHaveLength(2);
    expect(screen.getByText('/repo-a/app')).toBeInTheDocument();
    expect(screen.getByText('/repo-b/app')).toBeInTheDocument();
  });

  it('opens the options by keyboard from the trigger (FR-021)', async () => {
    const { user } = renderFilter();

    await user.tab();
    expect(getTrigger()).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('checkbox')).toHaveLength(options.length);
  });

  it('announces the open/closed state of the options on the trigger (FR-021)', async () => {
    const { user } = renderFilter();
    const trigger = getTrigger();

    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.tab();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles an option with the keyboard and returns focus to the trigger on Escape (FR-021)', async () => {
    const onToggle = vi.fn();
    const { user } = renderFilter([], onToggle);
    const trigger = getTrigger();

    await user.tab();
    await user.keyboard('{Enter}');

    const firstOption = screen.getByRole('checkbox', { name: /proj-a/ });
    expect(firstOption).toHaveFocus();

    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('/Users/dev/proj-a');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
