import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_NOW_INTERVAL_MS, useNow } from '../useNow';

/**
 * Spec del reloj en vivo del grafo (T031, FR-006, SC-005, R3).
 *
 * Contrato: el tick de 1 s se activa **solo** con actividad (`enabled === true`)
 * y se limpia al desactivarse o al desmontar; sin nodos activos no debe haber
 * `setInterval` (Principio VII: sin re-renders innecesarios). Al activarse tras
 * una pausa, `now` se refresca contra la hora actual y no contra el instante
 * obsoleto capturado en el montaje.
 *
 * Se usan temporizadores falsos para que el avance sea determinista y para
 * poder observar la limpieza del intervalo.
 */

/** Instante de referencia congelado con `vi.setSystemTime`. */
const START = new Date('2026-01-01T00:00:00.000Z').getTime();

const SECOND = 1_000;

interface NowProps {
  enabled: boolean;
  intervalMs?: number;
}

const renderNow = (initialProps: NowProps) =>
  renderHook(
    ({ enabled, intervalMs }: NowProps) => useNow(intervalMs, enabled),
    { initialProps },
  );

describe('useNow — tick del grafo condicionado a la actividad (FR-006, SC-005)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current instant on mount', () => {
    const { result } = renderNow({ enabled: true });

    expect(result.current).toBe(START);
  });

  it('does not tick while disabled, so no active nodes cause no re-renders', () => {
    const { result } = renderNow({ enabled: false });

    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5 * SECOND);
    });

    expect(result.current).toBe(START);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('advances to the refreshed Date.now() every second while enabled', () => {
    const { result } = renderNow({ enabled: true });

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

    const { result } = renderNow({ enabled: true });

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
    const { result } = renderNow({ enabled: true, intervalMs: 250 });

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

  it('starts ticking when activity appears and stops when it disappears', () => {
    const { result, rerender } = renderNow({ enabled: false });

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current).toBe(START);
    expect(vi.getTimerCount()).toBe(0);

    // Aparece actividad: refresca `now` con la hora actual y arranca el tick.
    rerender({ enabled: true });
    expect(result.current).toBe(START + SECOND);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current).toBe(START + 2 * SECOND);

    // Desaparece la actividad: el intervalo se limpia y `now` se congela.
    rerender({ enabled: false });
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(SECOND);
    });
    expect(result.current).toBe(START + 2 * SECOND);
  });

  it('clears the interval on unmount (no leaks)', () => {
    const { unmount } = renderNow({ enabled: true });

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.advanceTimersByTime(SECOND)).not.toThrow();
  });
});
