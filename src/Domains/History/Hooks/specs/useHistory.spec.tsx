import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../useHistory';

describe('useHistory', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useHistory());

    expect(result.current.targetId).toBeNull();
  });

  it('open targets the given session', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.open('ses-child'));

    expect(result.current.targetId).toBe('ses-child');
  });

  it('close clears the target', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.open('ses-child'));
    act(() => result.current.close());

    expect(result.current.targetId).toBeNull();
  });

  it('open replaces an already open target', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.open('ses-a'));
    act(() => result.current.open('ses-b'));

    expect(result.current.targetId).toBe('ses-b');
  });

  it('navigateTo switches the target without closing the overlay', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.open('ses-child'));
    act(() => result.current.navigateTo('ses-parent'));

    expect(result.current.targetId).toBe('ses-parent');
    expect(result.current.targetId).not.toBeNull();
  });

  it('navigateTo walks the lineage back and forth while staying open', () => {
    const { result } = renderHook(() => useHistory());

    act(() => result.current.open('ses-child'));
    act(() => result.current.navigateTo('ses-parent'));
    expect(result.current.targetId).toBe('ses-parent');

    act(() => result.current.navigateTo('ses-child'));
    expect(result.current.targetId).toBe('ses-child');
  });

  it('does not persist the state across mounts', () => {
    const first = renderHook(() => useHistory());
    act(() => first.result.current.open('ses-child'));
    expect(first.result.current.targetId).toBe('ses-child');

    first.unmount();

    const second = renderHook(() => useHistory());
    expect(second.result.current.targetId).toBeNull();
  });
});
