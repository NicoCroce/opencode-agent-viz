import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileDiff } from '../FileDiff';

/** Patch con contexto, eliminada y añadida, numeradas (D1/D6/D8). */
const PATCH = ['@@ -1,3 +1,3 @@', ' context', '-removed', '+added'].join('\n');

const lineRow = (container: HTMLElement, kind: string) =>
  container.querySelector(`[data-kind="${kind}"]`);

const numberCell = (row: Element | null, channel: 'old' | 'new') =>
  row?.querySelector(`[data-number="${channel}"]`);

describe('FileDiff', () => {
  it('distinguishes added/removed/context lines with token classes (D6)', () => {
    const { container } = render(<FileDiff patch={PATCH} />);

    const added = lineRow(container, 'added');
    const removed = lineRow(container, 'removed');
    const context = lineRow(container, 'context');

    expect(added).toHaveClass('bg-status-done/14', 'border-l-status-done');
    expect(removed).toHaveClass('bg-status-error/14', 'border-l-status-error');
    expect(context).not.toHaveClass('bg-status-done/14');
    expect(context).not.toHaveClass('bg-status-error/14');
  });

  it('renders the double old/new number channel in mono tabular (D8)', () => {
    const { container } = render(<FileDiff patch={PATCH} />);

    const context = lineRow(container, 'context');
    expect(numberCell(context, 'old')?.textContent).toBe('1');
    expect(numberCell(context, 'new')?.textContent).toBe('1');

    const removed = lineRow(container, 'removed');
    expect(numberCell(removed, 'old')?.textContent).toBe('2');
    expect(numberCell(removed, 'new')?.textContent).toBe('');

    const added = lineRow(container, 'added');
    expect(numberCell(added, 'old')?.textContent).toBe('');
    expect(numberCell(added, 'new')?.textContent).toBe('2');

    expect(numberCell(context, 'old')).toHaveClass('font-mono', 'tabular-nums');
  });

  it('shows hunks expanded by default and collapses them by keyboard (D7)', async () => {
    const user = userEvent.setup();
    render(<FileDiff patch={PATCH} />);

    const header = screen.getByRole('button', { name: /@@ -1,3 \+1,3 @@/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('added')).toBeInTheDocument();
    expect(screen.getByText('removed')).toBeInTheDocument();

    header.focus();
    await user.keyboard('{Enter}');

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('added')).not.toBeInTheDocument();
    expect(screen.queryByText('removed')).not.toBeInTheDocument();

    await user.keyboard(' ');

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('added')).toBeInTheDocument();
  });

  it('collapses hunks independently (local state per hunk)', async () => {
    const user = userEvent.setup();
    const patch = ['@@ -1 +1 @@', '-a', '+b', '@@ -5 +5 @@', '-c', '+d'].join(
      '\n',
    );
    render(<FileDiff patch={patch} />);

    const [first, second] = screen.getAllByRole('button');
    await user.click(first);

    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('b')).not.toBeInTheDocument();
    expect(screen.getByText('d')).toBeInTheDocument();
  });

  it('renders the no-newline marker as a meta line without numbers', () => {
    const patch = [
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '\\ No newline at end of file',
    ].join('\n');
    const { container } = render(<FileDiff patch={patch} />);

    const meta = lineRow(container, 'meta');
    expect(meta).not.toBeNull();
    expect(numberCell(meta, 'old')?.textContent).toBe('');
    expect(numberCell(meta, 'new')?.textContent).toBe('');
  });

  it('renders nothing for an empty patch', () => {
    const { container } = render(<FileDiff patch="" />);

    expect(container).toBeEmptyDOMElement();
  });
});
