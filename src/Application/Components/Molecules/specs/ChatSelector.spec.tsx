import { beforeAll, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@app/test/renderWithProviders';
import type {
  TAgentOption,
  TModelOption,
  TReasoningOption,
  TChatSelection,
} from '@app/Domains/Chat/Chat.entity';
import { ChatSelector, type ChatSelectorProps } from '../ChatSelector';

/**
 * Specs de `ChatSelector` (feature 009, T043, FR-008, FR-021, SC-008).
 *
 * Contrato: `specs/009-interactive-chat/contracts/chat-panel-contract.md` §3.
 * P6: la variante de razonamiento se acota al modelo elegido; sin variantes el
 * selector queda vacío/deshabilitado y el envío sigue funcionando.
 *
 * Radix `Select` depende de APIs que jsdom no implementa
 * (`hasPointerCapture`/`releasePointerCapture`/`scrollIntoView`); se mockean y
 * se desactiva la comprobación de `pointer-events` en `userEvent`.
 */

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

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
  {
    id: 'claude',
    label: 'Claude',
    ref: { id: 'claude', providerID: 'anthropic' },
    reasoning: [],
  },
];

const EMPTY_SELECTION: TChatSelection = { agent: null, model: null, isDirty: false };

const renderSelector = (overrides: Partial<ChatSelectorProps> = {}) => {
  const onChange = vi.fn<ChatSelectorProps['onChange']>();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const view = renderWithProviders(
    <ChatSelector
      agents={AGENTS}
      models={MODELS}
      reasoning={REASONING}
      selection={EMPTY_SELECTION}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { user, onChange, view };
};

const getTrigger = (name: string): HTMLElement =>
  screen.getByRole('combobox', { name });

describe('ChatSelector', () => {
  it('renders the three accessible selectors (FR-008)', () => {
    renderSelector();

    expect(getTrigger('Agente')).toBeInTheDocument();
    expect(getTrigger('Modelo')).toBeInTheDocument();
    expect(getTrigger('Razonamiento')).toBeInTheDocument();
  });

  it('keeps each chip accessible via an sr-only label (U1)', () => {
    renderSelector();

    for (const name of ['Agente', 'Modelo', 'Razonamiento']) {
      const label = screen.getByText(name);
      const trigger = getTrigger(name);

      // a11y: el nombre accesible se asocia por `htmlFor` ↔ `id` y no hay label
      // visible encima del chip (solo lector de pantalla).
      expect(label).toHaveAttribute('for', trigger.id);
      expect(trigger).toHaveAttribute('id');
      expect(label).toHaveClass('sr-only');
    }
  });

  it('renders the three selectors as compact chips that wrap (U1)', () => {
    renderSelector();

    const triggers = ['Agente', 'Modelo', 'Razonamiento'].map(getTrigger);

    for (const trigger of triggers) {
      // Chips compactos: pastilla redondeada, ancho al contenido y altura pequeña.
      expect(trigger).toHaveClass('rounded-full');
      expect(trigger).toHaveClass('w-auto');
      expect(trigger).toHaveClass('h-8');
    }

    // La fila envuelve en pantallas estrechas en lugar de recortar los chips.
    expect(triggers[0]?.closest('.flex-wrap')).not.toBeNull();
  });

  it('offers the available agents and emits the chosen one (FR-008)', async () => {
    const { user, onChange } = renderSelector();

    await user.click(getTrigger('Agente'));
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Build', 'Plan']);

    await user.click(screen.getByRole('option', { name: 'Plan' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'plan' }),
    );
  });

  it('offers the available models (FR-008)', async () => {
    const { user } = renderSelector();

    await user.click(getTrigger('Modelo'));

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['GPT-4o', 'Claude']);
  });

  it('reflects the active selection on the triggers (FR-008)', () => {
    renderSelector({
      selection: {
        agent: 'build',
        model: { id: 'gpt-4o', providerID: 'openai', variant: 'high' },
        isDirty: false,
      },
    });

    expect(getTrigger('Agente')).toHaveTextContent('Build');
    expect(getTrigger('Modelo')).toHaveTextContent('GPT-4o');
    expect(getTrigger('Razonamiento')).toHaveTextContent('Alto');
  });

  it('scopes the reasoning options to the selected model (FR-008, P6)', async () => {
    const { user } = renderSelector({
      selection: {
        agent: null,
        model: { id: 'gpt-4o', providerID: 'openai' },
        isDirty: false,
      },
    });

    await user.click(getTrigger('Razonamiento'));

    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Bajo', 'Alto']);
  });

  it('leaves reasoning empty and disabled when the model has no variants (edge case)', () => {
    renderSelector({ reasoning: [] });

    const reasoning = getTrigger('Razonamiento');
    expect(reasoning).toBeDisabled();
    expect(reasoning).toHaveAttribute('data-placeholder');

    // El resto de selectores sigue operativo: el envío no se bloquea.
    expect(getTrigger('Agente')).toBeEnabled();
    expect(getTrigger('Modelo')).toBeEnabled();
  });

  it('emits the chosen model dropping the previous variant', async () => {
    const { user, onChange } = renderSelector({
      selection: {
        agent: null,
        model: { id: 'claude', providerID: 'anthropic', variant: 'x' },
        isDirty: false,
      },
    });

    await user.click(getTrigger('Modelo'));
    await user.click(screen.getByRole('option', { name: 'GPT-4o' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].model).toEqual({
      id: 'gpt-4o',
      providerID: 'openai',
    });
  });

  it('emits the chosen reasoning variant keeping the model (FR-008)', async () => {
    const { user, onChange } = renderSelector({
      selection: {
        agent: null,
        model: { id: 'gpt-4o', providerID: 'openai' },
        isDirty: false,
      },
    });

    await user.click(getTrigger('Razonamiento'));
    await user.click(screen.getByRole('option', { name: 'Alto' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].model).toEqual({
      id: 'gpt-4o',
      providerID: 'openai',
      variant: 'high',
    });
  });

  it('is operable by keyboard (FR-021)', async () => {
    const { user } = renderSelector();
    const trigger = getTrigger('Agente');

    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('option')).toHaveLength(AGENTS.length);
  });

  it('disables every selector while a write is pending', () => {
    renderSelector({ isPending: true });

    expect(getTrigger('Agente')).toBeDisabled();
    expect(getTrigger('Modelo')).toBeDisabled();
    expect(getTrigger('Razonamiento')).toBeDisabled();
  });
});
