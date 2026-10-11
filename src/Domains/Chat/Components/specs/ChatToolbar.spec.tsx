import { createRef } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CHAT_TOOLS_HIDDEN_LABEL,
  CHAT_TOOLS_VISIBLE_LABEL,
  ChatToolbar,
  type ChatToolbarProps,
} from '../ChatToolbar';

/**
 * Spec de la barra del chat (iteración UX): botón-icono "ojo" que oculta/muestra
 * las herramientas (visibles por defecto, `aria-pressed`, `aria-label` textual y
 * tooltip) y botón-icono que abre el historial completo (U2). El select "Ir a mi
 * mensaje" se retiró: el salto a un mensaje propio lo cubre el modal de historial.
 *
 * Radix `Tooltip` monta su contenido en un portal y usa `ResizeObserver`, que
 * jsdom no implementa; se stubbea como en `ChatPendingRequest.spec.tsx`.
 */

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const renderToolbar = (overrides: Partial<ChatToolbarProps> = {}) => {
  const onToggleTools = vi.fn();
  const onOpenHistory = vi.fn();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const view = render(
    <ChatToolbar
      showTools
      onToggleTools={onToggleTools}
      onOpenHistory={onOpenHistory}
      {...overrides}
    />,
  );
  return { user, onToggleTools, onOpenHistory, view };
};

const getToggle = (): HTMLElement => screen.getByTestId('chat-tools-toggle');
const getHistoryButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Historial de mensajes' });

describe('ChatToolbar — estructura y a11y', () => {
  it('expone una barra etiquetada con el ojo de herramientas y el historial', () => {
    renderToolbar();

    expect(
      screen.getByRole('toolbar', { name: 'Controles del chat' }),
    ).toBeInTheDocument();
    expect(getToggle()).toBeInTheDocument();
    expect(getHistoryButton()).toBeInTheDocument();
    // Ya no hay select "Ir a mi mensaje" en la barra.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('da un nombre accesible no vacío a cada control', () => {
    renderToolbar();

    const toolbar = screen.getByRole('toolbar', {
      name: 'Controles del chat',
    });

    expect(
      within(toolbar).getByRole('button', { name: CHAT_TOOLS_VISIBLE_LABEL }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole('button', { name: 'Historial de mensajes' }),
    ).toBeInTheDocument();
  });
});

describe('ChatToolbar — ojo de herramientas (U3)', () => {
  it('arranca mostrando las herramientas (aria-pressed true, ojo abierto)', () => {
    renderToolbar();

    const toggle = getToggle();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAccessibleName(CHAT_TOOLS_VISIBLE_LABEL);
    expect(toggle.querySelector('svg')).toHaveAttribute('data-icon', 'eye');
  });

  it('refleja el estado oculto (aria-pressed false, ojo tachado)', () => {
    renderToolbar({ showTools: false });

    const toggle = getToggle();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAccessibleName(CHAT_TOOLS_HIDDEN_LABEL);
    expect(toggle.querySelector('svg')).toHaveAttribute('data-icon', 'eye-slash');
  });

  it('notifica el nuevo estado al pulsar', async () => {
    const { user, onToggleTools } = renderToolbar();

    await user.click(getToggle());

    expect(onToggleTools).toHaveBeenCalledWith(false);
  });

  it('vuelve a mostrar las herramientas al pulsar cuando están ocultas', async () => {
    const { user, onToggleTools } = renderToolbar({ showTools: false });

    await user.click(getToggle());

    expect(onToggleTools).toHaveBeenCalledWith(true);
  });

  it('se opera por teclado: tab al botón y activación con Enter', async () => {
    const { user, onToggleTools } = renderToolbar();

    await user.tab();
    expect(getToggle()).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(onToggleTools).toHaveBeenCalledWith(false);
  });
});

describe('ChatToolbar — tooltip del ojo de herramientas', () => {
  it('muestra el tooltip textual al pasar el puntero', async () => {
    const { user } = renderToolbar();

    await user.hover(getToggle());

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      CHAT_TOOLS_VISIBLE_LABEL,
    );
  });

  it('muestra el tooltip contrario cuando las herramientas están ocultas', async () => {
    const { user } = renderToolbar({ showTools: false });

    await user.hover(getToggle());

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      CHAT_TOOLS_HIDDEN_LABEL,
    );
  });
});

describe('ChatToolbar — botón de historial (U2)', () => {
  it('expone un botón-icono con nombre accesible y title', () => {
    renderToolbar();

    const button = getHistoryButton();
    expect(button).toHaveAttribute('title', 'Historial de mensajes');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('notifica la apertura del historial al pulsar', async () => {
    const { user, onOpenHistory } = renderToolbar();

    await user.click(getHistoryButton());

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it('expone el botón por ref para restaurar el foco al cerrar (U2)', () => {
    const historyButtonRef = createRef<HTMLButtonElement>();
    renderToolbar({ historyButtonRef });

    expect(historyButtonRef.current).toBe(getHistoryButton());
  });
});
