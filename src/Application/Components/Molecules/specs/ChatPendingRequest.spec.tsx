import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import { ChatPendingRequest } from '../ChatPendingRequest';

/**
 * El `Checkbox` de Radix dentro de un `<form>` monta su input "bubble", que usa
 * `ResizeObserver`; jsdom no lo implementa, así que se stubbea (mismo patrón que
 * los mocks de puntero de `TimeRangeFilter`/`ChatComposer`).
 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

/**
 * Specs de la molecule pura `ChatPendingRequest` (FR-005, FR-017, FR-023; W8, W10).
 *
 * Contrato: `specs/009-interactive-chat/contracts/write-facade-contract.md` §5 y
 * `chat-panel-contract.md` §6. La molecule renderiza **un** pendiente —permiso o
 * pregunta— y permite responderlo inline. Es presentacional: recibe los datos y
 * los callbacks, no conoce el SDK ni los servicios.
 *
 * - Permiso: `action`/`resources[]` visibles **antes** de confirmar y decisión
 *   explícita `once`/`always`/`reject` (FR-005, FR-017).
 * - Pregunta: formulario mínimo por tipo de campo reusando los view-models de
 *   `Application/Helpers/questionState`; un tipo desconocido **no** rompe (W10).
 * - Accesible: `role=status`, foco programático y labels asociados (FR-021).
 */

const permission = {
  id: 'per_1',
  action: 'bash',
  resources: ['rm -rf /tmp/build', '/etc/hosts'],
  message: 'El agente quiere ejecutar un comando',
};

const stringQuestion: TQuestionEntry = {
  id: 'form_string',
  title: 'Nombre del proyecto',
  state: 'pending',
  answer: null,
  fields: [{ key: 'name', title: 'Nombre', type: 'string', options: [] }],
};

const booleanQuestion: TQuestionEntry = {
  id: 'form_boolean',
  title: 'Opciones de despliegue',
  state: 'pending',
  answer: null,
  fields: [{ key: 'flag', title: 'Activar', type: 'boolean', options: [] }],
};

const multiselectQuestion: TQuestionEntry = {
  id: 'form_multiselect',
  title: 'Etiquetas',
  state: 'pending',
  answer: null,
  fields: [
    {
      key: 'tags',
      title: 'Etiquetas',
      type: 'multiselect',
      options: [
        { value: 'a', label: 'Alfa' },
        { value: 'b', label: 'Beta' },
      ],
    },
  ],
};

/** Campo con un `type` que el formulario no conoce: debe caer en fallback (W10). */
const unknownQuestion: TQuestionEntry = {
  id: 'form_unknown',
  title: 'Pregunta con campo raro',
  state: 'pending',
  answer: null,
  fields: [
    { key: 'mystery', title: 'Campo desconocido', type: 'quantum', options: [] },
  ],
};

const allFieldTypesQuestion: TQuestionEntry = {
  id: 'form_all',
  title: 'Pregunta completa',
  state: 'pending',
  answer: null,
  fields: [
    { key: 'name', title: 'Nombre', type: 'string', options: [] },
    { key: 'count', title: 'Cantidad', type: 'number', options: [] },
    { key: 'enabled', title: 'Habilitado', type: 'boolean', options: [] },
    {
      key: 'tags',
      title: 'Etiquetas',
      type: 'multiselect',
      options: [{ value: 'a', label: 'Alfa' }],
    },
    { key: 'link', title: 'Enlace externo', type: 'external', options: [] },
    { key: 'mystery', title: 'Campo raro', type: 'quantum', options: [] },
  ],
};

const renderPermission = (
  props: Partial<{ isPending: boolean; autoFocus: boolean }> = {},
  onReplyPermission = vi.fn(),
) => {
  render(
    <ChatPendingRequest
      kind="permission"
      permission={permission}
      onReplyPermission={onReplyPermission}
      {...props}
    />,
  );
  return { onReplyPermission };
};

const renderQuestion = (
  question: TQuestionEntry,
  props: Partial<{ isPending: boolean; autoFocus: boolean }> = {},
  onReplyForm = vi.fn(),
) => {
  const user = userEvent.setup();
  render(
    <ChatPendingRequest
      kind="question"
      question={question}
      onReplyForm={onReplyForm}
      {...props}
    />,
  );
  return { user, onReplyForm };
};

describe('ChatPendingRequest — permiso', () => {
  it('muestra action y resources[] antes de confirmar (FR-017)', () => {
    renderPermission();

    expect(screen.getByText('Permiso: bash')).toBeInTheDocument();
    expect(
      screen.getByText('Recursos: rm -rf /tmp/build, /etc/hosts'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El agente quiere ejecutar un comando'),
    ).toBeInTheDocument();
  });

  it('ofrece las tres decisiones explícitas (FR-005)', () => {
    renderPermission();

    expect(
      screen.getByRole('button', { name: 'Permitir una vez' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Permitir siempre' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rechazar' }),
    ).toBeInTheDocument();
  });

  it('anuncia el pendiente con role=status (FR-021)', () => {
    renderPermission();

    expect(screen.getByRole('status')).toHaveTextContent(/Permiso pendiente/);
  });

  it('notifica la decisión elegida por onReplyPermission (FR-005)', async () => {
    const user = userEvent.setup();
    const { onReplyPermission } = renderPermission();

    await user.click(screen.getByRole('button', { name: 'Permitir una vez' }));
    await user.click(screen.getByRole('button', { name: 'Permitir siempre' }));
    await user.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(onReplyPermission).toHaveBeenNthCalledWith(1, 'once');
    expect(onReplyPermission).toHaveBeenNthCalledWith(2, 'always');
    expect(onReplyPermission).toHaveBeenNthCalledWith(3, 'reject');
  });

  it('expone la acción y el recurso autorizados en la decisión "siempre" (FR-017)', () => {
    renderPermission();

    const always = screen.getByRole('button', { name: 'Permitir siempre' });
    const describedBy = always.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const description = document.getElementById(describedBy as string);
    expect(description).toHaveTextContent(/bash/);
    expect(description).toHaveTextContent(/\/etc\/hosts/);
  });

  it('bloquea las decisiones y anuncia aria-busy mientras isPending', () => {
    renderPermission({ isPending: true });

    const always = screen.getByRole('button', { name: 'Permitir siempre' });
    expect(always).toBeDisabled();
    expect(always).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled();
  });

  it('lleva el foco al pendiente cuando autoFocus está activo (FR-021)', () => {
    renderPermission({ autoFocus: true });

    expect(
      screen.getByRole('group', { name: 'Permiso pendiente' }),
    ).toHaveFocus();
  });
});

describe('ChatPendingRequest — pregunta', () => {
  it('renderiza título, anuncio y un control por tipo de campo (FR-005)', () => {
    renderQuestion(allFieldTypesQuestion);

    expect(screen.getByText('Pregunta completa')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Pregunta pendiente/);
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Habilitado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Alfa' })).toBeInTheDocument();
    expect(screen.getByText('Enlace externo')).toBeInTheDocument();
    expect(screen.getByLabelText('Campo raro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Responder' })).toBeInTheDocument();
  });

  it('mapea la respuesta por field.key al enviar (FR-005)', async () => {
    const { user, onReplyForm } = renderQuestion(stringQuestion);

    await user.type(screen.getByLabelText('Nombre'), 'hola');
    await user.click(screen.getByRole('button', { name: 'Responder' }));

    expect(onReplyForm).toHaveBeenCalledWith({ name: 'hola' });
  });

  it('resuelve un campo boolean como valor booleano', async () => {
    const { user, onReplyForm } = renderQuestion(booleanQuestion);

    await user.click(screen.getByRole('checkbox', { name: 'Activar' }));
    await user.click(screen.getByRole('button', { name: 'Responder' }));

    expect(onReplyForm).toHaveBeenCalledWith({ flag: true });
  });

  it('resuelve un multiselect como lista de valores elegidos', async () => {
    const { user, onReplyForm } = renderQuestion(multiselectQuestion);

    await user.click(screen.getByRole('checkbox', { name: 'Alfa' }));
    await user.click(screen.getByRole('button', { name: 'Responder' }));

    expect(onReplyForm).toHaveBeenCalledWith({ tags: ['a'] });
  });

  it('no rompe con un tipo de campo desconocido y usa un fallback (W10)', async () => {
    const { user, onReplyForm } = renderQuestion(unknownQuestion);

    const control = screen.getByLabelText('Campo desconocido');
    await user.type(control, 'x');
    await user.click(screen.getByRole('button', { name: 'Responder' }));

    expect(onReplyForm).toHaveBeenCalledWith({ mystery: 'x' });
  });

  it('bloquea el envío mientras isPending', () => {
    renderQuestion(stringQuestion, { isPending: true });

    const submit = screen.getByRole('button', { name: 'Responder' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
  });

  it('lleva el foco al pendiente cuando autoFocus está activo (FR-021)', () => {
    renderQuestion(stringQuestion, { autoFocus: true });

    expect(
      screen.getByRole('group', { name: 'Pregunta pendiente' }),
    ).toHaveFocus();
  });
});
