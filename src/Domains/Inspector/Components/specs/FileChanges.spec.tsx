import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TFileChange } from '../../Inspector.entity';
import { FileChanges } from '../FileChanges';

const change = (overrides: Partial<TFileChange>): TFileChange => ({
  file: 'src/index.ts',
  patch: '@@ -1 +1 @@\n-old\n+new',
  additions: 1,
  deletions: 1,
  status: 'modified',
  ...overrides,
});

/** Punto LED del estado del archivo (FR-019, D9). */
const statusDot = (container: HTMLElement, status: TFileChange['status']) =>
  container.querySelector(`[data-dot="${status}"]`);

describe('FileChanges', () => {
  it('lists the files with status and added/removed lines', () => {
    render(
      <FileChanges
        changes={[
          change({ file: 'src/a.ts', status: 'added', additions: 10, deletions: 0 }),
          change({ file: 'src/b.ts', status: 'deleted', additions: 0, deletions: 4 }),
        ]}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('src/a.ts')).toBeInTheDocument();
    expect(screen.getByText('añadido')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();

    expect(screen.getByText('src/b.ts')).toBeInTheDocument();
    expect(screen.getByText('borrado')).toBeInTheDocument();
    expect(screen.getByText('-4')).toBeInTheDocument();
  });

  it('shows the patch of the selected file', async () => {
    const user = userEvent.setup();
    render(
      <FileChanges
        changes={[change({ file: 'src/a.ts', patch: '@@ -1 +1 @@\n-old\n+new' })]}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.queryByText(/@@ -1 \+1 @@/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /src\/a\.ts/ }));

    expect(screen.getByText(/@@ -1 \+1 @@/)).toBeInTheDocument();
    expect(screen.getByText('src/a.ts')).toBeInTheDocument();
  });

  it('indicates an unavailable patch when the file has no patch', async () => {
    const user = userEvent.setup();
    render(
      <FileChanges
        changes={[change({ file: 'src/empty.ts', patch: '' })]}
        isError={false}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /src\/empty\.ts/ }));

    expect(screen.getByText('parche no disponible')).toBeInTheDocument();
  });

  it('indicates an unavailable patch for a whitespace-only patch (D4)', async () => {
    const user = userEvent.setup();
    render(
      <FileChanges
        changes={[change({ file: 'src/blank.ts', patch: '   \n  ' })]}
        isError={false}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /src\/blank\.ts/ }));

    expect(screen.getByText('parche no disponible')).toBeInTheDocument();
  });

  it('renders the selected patch with the editor diff instead of a raw pre (D4)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <FileChanges
        changes={[
          change({
            file: 'src/a.ts',
            patch: '@@ -1,3 +1,3 @@\n context\n-removed\n+added',
          }),
        ]}
        isError={false}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /src\/a\.ts/ }));

    expect(container.querySelector('[data-number="old"]')).not.toBeNull();
    expect(container.querySelector('[data-number="new"]')).not.toBeNull();
    expect(container.querySelector('pre')).toBeNull();
  });

  it('distinguishes the file status with a token-coloured LED dot (D9)', () => {
    const { container } = render(
      <FileChanges
        changes={[
          change({ file: 'src/a.ts', status: 'added' }),
          change({ file: 'src/b.ts', status: 'modified' }),
          change({ file: 'src/c.ts', status: 'deleted' }),
        ]}
        isError={false}
        isLoading={false}
      />,
    );

    expect(statusDot(container, 'added')).toHaveClass('bg-status-done');
    expect(statusDot(container, 'modified')).toHaveClass('bg-status-running');
    expect(statusDot(container, 'deleted')).toHaveClass('bg-status-error');
  });

  it('keeps aria-pressed on the selected file and toggles it (D9)', async () => {
    const user = userEvent.setup();
    render(
      <FileChanges
        changes={[change({ file: 'src/a.ts' }), change({ file: 'src/b.ts' })]}
        isError={false}
        isLoading={false}
      />,
    );

    const a = screen.getByRole('button', { name: /src\/a\.ts/ });
    const b = screen.getByRole('button', { name: /src\/b\.ts/ });

    expect(a).toHaveAttribute('aria-pressed', 'false');

    await user.click(a);
    expect(a).toHaveAttribute('aria-pressed', 'true');

    await user.click(b);
    expect(a).toHaveAttribute('aria-pressed', 'false');
    expect(b).toHaveAttribute('aria-pressed', 'true');

    await user.click(b);
    expect(b).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows an explicit empty state when the agent changed no files', () => {
    render(<FileChanges changes={[]} isError={false} isLoading={false} />);

    expect(screen.getByText('Sin cambios de archivos')).toBeInTheDocument();
  });

  it('shows the error state without listing files', () => {
    render(
      <FileChanges changes={[]} isError isLoading={false} />,
    );

    expect(
      screen.getByText('Ocurrió un error al cargar los datos'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sin cambios de archivos')).not.toBeInTheDocument();
  });

  it('does not show the empty state while loading', () => {
    render(<FileChanges changes={[]} isError={false} isLoading />);

    expect(
      screen.queryByText('Sin cambios de archivos'),
    ).not.toBeInTheDocument();
  });
});
