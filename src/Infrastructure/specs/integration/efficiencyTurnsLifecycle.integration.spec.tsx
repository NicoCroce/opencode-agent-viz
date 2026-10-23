/**
 * U29 (T054) — E2E de la frontera U1↔U3: **data-model §2.5 + overlay §5.4**.
 *
 * Monta el informe real (`analyzeSession`) sobre sesiones de fixture con
 * mensajes del SDK y lo pinta con `EfficiencyReport` en escritorio. Comprueba
 * que las filas salen en orden cronológico y se expanden bajo demanda (prompt
 * completo y señales solo al expandir), que el turno abierto se marca y queda
 * fuera de los denominadores, y que sin `now` su tiempo es “—”.
 *
 * Casos negativos: un prompt corto no ofrece botón de expansión; un turno
 * abierto no cuenta como turno cerrado para el mínimo de dos (sigue siendo
 * `insufficient`, sin nota y sin inventar denominadores). El banner textual de
 * estado llega con US4 (T055); aquí se comprueba el estado del informe que lo
 * alimenta y la ausencia de nota.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { EfficiencyReport } from '@app/Domains/Efficiency/Components/EfficiencyReport';
import type { TEfficiencyReport } from '@app/Domains/Efficiency/Efficiency.entity';
import { analyzeSession } from '@app/Domains/Efficiency/lib/analyzeSession';
import { STATUS_LABEL } from '@app/Domains/Efficiency/lib/labels';
import { codePointLength } from '@app/Domains/Efficiency/lib/text';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';

const ROOT = 'root';
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
/** Cierre (`idle`) dentro de la ventana de cada turno. */
const CLOSE_OFFSET = 5_000;

/** Pedido de más de 120 code points: solo se monta completo al expandir. */
const LONG_PROMPT =
  'Revisa el panel de eficiencia de la sesión, documenta los estados visibles y comprueba que los turnos conservan su orden cronológico en la tabla';
const SHORT_PROMPT = 'Ajusta el layout del grafo sin recalcular aristas';
const MEDIUM_PROMPT =
  'Comprueba la accesibilidad del diálogo y el retorno de foco';
const OPEN_PROMPT =
  'Optimiza el renderizado de turnos largos sin cambiar la presentación';

const turnStart = (index: number): number => BASE + (index - 1) * TURN_MS;

interface ToolOptions {
  status?: 'completed' | 'error';
}

const toolAt = (
  id: string,
  start: number,
  offset: number,
  options: ToolOptions = {},
): SessionMessageAssistant['content'][number] => {
  const created = start + offset;
  return buildToolPart({
    id,
    name: 'read',
    status: options.status ?? 'completed',
    input: { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created + 20,
    completed: created + 200,
  });
};

const assistantAt = (
  id: string,
  created: number,
  content: SessionMessageAssistant['content'],
  extra: Partial<SessionMessageAssistant> = {},
): TSessionMessage =>
  buildAssistant({
    id,
    time: { created, completed: created + 1_500 },
    content,
    ...extra,
  });

const userAt = (index: number, prompt: string): TSessionMessage =>
  buildUser({
    id: `user-${index}`,
    text: prompt,
    time: { created: turnStart(index) },
  });

/**
 * Tres turnos cerrados (el 2 fallido y con reintento) y un cuarto abierto.
 * Diez llamadas a herramientas y seis pasos sostienen Ejecución; Entrada y
 * Resultado también puntúan, así que el informe real sale `ok`.
 */
const buildMultiTurnSession = (): TSessionMessage[] => {
  const messages: TSessionMessage[] = [];
  const prompts = [LONG_PROMPT, SHORT_PROMPT, MEDIUM_PROMPT];

  for (let index = 1; index <= 3; index += 1) {
    const start = turnStart(index);
    messages.push(userAt(index, prompts[index - 1] ?? SHORT_PROMPT));
    messages.push(
      assistantAt(
        `assistant-${index}a`,
        start + 100,
        [
          toolAt(`tool-${index}-a`, start, 150, {
            status: index === 1 ? 'error' : 'completed',
          }),
          toolAt(`tool-${index}-b`, start, 200, {
            status: index === 1 ? 'error' : 'completed',
          }),
        ],
        index === 2
          ? {
              retry: {
                attempt: 3,
                at: start + 1_100,
                error: {
                  type: 'api',
                  message: 'límite temporal del proveedor',
                },
              },
            }
          : {},
      ),
    );
    messages.push(
      assistantAt(`assistant-${index}b`, start + 250, [
        toolAt(`tool-${index}-c`, start, 300),
      ]),
    );
    messages.push(
      buildIdle(index === 2 ? 'failed' : 'succeeded', {
        id: `idle-${index}`,
        time: { created: start + CLOSE_OFFSET },
      }),
    );
  }

  const openStart = turnStart(4);
  messages.push(userAt(4, OPEN_PROMPT));
  messages.push(
    assistantAt('assistant-4a', openStart + 100, [
      toolAt('tool-4-a', openStart, 150),
      toolAt('tool-4-b', openStart, 200),
    ]),
  );
  messages.push(
    assistantAt('assistant-4b', openStart + 250, [
      toolAt('tool-4-c', openStart, 300),
    ]),
  );

  return messages;
};

/** Un único turno cerrado: no alcanza el mínimo de dos. */
const buildSingleClosedTurn = (): TSessionMessage[] => {
  const start = turnStart(1);
  return [
    userAt(1, SHORT_PROMPT),
    assistantAt('solo-assistant', start + 100, [
      toolAt('solo-tool', start, 150),
    ]),
    buildIdle('succeeded', {
      id: 'solo-idle',
      time: { created: start + CLOSE_OFFSET },
    }),
  ];
};

/** Un turno cerrado y otro abierto: el abierto no suma al mínimo. */
const buildClosedPlusOpen = (): TSessionMessage[] => {
  const first = turnStart(1);
  const second = turnStart(2);
  return [
    userAt(1, SHORT_PROMPT),
    assistantAt('closed-assistant', first + 100, [
      toolAt('closed-tool', first, 150),
    ]),
    buildIdle('succeeded', {
      id: 'closed-idle',
      time: { created: first + CLOSE_OFFSET },
    }),
    userAt(2, MEDIUM_PROMPT),
    assistantAt('open-assistant', second + 100, [
      toolAt('open-tool', second, 150),
    ]),
  ];
};

const analyze = (
  messages: TSessionMessage[],
  now?: number,
): TEfficiencyReport =>
  analyzeSession({
    rootSessionId: ROOT,
    messagesBySession: { [ROOT]: messages },
    sessions: { [ROOT]: {} },
    ...(now === undefined ? {} : { now }),
  });

const renderDesktop = (
  messages: TSessionMessage[],
  now?: number,
): TEfficiencyReport => {
  const report = analyze(messages, now);
  render(<EfficiencyReport report={report} isMobile={false} />);
  return report;
};

/** Fila de la tabla cuyo encabezado de fila empieza por `index`. */
const rowFor = (index: number): HTMLElement => {
  const header = screen.getByRole('rowheader', {
    name: new RegExp(`^${index}\\b`),
  });
  const row = header.closest('tr');
  if (row === null) throw new Error(`Fila del turno ${index} ausente`);
  return row;
};

describe('EfficiencyReport · ciclo de turnos con el motor real', () => {
  it('pinta las filas en orden cronológico y monta el prompt completo solo al expandir', async () => {
    const user = userEvent.setup();
    const report = renderDesktop(buildMultiTurnSession());

    expect(report.status).toBe('ok');
    expect(report.turns).toHaveLength(4);
    expect(report.turns.at(-1)?.closed).toBe(false);

    const table = screen.getByRole('table', {
      name: 'Turnos de la sesión',
    });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => Number.parseInt(cell.textContent ?? '', 10)),
    ).toEqual([1, 2, 3, 4]);

    const longTurn = report.turns.find(
      (turn) => codePointLength(turn.prompt) > 120,
    );
    expect(longTurn).toBeDefined();
    expect(longTurn?.signals).toContain('RES-1');

    const longRow = rowFor(longTurn?.index ?? 1);
    expect(
      within(longRow).getByText((longTurn?.signals ?? []).join(', ')),
    ).toBeInTheDocument();
    expect(screen.queryByText(longTurn?.prompt ?? '')).not.toBeInTheDocument();

    await user.click(
      within(longRow).getByRole('button', { name: 'Ver detalle' }),
    );

    const detail = screen.getByRole('region', {
      name: `Detalle del turno ${longTurn?.index}`,
    });
    expect(within(detail).getByText('Prompt completo')).toBeInTheDocument();
    expect(
      within(detail).getByText(longTurn?.prompt ?? ''),
    ).toBeInTheDocument();
    expect(within(detail).getByText('Señales del turno')).toBeInTheDocument();
    for (const ruleId of longTurn?.signals ?? []) {
      expect(within(detail).getByText(ruleId)).toBeInTheDocument();
    }
    expect(
      within(detail).getByText(
        new RegExp(`Turno ${longTurn?.index} · ${longTurn?.userMessageId}`),
      ),
    ).toBeInTheDocument();

    await user.click(
      within(longRow).getByRole('button', { name: 'Ocultar detalle' }),
    );

    expect(screen.queryByText(longTurn?.prompt ?? '')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('marca “abierto” el turno sin idle y deja su tiempo en “—” cuando no hay now', () => {
    const report = renderDesktop(buildMultiTurnSession());

    const openTurn = report.turns.find((turn) => !turn.closed);
    expect(openTurn).toBeDefined();
    expect(report.turns.filter((turn) => !turn.closed)).toHaveLength(1);
    expect(openTurn?.durationMs).toBeNull();

    const openRow = rowFor(openTurn?.index ?? 4);
    expect(within(openRow).getByText('abierto')).toBeInTheDocument();
    expect(screen.getAllByText('abierto')).toHaveLength(1);
    expect(
      within(openRow).getByLabelText('tiempo no disponible'),
    ).toHaveTextContent('—');
  });

  it('no ofrece expansión para un prompt corto y muestra sus señales en la fila', () => {
    const report = renderDesktop(buildMultiTurnSession());

    const shortTurn = report.turns.find(
      (turn) =>
        turn.closed &&
        codePointLength(turn.prompt) <= 120 &&
        turn.signals.length > 0,
    );
    expect(shortTurn).toBeDefined();

    const shortRow = rowFor(shortTurn?.index ?? 2);
    expect(
      within(shortRow).queryByRole('button', { name: 'Ver detalle' }),
    ).not.toBeInTheDocument();
    expect(
      within(shortRow).getByText((shortTurn?.signals ?? []).join(', ')),
    ).toBeInTheDocument();
  });

  it('con un solo turno cerrado declara muestra insuficiente, sin nota y con el turno visible', () => {
    const report = renderDesktop(buildSingleClosedTurn());

    expect(report.status).toBe('insufficient');
    expect(STATUS_LABEL[report.status]).toBe('Muestra insuficiente');
    expect(report.coverage).toBeLessThan(60);
    expect(report.score).toBeNull();
    expect(report.band).toBeNull();
    expect(report.turns).toHaveLength(1);

    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
    expect(within(rowFor(1)).getByText(SHORT_PROMPT)).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();

    const inp2 = report.dimensions
      .find((dimension) => dimension.key === 'entrada')
      ?.indicators.find((indicator) => indicator.key === 'INP-2');
    expect(inp2?.count).toBe(1);
  });

  it('no cuenta el turno abierto para el mínimo de dos cerrados ni inventa el denominador', () => {
    const report = renderDesktop(buildClosedPlusOpen());

    expect(report.turns).toHaveLength(2);
    expect(report.turns.filter((turn) => turn.closed)).toHaveLength(1);
    expect(report.status).toBe('insufficient');
    expect(report.score).toBeNull();
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);

    // El denominador de INP-2 son los turnos cerrados (1), no los dos visibles.
    const inp2 = report.dimensions
      .find((dimension) => dimension.key === 'entrada')
      ?.indicators.find((indicator) => indicator.key === 'INP-2');
    expect(inp2?.count).toBe(1);

    expect(within(rowFor(2)).getByText('abierto')).toBeInTheDocument();
  });
});
