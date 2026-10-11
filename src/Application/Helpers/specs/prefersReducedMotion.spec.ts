import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion } from '../prefersReducedMotion';

/**
 * Helper compartido por el auto-scroll del timeline (`useChatAutoScroll`) y el
 * salto resaltado del chat (`ChatPanel`): ambos usan scroll instantáneo cuando
 * el sistema pide movimiento reducido. Debe ser puro y defensivo ante entornos
 * sin `matchMedia` (p. ej. `jsdom`), donde se asume animación permitida.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('devuelve true cuando el sistema pide movimiento reducido', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    expect(prefersReducedMotion()).toBe(true);
  });

  it('devuelve false cuando el sistema permite animación', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));

    expect(prefersReducedMotion()).toBe(false);
  });

  it('consulta la media query de movimiento reducido', () => {
    const matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('matchMedia', matchMedia);

    prefersReducedMotion();

    expect(matchMedia).toHaveBeenCalledWith(
      '(prefers-reduced-motion: reduce)',
    );
  });

  it('es defensiva y asume animación permitida sin matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(prefersReducedMotion()).toBe(false);
  });
});
