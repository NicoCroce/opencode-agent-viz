import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type {
  THistoryAnswerEntry,
  THistoryEntry,
  THistoryQuestionEntry,
  THistoryReasoningEntry,
  THistoryToolEntry,
  THistoryUserEntry,
} from '@app/Domains/History';
import type {
  TChatTimelineEntry,
  TChatTimelineKind,
} from '../../Chat.entity';
import { ChatMessageRow } from '../ChatMessageRow';

/**
 * Estética base del chat (unidad U1): `ChatMessageRow` es el render propio del
 * timeline, **neutro** —sin franjas `border-accent`/`border-status-*` ni
 * etiquetas mayúsculas de tipo— y alinea los mensajes propios (`role: 'user'`)
 * a la derecha y el resto a la izquierda. El cuerpo consolidado lo resuelve
 * `HistoryEntryBody` (presentación compartida).
 */

const userHistory = (text: string): THistoryUserEntry => ({
  kind: 'user',
  id: 'u1:0',
  at: 1000,
  text,
  attachments: [],
});

const answerHistory = (
  overrides: Partial<THistoryAnswerEntry> = {},
): THistoryAnswerEntry => ({
  kind: 'answer',
  id: 'a1:0',
  at: 2000,
  text: 'hola',
  isComplete: true,
  ...overrides,
});

/**
 * Entrada consolidada que expone su `THistoryEntry` de origen. Acotada a
 * `user`/`answer`: ambas se proyectan como `kind: 'text'` en el timeline (los
 * demás `kind` los cubre `entryOf`).
 */
const consolidated = (
  history: THistoryUserEntry | THistoryAnswerEntry,
): TChatTimelineEntry => ({
  id: history.id,
  role: history.kind === 'user' ? 'user' : 'agent',
  kind: 'text',
  text: 'text' in history ? history.text : '',
  isComplete: true,
  at: history.at,
  history,
});

/** Parte provisional del buffer (`history: null`). */
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

describe('ChatMessageRow — alineación', () => {
  it('alinea a la derecha los mensajes propios (role user)', () => {
    render(<ChatMessageRow entry={consolidated(userHistory('hola'))} />);

    const row = screen.getByTestId('chat-message-row');
    expect(row).toHaveAttribute('data-role', 'user');
    expect(row.className).toContain('self-end');
    expect(row.className).not.toContain('self-start');
  });

  it('alinea a la izquierda los mensajes del agente', () => {
    render(<ChatMessageRow entry={consolidated(answerHistory())} />);

    const row = screen.getByTestId('chat-message-row');
    expect(row).toHaveAttribute('data-role', 'agent');
    expect(row.className).toContain('self-start');
    expect(row.className).not.toContain('self-end');
  });
});

describe('ChatMessageRow — neutralidad', () => {
  it('no usa franjas de color ni etiquetas mayúsculas de tipo (consolidado)', () => {
    render(<ChatMessageRow entry={consolidated(answerHistory())} />);

    const row = screen.getByTestId('chat-message-row');
    // Sin franjas `border-accent`/`border-status-*` (las del Historial).
    expect(row.className).not.toMatch(/border-(accent|status)/);
    expect(row.className).not.toContain('border-l-2');
    // Sin la etiqueta mayúscula de tipo de `HistoryEntry`.
    expect(screen.queryByText('Respuesta')).not.toBeInTheDocument();
    expect(screen.queryByText('Usuario')).not.toBeInTheDocument();
  });

  it('renderiza la provisional con el indicador animado y markdown (no texto plano)', () => {
    render(<ChatMessageRow entry={provisional({ text: 'texto **crudo**' })} />);

    const row = screen.getByTestId('chat-message-row');
    expect(row.className).not.toMatch(/border-(accent|status)/);
    // Indicador animado en lugar del literal "En curso".
    expect(screen.getByTestId('chat-typing-indicator')).toBeInTheDocument();
    expect(screen.queryByText('En curso')).not.toBeInTheDocument();
    // El cuerpo se renderiza siempre en markdown (negrita interpretada).
    expect(screen.getByText('crudo').tagName).toBe('STRONG');
  });
});

/**
 * Casos borde de tipo (U1): la fila es **neutra** para toda entrada, no solo
 * para `text`. Tool, pregunta y razonamiento son `role: 'agent'` y deben
 * alinearse a la izquierda sin franjas de color ni la etiqueta mayúscula de tipo
 * que añade `HistoryEntry` (la del Historial).
 */
const reasoningHistory = (): THistoryReasoningEntry => ({
  kind: 'reasoning',
  id: 'a1:3',
  at: 2600,
  text: 'pienso',
  isComplete: true,
});

const toolHistory = (): THistoryToolEntry => ({
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
});

const questionHistory = (): THistoryQuestionEntry => ({
  kind: 'question',
  id: 'a1:2',
  at: 2500,
  formId: 'form_1',
  title: 'Nombre del proyecto',
  fields: [{ key: 'name', title: 'Nombre', type: 'string', options: [] }],
  state: 'pending',
  answer: null,
  anchorId: null,
  anchored: false,
});

/** Proyecta una entrada consolidada con el `kind` que le da `buildChatTimeline`. */
const entryOf = (
  history: THistoryEntry,
  kind: TChatTimelineKind,
): TChatTimelineEntry => ({
  id: history.id,
  role: history.kind === 'user' ? 'user' : 'agent',
  kind,
  text: 'text' in history ? history.text : '',
  isComplete: true,
  at: history.at,
  history,
});

describe('ChatMessageRow — casos borde de tipo (tool, pregunta, razonamiento)', () => {
  it('alinea a la izquierda una llamada a herramienta, sin franja ni etiqueta de tipo', () => {
    render(<ChatMessageRow entry={entryOf(toolHistory(), 'tool')} />);

    const row = screen.getByTestId('chat-message-row');
    expect(row).toHaveAttribute('data-role', 'agent');
    expect(row.className).toContain('self-start');
    expect(row.className).not.toContain('self-end');
    expect(row.className).not.toMatch(/border-(accent|status)/);
    // La etiqueta mayúscula de tipo es de `HistoryEntry`, no de la fila del chat.
    expect(screen.queryByText('Herramienta')).not.toBeInTheDocument();
    // El cuerpo compartido sí renderiza la llamada (nombre de la herramienta).
    expect(screen.getByText('read')).toBeInTheDocument();
  });

  it('alinea a la izquierda una pregunta al usuario, neutra y sin etiqueta de tipo', () => {
    render(<ChatMessageRow entry={entryOf(questionHistory(), 'question')} />);

    const row = screen.getByTestId('chat-message-row');
    expect(row).toHaveAttribute('data-role', 'agent');
    expect(row.className).toContain('self-start');
    expect(row.className).not.toMatch(/border-(accent|status)/);
    expect(screen.queryByText('Pregunta')).not.toBeInTheDocument();
    expect(screen.getByText('Nombre del proyecto')).toBeInTheDocument();
  });

  it('alinea a la izquierda el razonamiento consolidado (role agent)', () => {
    render(<ChatMessageRow entry={entryOf(reasoningHistory(), 'reasoning')} />);

    const row = screen.getByTestId('chat-message-row');
    expect(row).toHaveAttribute('data-role', 'agent');
    expect(row.className).toContain('self-start');
    expect(row.className).not.toContain('self-end');
    expect(row.className).not.toMatch(/border-(accent|status)/);
    expect(screen.getByText('pienso')).toBeInTheDocument();
  });
});

describe('ChatMessageRow — cuerpo compartido y visibilidad', () => {
  it('reutiliza HistoryEntryBody (markdown saneado en el consolidado)', () => {
    render(
      <ChatMessageRow
        entry={consolidated(answerHistory({ text: 'hola **mundo**' }))}
      />,
    );

    expect(screen.getByText('mundo').tagName).toBe('STRONG');
  });

  it('oculta el razonamiento cuando showReasoning es false', () => {
    const entry = provisional({ kind: 'reasoning', text: 'pienso' });
    const { rerender } = render(
      <ChatMessageRow entry={entry} showReasoning={false} />,
    );

    expect(screen.queryByText('pienso')).not.toBeInTheDocument();

    rerender(<ChatMessageRow entry={entry} showReasoning />);

    expect(screen.getByText('pienso')).toBeInTheDocument();
    expect(screen.getByText('Razonamiento')).toBeInTheDocument();
  });
});

/**
 * Contención de ancho (fix UX del chat): el `article` de la fila puede encoger
 * por debajo de su `min-content` (`min-w-0`) y envuelve palabras/URLs largas
 * (`break-words`) para no ensanchar el hilo. Los bloques de código (`pre`) del
 * markdown compartido conservan su **scroll horizontal propio** y no se envuelven
 * (no se toca `RichText`). En jsdom no hay layout real: se verifica por clases.
 */
describe('ChatMessageRow — contención de ancho (UX, fix)', () => {
  it('permite encoger la fila y envolver el texto largo (min-w-0 + break-words)', () => {
    render(
      <ChatMessageRow
        entry={consolidated(
          answerHistory({
            text: 'https://example.com/ruta/muy/larga/sin/espacios/que/no/deberia/desbordar',
          }),
        )}
      />,
    );

    const row = screen.getByTestId('chat-message-row');
    expect(row).toHaveClass('min-w-0');
    expect(row).toHaveClass('break-words');
    // El tope de ancho relativo se conserva.
    expect(row).toHaveClass('max-w-[85%]');
  });

  it('no envuelve los bloques de código: conservan su scroll horizontal propio', () => {
    render(
      <ChatMessageRow
        entry={consolidated(answerHistory({ text: '```\nconst x = 1;\n```' }))}
      />,
    );

    const row = screen.getByTestId('chat-message-row');
    // `break-words` vive en la fila y es heredable, pero `pre` fija
    // `white-space: pre` + `overflow-x-auto`, así que mantiene su scroll interno.
    expect(row).toHaveClass('break-words');
    const pre = row.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre).toHaveClass('overflow-x-auto');
  });
});
