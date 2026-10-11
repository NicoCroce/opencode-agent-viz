import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  TAgentOption,
  TChatSelection,
  TModelOption,
  TReasoningOption,
} from '@app/Domains/Chat/Chat.entity';
import { ChatComposer } from '../ChatComposer';

interface HarnessProps {
  initialValue?: string;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  busy?: boolean;
  onInterrupt?: () => void;
  isInterrupting?: boolean;
  disabled?: boolean;
  agents?: TAgentOption[];
  models?: TModelOption[];
  reasoning?: TReasoningOption[];
  selection?: TChatSelection;
  onSelectionChange?: (next: TChatSelection) => void;
}

/**
 * Radix `AlertDialog` (FR-004) depende de APIs de puntero que jsdom no
 * implementa; se mockean y se desactiva la comprobación de `pointer-events`.
 */
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

/** Envuelve el compositor controlado para poder teclear y enviar de verdad. */
const Harness = ({
  initialValue = '',
  onSubmit = vi.fn(),
  isSubmitting = false,
  busy = false,
  onInterrupt,
  isInterrupting = false,
  disabled = false,
  agents,
  models,
  reasoning,
  selection,
  onSelectionChange,
}: HarnessProps) => {
  const [value, setValue] = useState(initialValue);
  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      busy={busy}
      onInterrupt={onInterrupt}
      isInterrupting={isInterrupting}
      disabled={disabled}
      agents={agents}
      models={models}
      reasoning={reasoning}
      selection={selection}
      onSelectionChange={onSelectionChange}
    />
  );
};

const getTextarea = (): HTMLTextAreaElement =>
  screen.getByRole('textbox', { name: 'Mensaje' });

/**
 * Selector embebido (T044, FR-008): el compositor monta `ChatSelector` cuando
 * recibe una `selection` y reenvía las opciones ya derivadas.
 */
const REASONING: TReasoningOption[] = [
  { value: 'low', label: 'Bajo' },
  { value: 'high', label: 'Alto' },
];

const AGENTS: TAgentOption[] = [
  { id: 'build', label: 'Build' },
  { id: 'plan', label: 'Plan' },
];

const MODELS: TModelOption[] = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    ref: { id: 'gpt-4o', providerID: 'openai' },
    reasoning: REASONING,
  },
];

const EMPTY_SELECTION: TChatSelection = {
  agent: null,
  model: null,
  isDirty: false,
};

describe('ChatComposer', () => {
  it('renders an accessible textarea and the send button', () => {
    render(<Harness />);

    expect(getTextarea()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('mounts the selector when a selection is provided (T044, FR-008)', () => {
    render(
      <Harness selection={EMPTY_SELECTION} agents={AGENTS} models={MODELS} />,
    );

    expect(screen.getByText('Agente')).toBeInTheDocument();
    expect(screen.getByText('Modelo')).toBeInTheDocument();
    expect(screen.getByText('Razonamiento')).toBeInTheDocument();
  });

  it('reports typed text through onChange', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(getTextarea(), 'hola');

    expect(getTextarea()).toHaveValue('hola');
  });

  it('submits the text on Enter without Shift', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initialValue="hola" onSubmit={onSubmit} />);

    await user.type(getTextarea(), '{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('inserts a newline on Shift+Enter without submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initialValue="hola" onSubmit={onSubmit} />);

    await user.type(getTextarea(), '{Shift>}{Enter}{/Shift}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(getTextarea()).toHaveValue('hola\n');
  });

  it('does not submit while an IME composition is in progress', () => {
    const onSubmit = vi.fn();
    render(<Harness initialValue="hola" onSubmit={onSubmit} />);
    const textarea = getTextarea();

    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submits from the Enviar button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initialValue="hola" onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit empty or whitespace-only text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initialValue="   " onSubmit={onSubmit} />);

    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toBeDisabled();

    await user.type(getTextarea(), '{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('announces the busy state and blocks input while submitting', () => {
    render(<Harness initialValue="hola" isSubmitting />);

    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(getTextarea()).toBeDisabled();
  });

  it('disables the composer when disabled', () => {
    render(<Harness initialValue="hola" disabled />);

    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(getTextarea()).toBeDisabled();
  });

  it('keeps the Detener control disabled when there is no turn in progress', () => {
    render(<Harness initialValue="hola" />);

    expect(screen.getByRole('button', { name: 'Detener' })).toBeDisabled();
  });

  it('enables the Detener control while a turn is in progress', () => {
    render(<Harness initialValue="hola" busy />);

    expect(screen.getByRole('button', { name: 'Detener' })).toBeEnabled();
  });

  it('asks for confirmation before interrupting the turn', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onInterrupt = vi.fn();
    render(<Harness initialValue="hola" busy onInterrupt={onInterrupt} />);

    await user.click(screen.getByRole('button', { name: 'Detener' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(onInterrupt).not.toHaveBeenCalled();
  });

  it('interrupts the turn after confirming', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onInterrupt = vi.fn();
    render(<Harness initialValue="hola" busy onInterrupt={onInterrupt} />);

    await user.click(screen.getByRole('button', { name: 'Detener' }));
    await user.click(
      await screen.findByRole('button', { name: 'Detener turno' }),
    );

    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it('does not interrupt when the confirmation is cancelled', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onInterrupt = vi.fn();
    render(<Harness initialValue="hola" busy onInterrupt={onInterrupt} />);

    await user.click(screen.getByRole('button', { name: 'Detener' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(onInterrupt).not.toHaveBeenCalled();
  });

  it('announces the interrupting state with aria-busy and a loading control', () => {
    render(<Harness initialValue="hola" busy isInterrupting />);

    const button = screen.getByRole('button', { name: 'Detener' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  /**
   * FR-022: un fallo de escritura conserva el texto/estado del compositor para
   * reintentar. El compositor es controlado y nunca vacía el borrador por sí
   * mismo; al resolverse la mutation vuelve a habilitar el envío con el texto
   * intacto.
   */
  it('keeps the draft and re-enables sending after a failed submit (FR-022)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const view = render(
      <Harness initialValue="reintentable" onSubmit={onSubmit} isSubmitting />,
    );

    // Durante la mutation el envío está bloqueado, pero el texto no se pierde.
    expect(getTextarea()).toBeDisabled();
    expect(getTextarea()).toHaveValue('reintentable');

    // La mutation falla: el compositor vuelve a estar disponible con el borrador.
    view.rerender(
      <Harness initialValue="reintentable" onSubmit={onSubmit} isSubmitting={false} />,
    );

    expect(getTextarea()).toBeEnabled();
    expect(getTextarea()).toHaveValue('reintentable');

    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
