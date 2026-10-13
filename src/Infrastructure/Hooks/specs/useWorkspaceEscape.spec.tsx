import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useWorkspaceEscape,
  type TWorkspaceEscapeParams,
} from '../useWorkspaceEscape';

/**
 * El `Escape` del workspace tiene una precedencia fija (FR-009 /
 * chat-panel-contract §5): con el foco en el panel de chat no propaga; fuera de
 * él cierra primero el fullscreen y solo después limpia la selección. El
 * listener global solo se registra con fullscreen o selección.
 */

/** Fuerza `document.activeElement` sin depender del foco real de jsdom. */
const setActiveElement = (el: Element | null): void => {
  Object.defineProperty(document, 'activeElement', {
    configurable: true,
    get: () => el,
  });
};

/** Monta un panel de chat (`data-testid`) con su composer y lo enfoca. */
const focusChatComposer = (): HTMLTextAreaElement => {
  const panel = document.createElement('div');
  panel.setAttribute('data-testid', 'chat-panel');
  const composer = document.createElement('textarea');
  panel.appendChild(composer);
  document.body.appendChild(panel);
  setActiveElement(composer);
  return composer;
};

const pressEscape = () => {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
};

const params = (
  overrides: Partial<TWorkspaceEscapeParams> = {},
): TWorkspaceEscapeParams => ({
  isFullscreen: false,
  closeFullscreen: vi.fn(),
  clearSelection: vi.fn(),
  selectedNodeId: null,
  ...overrides,
});

afterEach(() => {
  // Elimina el override y recupera el getter original del prototipo.
  delete (document as { activeElement?: unknown }).activeElement;
  document.body.innerHTML = '';
});

describe('useWorkspaceEscape — precedencia (FR-009)', () => {
  it('cierra el fullscreen cuando el panel está a pantalla completa', () => {
    const closeFullscreen = vi.fn();
    const clearSelection = vi.fn();
    renderHook(() =>
      useWorkspaceEscape(
        params({ isFullscreen: true, closeFullscreen, clearSelection }),
      ),
    );

    pressEscape();

    expect(closeFullscreen).toHaveBeenCalledTimes(1);
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('limpia la selección cuando no hay fullscreen', () => {
    const closeFullscreen = vi.fn();
    const clearSelection = vi.fn();
    renderHook(() =>
      useWorkspaceEscape(
        params({ selectedNodeId: 'n1', closeFullscreen, clearSelection }),
      ),
    );

    pressEscape();

    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(closeFullscreen).not.toHaveBeenCalled();
  });

  it('con fullscreen y selección cierra el fullscreen y no limpia aún la selección', () => {
    const closeFullscreen = vi.fn();
    const clearSelection = vi.fn();
    renderHook(() =>
      useWorkspaceEscape(
        params({
          isFullscreen: true,
          selectedNodeId: 'n1',
          closeFullscreen,
          clearSelection,
        }),
      ),
    );

    pressEscape();

    expect(closeFullscreen).toHaveBeenCalledTimes(1);
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('con el foco en el chat no propaga: ni fullscreen ni selección', () => {
    const closeFullscreen = vi.fn();
    const clearSelection = vi.fn();
    focusChatComposer();
    renderHook(() =>
      useWorkspaceEscape(
        params({
          isFullscreen: true,
          selectedNodeId: 'n1',
          closeFullscreen,
          clearSelection,
        }),
      ),
    );

    pressEscape();

    expect(closeFullscreen).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('con el foco fuera del chat sí actúa', () => {
    const clearSelection = vi.fn();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    setActiveElement(outside);
    renderHook(() =>
      useWorkspaceEscape(params({ selectedNodeId: 'n1', clearSelection })),
    );

    pressEscape();

    expect(clearSelection).toHaveBeenCalledTimes(1);
  });
});

describe('useWorkspaceEscape — activación del listener (FR-009)', () => {
  it('sin fullscreen ni selección no escucha', () => {
    const closeFullscreen = vi.fn();
    const clearSelection = vi.fn();
    renderHook(() =>
      useWorkspaceEscape(params({ closeFullscreen, clearSelection })),
    );

    pressEscape();

    expect(closeFullscreen).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('se activa al abrir el fullscreen sin remontar y deja de escuchar al cerrarlo', () => {
    const closeFullscreen = vi.fn();
    const { rerender } = renderHook(
      (props: TWorkspaceEscapeParams) => useWorkspaceEscape(props),
      { initialProps: params({ closeFullscreen }) },
    );

    pressEscape();
    expect(closeFullscreen).not.toHaveBeenCalled();

    rerender(params({ isFullscreen: true, closeFullscreen }));
    pressEscape();
    expect(closeFullscreen).toHaveBeenCalledTimes(1);

    rerender(params({ closeFullscreen }));
    pressEscape();
    expect(closeFullscreen).toHaveBeenCalledTimes(1);
  });

  it('no escucha después de desmontar', () => {
    const clearSelection = vi.fn();
    const { unmount } = renderHook(() =>
      useWorkspaceEscape(params({ selectedNodeId: 'n1', clearSelection })),
    );

    unmount();
    pressEscape();

    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('ignora teclas que no son Escape', () => {
    const clearSelection = vi.fn();
    renderHook(() =>
      useWorkspaceEscape(params({ selectedNodeId: 'n1', clearSelection })),
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(clearSelection).not.toHaveBeenCalled();
  });
});
