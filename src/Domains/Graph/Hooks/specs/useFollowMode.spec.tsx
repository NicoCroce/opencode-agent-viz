import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFollowMode } from '../useFollowMode';

describe('useFollowMode', () => {
  it('starts disabled and follows the active node once enabled', () => {
    const { result } = renderHook(() => useFollowMode('node-1'));
    expect(result.current.enabled).toBe(false);
    expect(result.current.followNodeId).toBeNull();

    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(result.current.followNodeId).toBe('node-1');

    act(() => result.current.toggle());
    expect(result.current.followNodeId).toBeNull();
  });
});
