import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SessionInfo } from '@opencode/client';
import { useSelectSession } from '../useSelectSession';

const root = (id: string): SessionInfo => ({
  id,
  projectID: 'proj',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 1, updated: 2 },
  location: { directory: '/repo' },
  title: id,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/sessions']}>{children}</MemoryRouter>
);

describe('useSelectSession', () => {
  it('defaults to the first root session', () => {
    const { result } = renderHook(
      () => useSelectSession([root('a'), root('b')]),
      { wrapper },
    );
    expect(result.current.selectedId).toBe('a');
  });

  it('updates the selected session', () => {
    const { result } = renderHook(
      () => useSelectSession([root('a'), root('b')]),
      { wrapper },
    );

    act(() => {
      result.current.select('b');
    });

    expect(result.current.selectedId).toBe('b');
  });
});
