import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReasoningVisibility } from '../useReasoningVisibility';

describe('useReasoningVisibility', () => {
  it('starts hidden by default', () => {
    const { result } = renderHook(() => useReasoningVisibility());

    expect(result.current.visible).toBe(false);
  });

  it('honors an explicit initial value', () => {
    const { result } = renderHook(() => useReasoningVisibility(true));

    expect(result.current.visible).toBe(true);
  });

  it('toggle reveals the reasoning', () => {
    const { result } = renderHook(() => useReasoningVisibility());

    act(() => result.current.toggle());

    expect(result.current.visible).toBe(true);
  });

  it('toggle alternates the visibility on every call', () => {
    const { result } = renderHook(() => useReasoningVisibility());

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
  });

  it('alternates from an explicit initial value', () => {
    const { result } = renderHook(() => useReasoningVisibility(true));

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
  });

  it('does not persist the state across mounts', () => {
    const first = renderHook(() => useReasoningVisibility());
    act(() => first.result.current.toggle());
    expect(first.result.current.visible).toBe(true);

    first.unmount();

    const second = renderHook(() => useReasoningVisibility());
    expect(second.result.current.visible).toBe(false);
  });
});
