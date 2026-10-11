import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CHAT_PROMPT_LABEL_MAX,
  ChatToolbar,
  promptLabel,
  type ChatToolbarProps,
} from '../ChatToolbar';

/**
 * Spec de la barra superior del chat (iteración UX U3/U4): toggle de
 * herramientas (visibles por defecto, `aria-pressed`) y select "Ir a mi mensaje"
 * con la etiqueta truncada de cada prompt propio. Radix `Select` depende de APIs
 * que jsdom no implementa (`hasPointerCapture`/`releasePointerCapture`/
 * `scrollIntoView`); se mockean como en `ChatSelector.spec.tsx`.
 */

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const PROMPTS = [
  { id: 'u1:0', text: 'primer mensaje' },
  { id: 'u2:0', text: 'segundo mensaje' },
];

const renderToolbar = (overrides: Partial<ChatToolbarProps> = {}) => {
  const onToggleTools = vi.fn();
  const onSelectPrompt = vi.fn();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const view = render(
    <ChatToolbar
      showTools
      onToggleTools={onToggleTools}
      prompts={PROMPTS}
      onSelectPrompt={onSelectPrompt}
      {...overrides}
    />,
  );
  return { user, onToggleTools, onSelectPrompt, view };
};

const getToggle = (): HTMLElement =>
  screen.getByRole('button', { name: 'Herramientas' });
const getSelect = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'Ir a mi mensaje' });

describe('ChatToolbar — estructura y a11y (U3/U4)', () => {
  it('expone una barra etiquetada con el toggle y el select', () => {
    renderToolbar();

    expect(
      screen.getByRole('toolbar', { name: 'Controles del chat' }),
    ).toBeInTheDocument();
    expect(getToggle()).toBeInTheDocument();
    expect(getSelect()).toBeInTheDocument();
  });

  it('asocia el label del select a su disparador', () => {
    renderToolbar();

    const label = screen.getByText('Ir a mi mensaje');
    expect(label).toHaveAttribute('for', getSelect().id);
  });
});

describe('ChatToolbar — toggle de herramientas (U3)', () => {
  it('arranca mostrando las herramientas (aria-pressed true)', () => {
    renderToolbar();

    expect(getToggle()).toHaveAttribute('aria-pressed', 'true');
  });

  it('refleja el estado desactivado (aria-pressed false)', () => {
    renderToolbar({ showTools: false });

    expect(getToggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('notifica el nuevo estado al pulsar', async () => {
    const { user, onToggleTools } = renderToolbar();

    await user.click(getToggle());

    expect(onToggleTools).toHaveBeenCalledWith(false);
  });
});

describe('ChatToolbar — select de mis mensajes (U4)', () => {
  it('lista mis prompts en orden con su etiqueta', async () => {
    const { user } = renderToolbar();

    await user.click(getSelect());

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['primer mensaje', 'segundo mensaje']);
  });

  it('emite el id de la entrada elegida para el salto', async () => {
    const { user, onSelectPrompt } = renderToolbar();

    await user.click(getSelect());
    await user.click(screen.getByRole('option', { name: 'segundo mensaje' }));

    expect(onSelectPrompt).toHaveBeenCalledWith('u2:0');
  });

  it('queda deshabilitado cuando no hay prompts', () => {
    renderToolbar({ prompts: [] });

    expect(getSelect()).toBeDisabled();
  });

  it('comunica el estado con un placeholder textual (con y sin prompts)', () => {
    const { view } = renderToolbar();
    expect(getSelect()).toHaveTextContent('Mis mensajes');

    view.unmount();

    renderToolbar({ prompts: [] });
    expect(getSelect()).toHaveTextContent('Sin mensajes');
  });
});

describe('promptLabel (U4)', () => {
  it('deja intacto un texto corto en una línea', () => {
    expect(promptLabel('hola')).toBe('hola');
  });

  it('colapsa saltos de línea y espacios sobrantes', () => {
    expect(promptLabel('hola\n  mundo')).toBe('hola mundo');
  });

  it('trunca a ~40 caracteres con elipsis', () => {
    const long = 'a'.repeat(CHAT_PROMPT_LABEL_MAX + 10);

    const label = promptLabel(long);

    expect(label).toBe(`${'a'.repeat(CHAT_PROMPT_LABEL_MAX)}…`);
    expect(label.length).toBe(CHAT_PROMPT_LABEL_MAX + 1);
  });
});
