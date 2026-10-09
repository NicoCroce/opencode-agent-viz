import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
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

  /**
   * E3 (active-node-feedback-contract §3, FR-009): el follow se dispara al
   * **cambiar** el id seguido y no cuando llega el mismo id. Se observa el
   * disparo con el mismo `useEffect([followNodeId])` que usa `FollowController`
   * (el reposicionamiento real vive en el componente; aquí se prueba la señal
   * que lo gobierna).
   */
  it('E3: re-follows only when the followed id changes, not when it stays the same', () => {
    const focus = vi.fn();
    const { result, rerender } = renderHook(
      ({ activeId }: { activeId: string | null }) => {
        const follow = useFollowMode(activeId);
        useEffect(() => {
          if (follow.followNodeId) focus(follow.followNodeId);
        }, [follow.followNodeId]);
        return follow;
      },
      { initialProps: { activeId: 'node-1' } },
    );

    act(() => result.current.toggle());
    expect(result.current.followNodeId).toBe('node-1');
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenLastCalledWith('node-1');

    // Mismo id seguido: el efecto no vuelve a dispararse (sin "temblor").
    rerender({ activeId: 'node-1' });
    expect(result.current.followNodeId).toBe('node-1');
    expect(focus).toHaveBeenCalledTimes(1);

    // Cambia el activo más reciente: el follow se dispara una vez con el nuevo id.
    rerender({ activeId: 'node-2' });
    expect(result.current.followNodeId).toBe('node-2');
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focus).toHaveBeenLastCalledWith('node-2');
  });

  /**
   * E4 (active-node-feedback-contract §3, FR-008): al pasar `enabled` de
   * `false` a `true` se enfoca el `latestActiveNodeId` **vigente**, no el que
   * estaba activo al desactivar.
   */
  it('E4: reactivating follows the currently latest active node, not a stale one', () => {
    const { result, rerender } = renderHook(
      ({ activeId }: { activeId: string | null }) => useFollowMode(activeId),
      { initialProps: { activeId: 'old' } },
    );

    // Desactivado: no sigue aunque haya un activo.
    expect(result.current.enabled).toBe(false);
    expect(result.current.followNodeId).toBeNull();

    // El activo más reciente cambia mientras el follow está apagado.
    rerender({ activeId: 'latest' });
    expect(result.current.followNodeId).toBeNull();

    // Al reactivar, enfoca el vigente (no el inicial).
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(result.current.followNodeId).toBe('latest');
  });
});
