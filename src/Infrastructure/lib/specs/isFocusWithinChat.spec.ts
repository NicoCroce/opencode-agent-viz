// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { CHAT_PANEL_SELECTOR, isFocusWithinChat } from '../isFocusWithinChat';

/** Fuerza `document.activeElement` sin depender del foco real de jsdom. */
const setActiveElement = (el: Element | null): void => {
  Object.defineProperty(document, 'activeElement', {
    configurable: true,
    get: () => el,
  });
};

afterEach(() => {
  // Elimina el override y recupera el getter original del prototipo.
  delete (document as { activeElement?: unknown }).activeElement;
  document.body.innerHTML = '';
});

describe('isFocusWithinChat', () => {
  it('expone el selector del panel de chat', () => {
    expect(CHAT_PANEL_SELECTOR).toBe('[data-testid="chat-panel"]');
  });

  it('es true cuando el foco está dentro del panel de chat', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-testid', 'chat-panel');
    const composer = document.createElement('textarea');
    panel.appendChild(composer);
    document.body.appendChild(panel);
    setActiveElement(composer);

    expect(isFocusWithinChat()).toBe(true);
  });

  it('es true cuando el propio panel tiene el foco', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-testid', 'chat-panel');
    document.body.appendChild(panel);
    setActiveElement(panel);

    expect(isFocusWithinChat()).toBe(true);
  });

  it('es false cuando el foco está fuera del panel de chat', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    setActiveElement(outside);

    expect(isFocusWithinChat()).toBe(false);
  });

  it('es false cuando activeElement es null', () => {
    setActiveElement(null);

    expect(isFocusWithinChat()).toBe(false);
  });
});
