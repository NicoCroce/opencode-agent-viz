import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type {
  THistoryAnswerEntry,
  THistoryEntry,
  THistoryToolEntry,
  THistoryUserEntry,
} from '@app/Domains/History';
import type { TChatTimelineEntry } from '../../Chat.entity';
import { buildChatTimeline } from '../../lib/buildChatTimeline';
import {
  CHAT_ENTRY_HIGHLIGHT_CLASS,
  ChatTimeline,
  TURN_FINISHED_ANNOUNCEMENT,
  TURN_IN_PROGRESS_ANNOUNCEMENT,
  chatEntryAnchorId,
  scrollEntryIntoView,
} from '../ChatTimeline';

/**
 * FR-002/FR-003, SC-004 (`contracts/chat-stream-contract.md` §4): las partes
 * provisionales se renderizan en **texto plano** + "En curso" (sin markdown, el
 * hot spot del delta) y las consolidadas con `HistoryEntryBody`/`RichText`. El
 * render es **neutro** (sin franjas ni etiquetas mayúsculas de tipo) y el anuncio
 * accesible (`role="status"`) solo cambia al inicio/fin del turno, nunca por
 * delta (FR-021).
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

    expect(screen.getByText('mundo').tagName).toBe('STRONG');
    // Render neutro: sin etiqueta mayúscula de tipo para las consolidadas.
    expect(screen.queryByText('Respuesta')).not.toBeInTheDocument();
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

/** Prompt propio (entrada del usuario) consolidado. */
const userHistory = (text: string): THistoryUserEntry => ({
  kind: 'user',
  id: 'u1:0',
  at: 900,
  text,
  attachments: [],
});

/** Llamada a herramienta consolidada (kind `tool`). */
const toolHistory = (
  overrides: Partial<THistoryToolEntry> = {},
): THistoryToolEntry => ({
  kind: 'tool',
  id: 'a1:1',
  at: 1500,
  entry: {
    id: 'tool-1',
    name: 'read',
    status: 'completed',
    input: { path: 'a.ts' },
    result: 'contents',
    error: null,
    startedAt: 1000,
    completedAt: 1200,
    durationMs: 200,
  },
  ...overrides,
});

const toolConsolidated = (): TChatTimelineEntry => ({
  id: 'a1:1',
  role: 'agent',
  kind: 'tool',
  text: '',
  isComplete: true,
  at: 1500,
  history: toolHistory(),
});

const anchorOf = (entryId: string): HTMLElement | null =>
  document.querySelector(`[data-chat-entry-id="${entryId}"]`);

describe('ChatTimeline — filtro de herramientas (U3)', () => {
  it('muestra las herramientas por defecto', () => {
    render(
      <ChatTimeline entries={[consolidated(answerHistory()), toolConsolidated()]} />,
    );

    expect(anchorOf('a1:1')).not.toBeNull();
  });

  it('oculta las entradas de herramienta con showTools=false sin tocar el resto', () => {
    render(
      <ChatTimeline
        entries={[consolidated(answerHistory()), toolConsolidated()]}
        showTools={false}
      />,
    );

    expect(anchorOf('a1:1')).toBeNull();
    // La respuesta (no herramienta) sigue visible.
    expect(anchorOf('a1:0')).not.toBeNull();
  });

  it('no rompe el anuncio del turno al filtrar (role="status")', () => {
    render(<ChatTimeline entries={[toolConsolidated()]} showTools={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      TURN_FINISHED_ANNOUNCEMENT,
    );
  });
});

describe('ChatTimeline — anclas y resaltado del salto (U4)', () => {
  it('expone un ancla estable por fila', () => {
    render(<ChatTimeline entries={[consolidated(answerHistory())]} />);

    const anchor = anchorOf('a1:0');
    expect(anchor).not.toBeNull();
    expect(anchor).toHaveAttribute('id', chatEntryAnchorId('a1:0'));
  });

  it('resalta solo la entrada indicada y con un estilo no solo-color', () => {
    render(
      <ChatTimeline
        entries={[
          consolidated(answerHistory()),
          consolidated(userHistory('hola')),
        ]}
        highlightedEntryId="u1:0"
      />,
    );

    const highlighted = anchorOf('u1:0');
    const other = anchorOf('a1:0');

    expect(highlighted).toHaveAttribute('data-highlighted', 'true');
    expect(highlighted?.className).toContain(CHAT_ENTRY_HIGHLIGHT_CLASS);
    // El resaltado añade fondo **y** contorno (no depende solo del color).
    expect(highlighted?.className).toContain('outline');
    expect(other).not.toHaveAttribute('data-highlighted');
  });

  it('no resalta nada sin entrada indicada', () => {
    render(<ChatTimeline entries={[consolidated(answerHistory())]} />);

    expect(anchorOf('a1:0')).not.toHaveAttribute('data-highlighted');
  });

  it('omite el envoltorio-ancla del razonamiento oculto (FR-002)', () => {
    render(
      <ChatTimeline
        entries={[provisional({ kind: 'reasoning', text: 'pienso' })]}
        showReasoning={false}
      />,
    );

    // Sin `showReasoning` la fila no se pinta: tampoco deja un ancla vacía.
    expect(anchorOf('stream:msg_1:0')).toBeNull();
  });
});

describe('scrollEntryIntoView (U4)', () => {
  it('desplaza el contenedor hasta el ancla (nunca window)', () => {
    const container = document.createElement('div');
    const target = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ top: 100 }) as unknown as DOMRect;
    target.getBoundingClientRect = () =>
      ({ top: 350 }) as unknown as DOMRect;
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 40,
    });
    const scrollTo = vi.fn();
    (container as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;

    scrollEntryIntoView(container, target, 'smooth');

    // top = scrollTop + (target.top - container.top) = 40 + 250.
    expect(scrollTo).toHaveBeenCalledWith({ top: 290, behavior: 'smooth' });
  });

  it('cae a scrollTop cuando el contenedor no expone scrollTo', () => {
    const container = document.createElement('div');
    const target = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ top: 0 }) as unknown as DOMRect;
    target.getBoundingClientRect = () =>
      ({ top: 75 }) as unknown as DOMRect;
    (container as unknown as { scrollTo: undefined }).scrollTo = undefined;
    let assigned: number | undefined;
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      get: () => assigned ?? 0,
      set: (value: number) => {
        assigned = value;
      },
    });

    scrollEntryIntoView(container, target);

    expect(container.scrollTop).toBe(75);
  });
});
