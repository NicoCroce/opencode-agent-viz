import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type {
  THistoryCompactionEntry,
  THistoryQuestionEntry,
} from '@app/Domains/History/History.entity';
import { HistoryEntry } from '../HistoryEntry';

const compaction = (): THistoryCompactionEntry => ({
  kind: 'compaction',
  id: 'compaction-1',
  at: 1,
  status: 'completed',
  reason: 'auto',
  summary: null,
});

const question = (
  state: THistoryQuestionEntry['state'],
  answer: string | null,
): THistoryQuestionEntry => ({
  kind: 'question',
  id: 'question-1',
  at: 1,
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

describe('HistoryEntry', () => {
  it('renders the injected compaction context with the session on a compaction episode', () => {
    render(
      <HistoryEntry
        entry={compaction()}
        sessionId="ses-42"
        renderCompactionContext={(sessionId) => (
          <span data-testid="compaction-context">{sessionId}</span>
        )}
      />,
    );

    expect(screen.getByTestId('compaction-context')).toHaveTextContent('ses-42');
  });

  it('omits the compaction context when there is no session or no render', () => {
    const { rerender } = render(<HistoryEntry entry={compaction()} />);
    expect(screen.queryByTestId('compaction-context')).not.toBeInTheDocument();

    rerender(
      <HistoryEntry entry={compaction()} sessionId="ses-42" />,
    );
    expect(screen.queryByTestId('compaction-context')).not.toBeInTheDocument();
  });

  it('renders an answered question with its options and answer (FR-033)', () => {
    render(<HistoryEntry entry={question('answered', 'choice: a')} />);

    expect(screen.getByText('Pregunta')).toBeInTheDocument();
    expect(screen.getByText('¿Qué hago?')).toBeInTheDocument();
    expect(screen.getByText('respondida')).toBeInTheDocument();
    expect(screen.getByText(/Opción · A, B/)).toBeInTheDocument();
    expect(screen.getByText('Respuesta: choice: a')).toBeInTheDocument();
  });

  it('distinguishes a cancelled question from an answered one (FR-033)', () => {
    render(<HistoryEntry entry={question('cancelled', null)} />);

    expect(screen.getByText('cancelada')).toBeInTheDocument();
    expect(screen.queryByText('respondida')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Respuesta:/)).not.toBeInTheDocument();
  });
});
