import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TChatTimelineEntry } from '../../Chat.entity';
import {
  CHAT_HISTORY_LABEL_MAX,
  ChatHistoryDialog,
  chatHistoryAuthorOptions,
  filterHistoryEntries,
  historyAuthorCounts,
  historyAuthorLabel,
  historyItemLabel,
  type ChatHistoryDialogProps,
} from '../ChatHistoryDialog';

/**
 * Spec del modal de historial (iteración UX U2 + filtros U3): lista **todos** los
 * mensajes del timeline etiquetados por autor, con filtros combinables de autor
 * (chips) y texto (input) y, al elegir uno, cierra el modal y emite el salto.
 * Radix `Dialog` aporta foco, trampa de foco, `Escape` y restauración de foco;
 * aquí se verifica el contenido, los filtros y el contrato de selección.
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

const mixedEntries = (): TChatTimelineEntry[] => [
  entry({ id: 'u1:0', role: 'user', text: 'primer mensaje' }),
  entry({ id: 'a1:0', role: 'agent', text: 'respuesta' }),
  entry({ id: 'u2:0', role: 'user', text: 'segundo mensaje' }),
];

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

describe('ChatHistoryDialog — filtro por autor (U3)', () => {
  it('ofrece los tres chips con el recuento por opción', () => {
    renderDialog({}, mixedEntries());

    const all = screen.getByTestId('chat-history-author-all');
    const user = screen.getByTestId('chat-history-author-user');
    const agent = screen.getByTestId('chat-history-author-agent');

    expect(all).toHaveTextContent('Todos');
    expect(user).toHaveTextContent('Mis mensajes');
    expect(agent).toHaveTextContent('Agente');

    expect(within(all).getByText('3')).toBeInTheDocument();
    expect(within(user).getByText('2')).toBeInTheDocument();
    expect(within(agent).getByText('1')).toBeInTheDocument();
  });

  it('usa el nombre del agente en el chip de sus mensajes', () => {
    renderDialog({ agentLabel: 'sddorch' }, mixedEntries());

    expect(screen.getByTestId('chat-history-author-agent')).toHaveTextContent(
      'sddorch',
    );
  });

  it('arranca con "Todos" activo y los demás inactivos (aria-pressed)', () => {
    renderDialog({}, mixedEntries());

    expect(screen.getByTestId('chat-history-author-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('chat-history-author-user')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('chat-history-author-agent')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('filtra la lista al pulsar "Mis mensajes" (exclusivo)', async () => {
    const { user } = renderDialog({}, mixedEntries());

    await user.click(screen.getByTestId('chat-history-author-user'));

    const items = screen.getAllByTestId('chat-history-item');
    expect(items.map((item) => item.dataset.entryId)).toEqual(['u1:0', 'u2:0']);
    expect(screen.getByTestId('chat-history-author-user')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('chat-history-author-all')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('vuelve a todos los mensajes al reactivar "Todos"', async () => {
    const { user } = renderDialog({}, mixedEntries());

    await user.click(screen.getByTestId('chat-history-author-agent'));
    expect(screen.getAllByTestId('chat-history-item')).toHaveLength(1);

    await user.click(screen.getByTestId('chat-history-author-all'));
    expect(screen.getAllByTestId('chat-history-item')).toHaveLength(3);
  });
});

describe('ChatHistoryDialog — filtro por texto (U3)', () => {
  it('expone un input de búsqueda con label accesible', () => {
    renderDialog({}, mixedEntries());

    expect(
      screen.getByRole('searchbox', { name: 'Buscar en los mensajes' }),
    ).toBeInTheDocument();
  });

  it('filtra los mensajes por texto sin distinguir mayúsculas', async () => {
    const { user } = renderDialog({}, mixedEntries());

    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar en los mensajes' }),
      'RESPUESTA',
    );

    const items = screen.getAllByTestId('chat-history-item');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.entryId).toBe('a1:0');
  });

  it('permite limpiar la búsqueda con el botón de limpieza', async () => {
    const { user } = renderDialog({}, mixedEntries());
    const search = screen.getByRole('searchbox', {
      name: 'Buscar en los mensajes',
    });

    expect(
      screen.queryByRole('button', { name: 'Limpiar búsqueda' }),
    ).not.toBeInTheDocument();

    await user.type(search, 'respuesta');
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(search).toHaveValue('');
    expect(screen.getAllByTestId('chat-history-item')).toHaveLength(3);
  });
});

describe('ChatHistoryDialog — filtros combinados (U3)', () => {
  it('aplica autor AND texto', async () => {
    const { user } = renderDialog({}, [
      entry({ id: 'u1:0', role: 'user', text: 'alpha propio' }),
      entry({ id: 'a1:0', role: 'agent', text: 'alpha respuesta' }),
      entry({ id: 'u2:0', role: 'user', text: 'beta propio' }),
    ]);
    const search = screen.getByRole('searchbox', {
      name: 'Buscar en los mensajes',
    });

    await user.click(screen.getByTestId('chat-history-author-user'));
    await user.type(search, 'alpha');

    const items = screen.getAllByTestId('chat-history-item');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.entryId).toBe('u1:0');
  });

  it('distingue "sin resultados" de "sin mensajes" y permite limpiar', async () => {
    const { user } = renderDialog({}, mixedEntries());
    const search = screen.getByRole('searchbox', {
      name: 'Buscar en los mensajes',
    });

    await user.type(search, 'zzz');

    expect(screen.getByText('Ningún mensaje coincide')).toBeInTheDocument();
    expect(
      screen.queryByText('Sin mensajes en el historial'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-history-item')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.getAllByTestId('chat-history-item')).toHaveLength(3);
    expect(search).toHaveValue('');
  });

  it('muestra el vacío de filtros (no el de historial) al combinar autor y texto sin coincidencias', async () => {
    const { user } = renderDialog({}, mixedEntries());
    const search = screen.getByRole('searchbox', {
      name: 'Buscar en los mensajes',
    });

    // "respuesta" solo existe en el mensaje del agente; filtrando por "Mis
    // mensajes" no queda ninguna coincidencia.
    await user.click(screen.getByTestId('chat-history-author-user'));
    await user.type(search, 'respuesta');

    expect(screen.getByText('Ningún mensaje coincide')).toBeInTheDocument();
    expect(
      screen.queryByText('Sin mensajes en el historial'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-history-item')).not.toBeInTheDocument();
  });

  it('restablece autor y texto a la vez con "Limpiar filtros"', async () => {
    const { user } = renderDialog({}, mixedEntries());
    const search = screen.getByRole('searchbox', {
      name: 'Buscar en los mensajes',
    });

    await user.click(screen.getByTestId('chat-history-author-agent'));
    await user.type(search, 'zzz');
    expect(screen.getByText('Ningún mensaje coincide')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.getAllByTestId('chat-history-item')).toHaveLength(3);
    expect(search).toHaveValue('');
    expect(screen.getByTestId('chat-history-author-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('chat-history-author-agent')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('no muestra los filtros cuando no hay mensajes', () => {
    renderDialog({}, []);

    expect(
      screen.queryByTestId('chat-history-author-filter'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('searchbox', { name: 'Buscar en los mensajes' }),
    ).not.toBeInTheDocument();
  });
});

/**
 * El estado de los filtros es local y se limpia al cerrar: cada apertura arranca
 * sin filtrar. Se abre desde un disparador externo (como en `ChatPanel`) para
 * poder cerrar con `Escape` y reabrir.
 */
const ReopenableDialog = ({ entries }: { entries: TChatTimelineEntry[] }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
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

describe('ChatHistoryDialog — los filtros se limpian al cerrar (U3)', () => {
  it('reabre sin filtros tras cerrar con Escape', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ReopenableDialog entries={mixedEntries()} />);
    const trigger = screen.getByRole('button', { name: 'Abrir historial' });

    await user.click(trigger);
    await user.click(screen.getByTestId('chat-history-author-user'));
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar en los mensajes' }),
      'primer',
    );
    expect(screen.getAllByTestId('chat-history-item')).toHaveLength(1);

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    await user.click(trigger);

    // Arranca sin filtrar: todos los mensajes, búsqueda vacía y "Todos" activo.
    expect(screen.getAllByTestId('chat-history-item')).toHaveLength(3);
    expect(
      screen.getByRole('searchbox', { name: 'Buscar en los mensajes' }),
    ).toHaveValue('');
    expect(screen.getByTestId('chat-history-author-all')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('ChatHistoryDialog — selección (U2/U3)', () => {
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

  it('mantiene el salto tras filtrar', async () => {
    const { user, onOpenChange, onSelectEntry } = renderDialog(
      {},
      mixedEntries(),
    );

    await user.click(screen.getByTestId('chat-history-author-user'));
    await user.click(screen.getByRole('button', { name: /segundo mensaje/ }));

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

describe('chatHistoryAuthorOptions / historyAuthorCounts / filterHistoryEntries (U3)', () => {
  it('construye las opciones con el nombre del agente', () => {
    expect(chatHistoryAuthorOptions()).toEqual([
      { value: 'all', label: 'Todos' },
      { value: 'user', label: 'Mis mensajes' },
      { value: 'agent', label: 'Agente' },
    ]);
    expect(chatHistoryAuthorOptions('build')[2]).toEqual({
      value: 'agent',
      label: 'build',
    });
  });

  it('cuenta las entradas por autor', () => {
    expect(historyAuthorCounts(mixedEntries())).toEqual({
      all: 3,
      user: 2,
      agent: 1,
    });
  });

  it('combina autor y texto (case-insensitive)', () => {
    const entries = [
      entry({ id: 'u1:0', role: 'user', text: 'Alpha propio' }),
      entry({ id: 'a1:0', role: 'agent', text: 'alpha respuesta' }),
      entry({ id: 'u2:0', role: 'user', text: 'beta propio' }),
    ];

    expect(
      filterHistoryEntries(entries, { author: 'user', query: 'ALPHA' }).map(
        (item) => item.id,
      ),
    ).toEqual(['u1:0']);
    expect(
      filterHistoryEntries(entries, { author: 'all', query: 'alpha' }).map(
        (item) => item.id,
      ),
    ).toEqual(['u1:0', 'a1:0']);
    expect(
      filterHistoryEntries(entries, { author: 'all', query: '   ' }),
    ).toHaveLength(3);
  });

  it('no hace coincidir entradas sin texto con una búsqueda', () => {
    expect(
      filterHistoryEntries(
        [entry({ role: 'agent', kind: 'tool', text: '' })],
        { author: 'all', query: 'herramienta' },
      ),
    ).toHaveLength(0);
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
