import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryAnswerEntry, THistoryEntry } from '@app/Domains/History';
import type { TChatTimelineEntry } from '../../Chat.entity';
import { buildChatTimeline } from '../../lib/buildChatTimeline';
import {
  ChatTimeline,
  TURN_FINISHED_ANNOUNCEMENT,
  TURN_IN_PROGRESS_ANNOUNCEMENT,
} from '../ChatTimeline';

/**
 * FR-002/FR-003, SC-004 (`contracts/chat-stream-contract.md` §4): las partes
 * provisionales se renderizan en **texto plano** + "En curso" (sin markdown, el
 * hot spot del delta) y las consolidadas con `HistoryEntry`/`RichText`. El
 * anuncio accesible (`role="status"`) solo cambia al inicio/fin del turno,
 * nunca por delta (FR-021).
 */

const answerHistory = (
  overrides: Partial<THistoryAnswerEntry> = {},
): THistoryAnswerEntry => ({
  kind: 'answer',
  id: 'a1:0',
  at: 1000,
  text: 'hola',
  isComplete: true,
  ...overrides,
});

/** Entrada consolidada: expone su `THistoryEntry` de origen. */
const consolidated = (history: THistoryEntry): TChatTimelineEntry => ({
  id: history.id,
  role: history.kind === 'user' ? 'user' : 'agent',
  kind: history.kind === 'reasoning' ? 'reasoning' : 'text',
  text:
    history.kind === 'answer' || history.kind === 'reasoning' ? history.text : '',
  isComplete: true,
  at: history.at,
  history,
});

/** Parte provisional del buffer (`history: null`, `isComplete: false`). */
const provisional = (
  overrides: Partial<TChatTimelineEntry> = {},
): TChatTimelineEntry => ({
  id: 'stream:msg_1:0',
  role: 'agent',
  kind: 'text',
  text: 'hola',
  isComplete: false,
  at: 1500,
  history: null,
  ...overrides,
});

const assistantMessage = (text: string, id = 'msg_1'): TSessionMessage => {
  const info: SessionMessageAssistant = {
    id,
    time: { created: 1000, completed: 2000 },
    type: 'assistant',
    agent: 'develop',
    model: { providerID: 'opencode', id: 'deepseek' },
    content: [{ type: 'text', text }],
  };
  return { info, parts: info.content };
};

describe('ChatTimeline', () => {
  it('renders consolidated entries with RichText (markdown saneado, SC-004)', () => {
    render(
      <ChatTimeline
        entries={[consolidated(answerHistory({ text: 'hola **mundo**' }))]}
      />,
    );

    expect(screen.getByText('Respuesta')).toBeInTheDocument();
    expect(screen.getByText('mundo').tagName).toBe('STRONG');
  });

  it('renders provisional parts as plain text with the "En curso" label (FR-002)', () => {
    render(<ChatTimeline entries={[provisional({ text: 'texto **crudo**' })]} />);

    expect(screen.getByText('texto **crudo**')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    // Texto plano: el markdown NO se interpreta durante el delta (SC-004).
    expect(screen.queryByText('crudo')).not.toBeInTheDocument();
    expect(document.querySelector('strong')).toBeNull();
  });

  it('hides provisional reasoning when reasoning is not visible (FR-002)', () => {
    const entry = provisional({ kind: 'reasoning', text: 'pienso' });
    const { rerender } = render(
      <ChatTimeline entries={[entry]} showReasoning={false} />,
    );

    expect(screen.queryByText('pienso')).not.toBeInTheDocument();

    rerender(<ChatTimeline entries={[entry]} showReasoning />);

    expect(screen.getByText('pienso')).toBeInTheDocument();
    expect(screen.getByText('Razonamiento')).toBeInTheDocument();
  });

  it('replaces the provisional part with the consolidated one without duplicating (FR-003)', () => {
    const entries = buildChatTimeline([assistantMessage('hola')], {
      assistantMessageID: 'msg_1',
      parts: { 0: { kind: 'text', text: 'hola', at: 1500 } },
    });

    render(<ChatTimeline entries={entries} />);

    expect(screen.getAllByText('hola')).toHaveLength(1);
    expect(screen.queryByText('En curso')).not.toBeInTheDocument();
  });

  it('announces turn start/end via role="status" and never per delta (FR-021)', () => {
    const { rerender } = render(
      <ChatTimeline entries={[provisional({ text: 'a' })]} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      TURN_IN_PROGRESS_ANNOUNCEMENT,
    );

    // Un delta más largo no cambia el anuncio (no se reanuncia por delta).
    rerender(
      <ChatTimeline entries={[provisional({ text: 'a'.repeat(500) })]} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      TURN_IN_PROGRESS_ANNOUNCEMENT,
    );

    rerender(<ChatTimeline entries={[consolidated(answerHistory())]} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      TURN_FINISHED_ANNOUNCEMENT,
    );
  });

  it('keeps the live region empty before any activity', () => {
    render(<ChatTimeline entries={[]} />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
