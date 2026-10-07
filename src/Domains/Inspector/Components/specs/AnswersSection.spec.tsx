import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReasoningVisibility } from '@app/Application/Hooks';
import type {
  THistoryEntry,
  THistoryQuestionState,
} from '@app/Domains/History/History.entity';
import { AnswersSection } from '../AnswersSection';

const userEntry = (text: string, at = 1): THistoryEntry => ({
  kind: 'user',
  id: `user-${at}`,
  at,
  text,
  attachments: [],
});

const answer = (
  id: string,
  at: number,
  text: string,
  isComplete = true,
): THistoryEntry => ({ kind: 'answer', id, at, text, isComplete });

const reasoning = (
  id: string,
  at: number,
  text: string,
  isComplete = true,
): THistoryEntry => ({ kind: 'reasoning', id, at, text, isComplete });

const tool = (id: string, at: number, name: string): THistoryEntry => ({
  kind: 'tool',
  id,
  at,
  entry: {
    id,
    name,
    status: 'completed',
    input: { path: 'a.ts' },
    result: 'ok',
    error: null,
    startedAt: at,
    completedAt: at + 10,
    durationMs: 10,
  },
});

const idle = (at: number): THistoryEntry => ({
  kind: 'idle',
  id: `idle-${at}`,
  at,
  outcome: 'succeeded',
});

const question = (
  at: number,
  state: THistoryQuestionState,
  answer: string | null,
): THistoryEntry => ({
  kind: 'question',
  id: `question-${at}`,
  at,
  formId: 'q1',
  title: '¿Qué hago?',
  fields: [
    {
      key: 'choice',
      title: 'Opción',
      type: 'multiselect',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    },
  ],
  state,
  answer,
  anchorId: 't-q',
  anchored: true,
});

/** Harness controlado para ejercitar el toggle con `useReasoningVisibility`. */
const Harness = ({ entries }: { entries: THistoryEntry[] }) => {
  const { visible, toggle } = useReasoningVisibility(false);
  return (
    <AnswersSection
      entries={entries}
      showReasoning={visible}
      onToggleReasoning={toggle}
    />
  );
};

describe('AnswersSection', () => {
  it('lists answers in order with the tool calls interleaved', () => {
    const { container } = render(
      <AnswersSection
        entries={[
          userEntry('Mensaje del usuario', 1),
          answer('a1', 2, 'Primera respuesta'),
          tool('t1', 3, 'read'),
          answer('a2', 4, 'Segunda respuesta'),
          idle(5),
        ]}
        showReasoning={false}
        onToggleReasoning={() => {}}
      />,
    );

    const first = screen.getByText('Primera respuesta');
    const toolButton = screen.getByRole('button', { name: /read/i });
    const second = screen.getByText('Segunda respuesta');

    // Orden cronológico: respuesta → herramienta → respuesta.
    expect(
      first.compareDocumentPosition(toolButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      toolButton.compareDocumentPosition(second) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // El mensaje del usuario es una entrada propia, distinguible de la respuesta.
    expect(screen.getByText('Mensaje del usuario')).toBeInTheDocument();
    expect(screen.getByText('Usuario')).toBeInTheDocument();

    // Las entradas no conversacionales (idle) no aparecen en esta sección.
    expect(container.textContent).not.toContain('Cierre de turno');
  });

  it('toggles reasoning without hiding the answers', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        entries={[
          answer('a1', 1, 'Respuesta visible'),
          reasoning('r1', 2, 'Razonamiento oculto'),
        ]}
      />,
    );

    expect(screen.getByText('Respuesta visible')).toBeInTheDocument();
    expect(screen.queryByText('Razonamiento oculto')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /razonamiento/i }));

    expect(screen.getByText('Razonamiento oculto')).toBeInTheDocument();
    expect(screen.getByText('Respuesta visible')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /razonamiento/i }));

    expect(screen.queryByText('Razonamiento oculto')).not.toBeInTheDocument();
    expect(screen.getByText('Respuesta visible')).toBeInTheDocument();
  });

  it('exposes the reasoning state through aria-pressed', () => {
    const { rerender } = render(
      <AnswersSection
        entries={[]}
        showReasoning={false}
        onToggleReasoning={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: /razonamiento/i }),
    ).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <AnswersSection
        entries={[]}
        showReasoning
        onToggleReasoning={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: /razonamiento/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks an unconsolidated answer as in progress without partial text', () => {
    render(
      <AnswersSection
        entries={[answer('a1', 1, 'texto parcial', false)]}
        showReasoning
        onToggleReasoning={() => {}}
      />,
    );

    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.queryByText('texto parcial')).not.toBeInTheDocument();
  });

  it('shows an explicit empty state when there are no answers', () => {
    render(
      <AnswersSection
        entries={[]}
        showReasoning={false}
        onToggleReasoning={() => {}}
      />,
    );

    expect(screen.getByText('Sin respuestas todavía')).toBeInTheDocument();
  });

  it('shows the tools and an explicit empty text state when there is no text', () => {
    render(
      <AnswersSection
        entries={[tool('t1', 1, 'grep')]}
        showReasoning={false}
        onToggleReasoning={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /grep/i })).toBeInTheDocument();
    expect(screen.getByText('Sin respuestas todavía')).toBeInTheDocument();
  });

  it('renders an answered question with its options and answer (FR-033)', () => {
    render(
      <AnswersSection
        entries={[question(1, 'answered', 'choice: a')]}
        showReasoning={false}
        onToggleReasoning={() => {}}
      />,
    );

    expect(screen.getByText('¿Qué hago?')).toBeInTheDocument();
    expect(screen.getByText('respondida')).toBeInTheDocument();
    expect(screen.getByText(/Opción · A, B/)).toBeInTheDocument();
    expect(screen.getByText('Respuesta: choice: a')).toBeInTheDocument();
    // Una pregunta es contenido: no se muestra el vacío "Sin respuestas".
    expect(
      screen.queryByText('Sin respuestas todavía'),
    ).not.toBeInTheDocument();
  });

  it('shows a pending question without presenting it as answered (FR-033)', () => {
    render(
      <AnswersSection
        entries={[question(1, 'pending', null)]}
        showReasoning={false}
        onToggleReasoning={() => {}}
      />,
    );

    expect(screen.getByText('pendiente')).toBeInTheDocument();
    expect(screen.queryByText('respondida')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Respuesta:/)).not.toBeInTheDocument();
  });

  it('exposes the "Ver histórico completo" button through onOpenHistory', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();

    render(
      <AnswersSection
        entries={[]}
        showReasoning={false}
        onToggleReasoning={() => {}}
        onOpenHistory={onOpenHistory}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Ver histórico completo' }),
    );

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });
});
