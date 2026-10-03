import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConnectionStatus } from '../useConnectionStatus';

describe('useConnectionStatus', () => {
  it('defaults to disconnected without a provider', () => {
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.state).toBe('disconnected');
  });
});
