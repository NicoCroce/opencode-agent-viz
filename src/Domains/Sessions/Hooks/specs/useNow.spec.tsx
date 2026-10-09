import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_NOW_INTERVAL_MS, useNow } from '../useNow';

/**
 * Specs del reloj en vivo (feature 005, T006).
 *
 * Contrato: FR-022 y SC-007 — con un rango acotado la ventana rodante se
 * reevalúa en vivo; con "todo" (`active === false`) el paso del tiempo no
 * altera la lista, así que el reloj no debe tickear (Principio VII: sin
 * re-renders innecesarios). Se usan temporizadores falsos para que el avance
 * sea determinista y para poder observar la limpieza del intervalo.
 */

/** Instante de referencia congelado con `vi.setSystemTime`. */
const START = new Date('2026-01-01T00:00:00.000Z').getTime();

const SECOND = 1_000;

interface NowProps {
  active: boolean;
  intervalMs?: number;
}

const renderNow = (initialProps: NowProps) =>
  renderHook(
    ({ active, intervalMs }: NowProps) => useNow({ enabled: active, intervalMs }),
    { initialProps },
  );

describe('useNow — reloj en vivo (FR-022, SC-007)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current instant on mount', () => {
    const { result } = renderNow({ active: true });

    expect(result.current).toBe(START);
  });

  it('does not tick while inactive, so the "all" range causes no re-renders', () => {
    const { result } = renderNow({ active: false });

    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5 * SECOND);
    });

    expect(result.current).toBe(START);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('advances to the refreshed Date.now() every second while active', () => {
    const { result } = renderNow({ active: true });

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current).toBe(START + SECOND);

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current).toBe(START + 2 * SECOND);
  });

  it('uses the default interval of 1000 ms', () => {
    expect(DEFAULT_NOW_INTERVAL_MS).toBe(SECOND);

    const { result } = renderNow({ active: true });

    act(() => {
      vi.advanceTimersByTime(DEFAULT_NOW_INTERVAL_MS - 1);
    });
    expect(result.current).toBe(START);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(START + DEFAULT_NOW_INTERVAL_MS);
  });

  it('honours the injected interval instead of the default', () => {
    const { result } = renderNow({ active: true, intervalMs: 250 });

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe(START + 250);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(START + 250);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(START + 500);
  });

  it('starts ticking when active turns true and stops when it turns false', () => {
    const { result, rerender } = renderNow({ active: false });

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current).toBe(START);
    expect(vi.getTimerCount()).toBe(0);

    rerender({ active: true });
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    // El avance previo (inactivo) también movió el reloj simulado: el tick
    // refleja el `Date.now()` real de ese momento.
    const afterTick = Date.now();
    expect(afterTick).toBe(START + 2 * SECOND);
    expect(result.current).toBe(afterTick);

    rerender({ active: false });
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current).toBe(afterTick);
  });

  it('refreshes now on activation after idle time, not against the mount instant (FR-022)', () => {
    const { result, rerender } = renderNow({ active: false });

    // El reloj permanece inactivo mientras el tiempo simulado avanza: `now`
    // sigue anclado al instante del montaje.
    act(() => {
      vi.advanceTimersByTime(5 * SECOND);
    });
    expect(result.current).toBe(START);
    expect(vi.getTimerCount()).toBe(0);

    // Al activarse debe evaluar contra la hora actual, no contra el instante
    // obsoleto del montaje (la ventana rodante se recompone sin recargar).
    rerender({ active: true });
    expect(result.current).toBe(START + 5 * SECOND);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('clears the interval on unmount (no leaks)', () => {
    const { unmount } = renderNow({ active: true });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.advanceTimersByTime(SECOND)).not.toThrow();
  });
});
