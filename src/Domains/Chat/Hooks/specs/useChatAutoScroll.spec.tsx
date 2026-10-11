import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  CHAT_AUTOSCROLL_THRESHOLD,
  isNearBottom,
  useChatAutoScroll,
} from '../useChatAutoScroll';

/**
 * Spec del auto-scroll del timeline (feature 009, iteración UX U2).
 *
 * Contrato: `useChatAutoScroll` devuelve el `ref` del contenedor scrolleable y,
 * al cambiar la **señal de contenido** (nº de entradas o su firma), hace
 * `scrollTo` al fondo **solo si el usuario ya estaba al fondo** (umbral de
 * tolerancia); si scrolleó hacia arriba, no fuerza; al re-engancharse (volver al
 * fondo) reanuda; y respeta `prefers-reduced-motion` (scroll instantáneo).
 *
 * `jsdom` no implementa `Element.prototype.scrollTo` ni `matchMedia`, así que el
 * test define métricas (`scrollHeight`/`clientHeight`/`scrollTop`) y un espía de
 * `scrollTo` sobre el elemento, y stubea `matchMedia` cuando toca.
 */

/** Host de prueba: monta un `<div>` scrolleable y le engancha el `ref` del hook. */
const Host = ({ signal }: { signal: string | number }) => {
  const { ref } = useChatAutoScroll(signal);
  return <div data-testid="scroll-host" ref={ref} />;
};

const getHost = (): HTMLElement => screen.getByTestId('scroll-host');

const setMetrics = (
  el: HTMLElement,
  {
    scrollHeight,
    clientHeight,
    scrollTop,
  }: { scrollHeight: number; clientHeight: number; scrollTop: number },
): void => {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    writable: true,
    value: scrollTop,
  });
};

const mockScrollTo = (el: HTMLElement) => {
  const scrollTo = vi.fn();
  (el as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;
  return scrollTo;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isNearBottom — umbral de tolerancia', () => {
  it('considera al fondo cuando la distancia es cero', () => {
    expect(
      isNearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 }),
    ).toBe(true);
  });

  it('tolera una distancia dentro del umbral', () => {
    const near =
      isNearBottom(
        { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 },
        CHAT_AUTOSCROLL_THRESHOLD,
      ) === true;
    expect(near).toBe(true);
    // Justo en el borde del umbral sigue siendo "al fondo".
    expect(
      isNearBottom({
        scrollHeight: 1000,
        clientHeight: 400,
        scrollTop: 600 - CHAT_AUTOSCROLL_THRESHOLD,
      }),
    ).toBe(true);
  });

  it('no considera al fondo cuando el usuario está más arriba', () => {
    expect(
      isNearBottom({
        scrollHeight: 1000,
        clientHeight: 400,
        scrollTop: 600 - CHAT_AUTOSCROLL_THRESHOLD - 1,
      }),
    ).toBe(false);
  });
});

describe('useChatAutoScroll — auto-scroll al fondo (U2)', () => {
  it('hace scroll al fondo al cambiar la señal si el usuario estaba al fondo', () => {
    const view = render(<Host signal="a" />);
    const el = getHost();
    setMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    const scrollTo = mockScrollTo(el);

    view.rerender(<Host signal="b" />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('no fuerza el scroll si el usuario scrolleó hacia arriba', () => {
    const view = render(<Host signal="a" />);
    const el = getHost();
    setMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(el);
    const scrollTo = mockScrollTo(el);

    view.rerender(<Host signal="b" />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('reanuda el auto-scroll al volver al fondo (re-enganche)', () => {
    const view = render(<Host signal="a" />);
    const el = getHost();
    setMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(el);

    // El usuario vuelve al fondo: se re-engancha.
    setMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(el);

    const scrollTo = mockScrollTo(el);
    view.rerender(<Host signal="b" />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('usa scroll instantáneo con prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const view = render(<Host signal="a" />);
    const el = getHost();
    setMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    const scrollTo = mockScrollTo(el);

    view.rerender(<Host signal="b" />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
  });
});

/**
 * Host que prepara el contenedor **antes** del efecto pasivo del hook (métricas
 * y `scrollTo`), para poder observar el scroll de la **primera carga** y el
 * fallback sin `scrollTo`. Un `useLayoutEffect` corre antes que el `useEffect`
 * del hook en el mismo commit.
 */
const MountHost = ({
  signal,
  prepare,
}: {
  signal: string | number;
  prepare: (element: HTMLElement) => void;
}) => {
  const { ref } = useChatAutoScroll(signal);
  useLayoutEffect(() => {
    if (ref.current) prepare(ref.current);
  }, [ref, prepare]);
  return <div data-testid="scroll-host" ref={ref} />;
};

describe('useChatAutoScroll — primera carga y fallback (U2)', () => {
  it('arranca enganchado: posiciona el hilo al fondo en la primera carga', () => {
    const scrollTo = vi.fn();
    render(
      <MountHost
        signal="a"
        prepare={(el) => {
          setMetrics(el, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
          (el as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;
        }}
      />,
    );

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });

  it('cae a scrollTop cuando el contenedor no expone scrollTo', () => {
    render(
      <MountHost
        signal="a"
        prepare={(el) => {
          Object.defineProperty(el, 'scrollHeight', {
            configurable: true,
            value: 1000,
          });
          Object.defineProperty(el, 'clientHeight', {
            configurable: true,
            value: 400,
          });
          let assigned = 0;
          Object.defineProperty(el, 'scrollTop', {
            configurable: true,
            get: () => assigned,
            set: (value: number) => {
              assigned = value;
            },
          });
          (el as unknown as { scrollTo: undefined }).scrollTo = undefined;
        }}
      />,
    );

    expect(getHost().scrollTop).toBe(1000);
  });
});
