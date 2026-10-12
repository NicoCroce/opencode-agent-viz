import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TPermissionEntry, TQuestionEntry } from '../../Inspector.entity';
import { QuestionsSection } from '../QuestionsSection';

const permission = (
  overrides: Partial<TPermissionEntry> = {},
): TPermissionEntry => ({
  id: 'perm-1',
  action: 'bash',
  resources: ['rm -rf build'],
  message: 'Permiso requerido',
  ...overrides,
});

const question = (
  overrides: Partial<TQuestionEntry> = {},
): TQuestionEntry => ({
  id: 'q-1',
  title: '¿Aplicar el cambio?',
  fields: [
    { key: 'confirm', title: 'Confirmar', type: 'boolean', options: [] },
  ],
  state: 'pending',
  answer: null,
  ...overrides,
});

/**
 * Pregunta con un campo de texto: el formulario accionable (`ChatPendingRequest`)
 * usa un `Input` y evita el `ResizeObserver` que jsdom no implementa para los
 * `Checkbox` de Radix.
 */
const stringQuestion = (
  overrides: Partial<TQuestionEntry> = {},
): TQuestionEntry => ({
  id: 'q-string',
  title: '¿Nombre del proyecto?',
  fields: [{ key: 'name', title: 'Nombre', type: 'string', options: [] }],
  state: 'pending',
  answer: null,
  ...overrides,
});

describe('QuestionsSection', () => {
  it('lists a permission with its action, resources and message', () => {
    render(
      <QuestionsSection
        permissions={[permission()]}
        questions={[]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.getByText('rm -rf build')).toBeInTheDocument();
    expect(screen.getByText('Permiso requerido')).toBeInTheDocument();
  });

  it('shows a pending question with its fields and options but no answer', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[
          question({
            title: '¿Seguir?',
            state: 'pending',
            fields: [
              {
                key: 'choice',
                title: 'Elige',
                type: 'multiselect',
                options: [{ value: 'a', label: 'Opción A' }],
              },
            ],
          }),
        ]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('¿Seguir?')).toBeInTheDocument();
    expect(screen.getByText('pendiente')).toBeInTheDocument();
    expect(screen.getByText(/Opción A/)).toBeInTheDocument();
    expect(screen.queryByText(/Respuesta:/)).not.toBeInTheDocument();
  });

  it('shows the answer of an answered question', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[question({ state: 'answered', answer: 'confirm: true' })]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('respondida')).toBeInTheDocument();
    expect(screen.getByText('Respuesta: confirm: true')).toBeInTheDocument();
  });

  it('never shows a cancelled question as answered', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[question({ state: 'cancelled', answer: 'confirm: true' })]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('cancelada')).toBeInTheDocument();
    expect(screen.queryByText('respondida')).not.toBeInTheDocument();
    expect(screen.queryByText(/Respuesta:/)).not.toBeInTheDocument();
  });

  it('shows the number of queued turns', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[question()]}
        queuedTurns={3}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('Turnos en cola: 3')).toBeInTheDocument();
  });

  it('shows an explicit empty state without permissions, questions or queue', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('Sin permisos ni preguntas')).toBeInTheDocument();
  });

  it('shows the error state without the empty state', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[]}
        queuedTurns={0}
        isError
        isLoading={false}
      />,
    );

    expect(
      screen.getByText('Ocurrió un error al cargar los datos'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Sin permisos ni preguntas'),
    ).not.toBeInTheDocument();
  });

  it('does not show the empty state while loading', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[]}
        queuedTurns={0}
        isError={false}
        isLoading
      />,
    );

    expect(
      screen.queryByText('Sin permisos ni preguntas'),
    ).not.toBeInTheDocument();
  });

  it('stays read-only by default, without actionable controls (FR-005)', () => {
    render(
      <QuestionsSection
        permissions={[permission()]}
        questions={[stringQuestion()]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.queryByText('Permiso: bash')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Permitir una vez' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Responder' }),
    ).not.toBeInTheDocument();
  });

  it('renders an actionable permission with the explicit decisions (FR-005)', async () => {
    const user = userEvent.setup();
    const onReplyPermission = vi.fn();
    render(
      <QuestionsSection
        permissions={[permission()]}
        questions={[]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
        actionable
        onReplyPermission={onReplyPermission}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Permitir una vez' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Permitir siempre' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rechazar' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Permitir siempre' }));

    expect(onReplyPermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'perm-1' }),
      'always',
    );
  });

  it('renders an actionable pending question and reports its answer (FR-005)', async () => {
    const user = userEvent.setup();
    const onReplyForm = vi.fn();
    render(
      <QuestionsSection
        permissions={[]}
        questions={[stringQuestion()]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
        actionable
        onReplyForm={onReplyForm}
      />,
    );

    await user.type(screen.getByLabelText('Nombre'), 'hola');
    await user.click(screen.getByRole('button', { name: 'Responder' }));

    expect(onReplyForm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'q-string' }),
      { name: 'hola' },
    );
  });

  it('keeps an answered question read-only even in actionable mode (FR-033)', () => {
    render(
      <QuestionsSection
        permissions={[]}
        questions={[question({ state: 'answered', answer: 'confirm: true' })]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
        actionable
        onReplyForm={vi.fn()}
      />,
    );

    expect(screen.getByText('respondida')).toBeInTheDocument();
    expect(screen.getByText('Respuesta: confirm: true')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Responder' }),
    ).not.toBeInTheDocument();
  });

  it('blocks the actionable controls while isPending (FR-004)', () => {
    render(
      <QuestionsSection
        permissions={[permission()]}
        questions={[]}
        queuedTurns={0}
        isError={false}
        isLoading={false}
        actionable
        onReplyPermission={vi.fn()}
        isPending
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Permitir una vez' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled();
  });
});
