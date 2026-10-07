import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
