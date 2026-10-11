import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TChatTimelineEntry } from '../../Chat.entity';
import {
  CHAT_HISTORY_LABEL_MAX,
  ChatHistoryDialog,
  historyAuthorLabel,
  historyItemLabel,
  type ChatHistoryDialogProps,
} from '../ChatHistoryDialog';

/**
 * Spec del modal de historial (iteración UX U2): lista **todos** los mensajes del
 * timeline etiquetados por autor y, al elegir uno, cierra el modal y emite el
 * salto (que el llamador reutiliza). Radix `Dialog` aporta foco, trampa de foco,
 * `Escape` y restauración de foco; aquí se verifica el contenido y el contrato de
 * selección.
 */

const entry = (
  overrides: Partial<TChatTimelineEntry> = {},
): TChatTimelineEntry => ({
  id: 'u1:0',
  role: 'user',
  kind: 'text',
  text: 'hola',
  isComplete: true,
  at: 1,
  history: null,
  ...overrides,
});

const renderDialog = (
  overrides: Partial<ChatHistoryDialogProps> = {},
  entries: TChatTimelineEntry[] = [],
) => {
  const onOpenChange = vi.fn();
  const onSelectEntry = vi.fn();
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const view = render(
    <ChatHistoryDialog
      open
      onOpenChange={onOpenChange}
      entries={entries}
      onSelectEntry={onSelectEntry}
      {...overrides}
    />,
  );
  return { user, onOpenChange, onSelectEntry, view };
};

/** Arranque abierto con estado controlado, para observar el cierre real. */
const StatefulDialog = ({
  entries,
  onSelectEntry,
}: {
  entries: TChatTimelineEntry[];
  onSelectEntry: (entryId: string) => void;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <ChatHistoryDialog
      open={open}
      onOpenChange={setOpen}
      entries={entries}
      onSelectEntry={onSelectEntry}
    />
  );
};

describe('ChatHistoryDialog — estructura y a11y (U2)', () => {
  it('expone un diálogo con título accesible', () => {
    renderDialog({}, [entry()]);

    expect(
      screen.getByRole('dialog', { name: 'Historial de mensajes' }),
    ).toBeInTheDocument();
  });

  it('no renderiza nada cuando está cerrado', () => {
    renderDialog({ open: false }, [entry()]);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cierra con Escape notificando el cambio de apertura', async () => {
    const { user, onOpenChange } = renderDialog({}, [entry()]);

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('ChatHistoryDialog — lista de mensajes (U2)', () => {
  it('lista todos los mensajes en orden con el autor etiquetado', () => {
    renderDialog({}, [
      entry({ id: 'u1:0', role: 'user', text: 'primer mensaje' }),
      entry({ id: 'a1:0', role: 'agent', text: 'respuesta' }),
      entry({ id: 'u2:0', role: 'user', text: 'segundo mensaje' }),
    ]);

    const items = screen.getAllByTestId('chat-history-item');
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.dataset.entryId)).toEqual([
      'u1:0',
      'a1:0',
      'u2:0',
    ]);

    expect(within(items[0]).getByText('Tú')).toBeInTheDocument();
    expect(within(items[0]).getByText('primer mensaje')).toBeInTheDocument();
    expect(within(items[1]).getByText('Agente')).toBeInTheDocument();
    expect(within(items[1]).getByText('respuesta')).toBeInTheDocument();
  });

  it('etiqueta las respuestas con el nombre del agente recibido', () => {
    renderDialog({ agentLabel: 'sddorch' }, [
      entry({ id: 'a1:0', role: 'agent', text: 'respuesta' }),
    ]);

    const item = screen.getByTestId('chat-history-item');
    expect(within(item).getByText('sddorch')).toBeInTheDocument();
  });

  it('muestra un estado vacío claro sin mensajes', () => {
    renderDialog({}, []);

    const dialog = screen.getByRole('dialog', { name: 'Historial de mensajes' });
    expect(
      within(dialog).getByText('Sin mensajes en el historial'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('chat-history-item')).not.toBeInTheDocument();
  });
});

describe('ChatHistoryDialog — selección (U2)', () => {
  it('cierra el modal y emite el id de la entrada elegida', async () => {
    const { user, onOpenChange, onSelectEntry } = renderDialog({}, [
      entry({ id: 'u1:0', text: 'primer mensaje' }),
      entry({ id: 'u2:0', text: 'segundo mensaje' }),
    ]);

    await user.click(
      screen.getByRole('button', { name: /segundo mensaje/ }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSelectEntry).toHaveBeenCalledWith('u2:0');
  });

  it('desmonta el contenido al elegir una entrada (estado controlado)', async () => {
    const onSelectEntry = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <StatefulDialog
        entries={[entry({ id: 'u1:0', text: 'primer mensaje' })]}
        onSelectEntry={onSelectEntry}
      />,
    );

    await user.click(screen.getByRole('button', { name: /primer mensaje/ }));

    expect(onSelectEntry).toHaveBeenCalledWith('u1:0');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('historyAuthorLabel / historyItemLabel (U2)', () => {
  it('etiqueta a los mensajes propios como "Tú" y al resto como "Agente"', () => {
    expect(historyAuthorLabel('user')).toBe('Tú');
    expect(historyAuthorLabel('agent')).toBe('Agente');
    expect(historyAuthorLabel('agent', 'build')).toBe('build');
  });

  it('colapsa el texto a una línea', () => {
    expect(
      historyItemLabel(entry({ text: 'hola\n  mundo' })),
    ).toBe('hola mundo');
  });

  it('trunca a ~80 caracteres con elipsis', () => {
    const label = historyItemLabel(
      entry({ text: 'a'.repeat(CHAT_HISTORY_LABEL_MAX + 10) }),
    );

    expect(label).toBe(`${'a'.repeat(CHAT_HISTORY_LABEL_MAX)}…`);
  });

  it('usa una etiqueta de tipo cuando la entrada no tiene texto', () => {
    expect(
      historyItemLabel(entry({ kind: 'tool', role: 'agent', text: '' })),
    ).toBe('Llamada a herramienta');
    expect(
      historyItemLabel(entry({ kind: 'system', role: 'agent', text: '' })),
    ).toBe('Evento del sistema');
  });

  it('etiqueta pregunta, razonamiento y mensaje sin texto', () => {
    expect(
      historyItemLabel(entry({ kind: 'question', role: 'agent', text: '' })),
    ).toBe('Pregunta');
    expect(
      historyItemLabel(entry({ kind: 'reasoning', role: 'agent', text: '' })),
    ).toBe('Razonamiento');
    expect(
      historyItemLabel(entry({ kind: 'text', role: 'agent', text: '' })),
    ).toBe('Mensaje');
  });

  it('usa la etiqueta de tipo cuando el texto es solo espacios', () => {
    expect(
      historyItemLabel(entry({ kind: 'tool', role: 'agent', text: '   \n ' })),
    ).toBe('Llamada a herramienta');
  });
});

/**
 * Apertura real desde un disparador: Radix `Dialog` mueve el foco dentro del
 * contenido al abrir y, al cerrar, lo devuelve al `DialogTrigger` —o, sin él, a
 * `<body>`—. Aquí el botón externo se registra con `triggerRef`, el mismo
 * contrato que usa `ChatToolbar`/`ChatPanel`, para verificar la restauración.
 */
const OpenFromTrigger = ({ entries }: { entries: TChatTimelineEntry[] }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
      >
        Abrir historial
      </button>
      <ChatHistoryDialog
        open={open}
        onOpenChange={setOpen}
        entries={entries}
        onSelectEntry={vi.fn()}
        triggerRef={triggerRef}
      />
    </>
  );
};

describe('ChatHistoryDialog — foco (U2)', () => {
  it('mueve el foco dentro del diálogo al abrir', async () => {
    renderDialog({}, [entry()]);

    const dialog = screen.getByRole('dialog', {
      name: 'Historial de mensajes',
    });

    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );
  });

  it('restaura el foco al disparador al cerrar con Escape', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<OpenFromTrigger entries={[entry()]} />);

    const trigger = screen.getByRole('button', { name: 'Abrir historial' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });

  it('desmonta el diálogo al cerrar con Escape (estado controlado)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<OpenFromTrigger entries={[entry()]} />);

    await user.click(screen.getByRole('button', { name: 'Abrir historial' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});

describe('ChatHistoryDialog — nombres accesibles (U2)', () => {
  it('expone la lista de mensajes con un nombre accesible', () => {
    renderDialog({}, [entry()]);

    expect(
      screen.getByRole('list', { name: 'Mensajes de la conversación' }),
    ).toBeInTheDocument();
  });

  it('incluye el autor en el nombre accesible de cada mensaje', () => {
    renderDialog({}, [
      entry({ id: 'u1:0', role: 'user', text: 'primer mensaje' }),
      entry({ id: 'a1:0', role: 'agent', text: 'respuesta' }),
    ]);

    expect(
      screen.getByRole('button', { name: /Tú.*primer mensaje/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Agente.*respuesta/ }),
    ).toBeInTheDocument();
  });
});
