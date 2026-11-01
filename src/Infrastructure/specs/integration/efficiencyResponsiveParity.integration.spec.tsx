/**
 * U36 (T066) — E2E de la frontera U3↔U7: **overlay §5.4/§7 + FR-034/SC-010**.
 *
 * Monta el `EfficiencyOverlay` real (Radix Dialog) con la caché sembrada por el
 * arnés y cambia la presentación con `seedDevice`: móvil primero (`true`) y
 * escritorio después (`false`). Así se ejerce el mismo informe por el mismo
 * camino de producción (`useSessionEfficiency` → `EfficiencyReport` →
 * `EfficiencyTurns`) sin duplicar la decisión de dispositivo en el test.
 *
 * - Paridad: nota, banda, cobertura y hallazgos son idénticos en ambas
 *   presentaciones y coinciden con el motor (`analyzeSession`). Solo cambia la
 *   sección de turnos (tabla ↔ tarjetas).
 * - Móvil: un `<article>` por turno, sin tabla ancha; la expansión monta el
 *   prompt completo; un prompt corto no ofrece botón.
 * - Negativo estructural a 320 px: jsdom **no mide layout**, así que la
 *   ausencia de scroll horizontal se garantiza por clases (`min-w-0`,
 *   `break-words`, `flex-wrap`) y por la ausencia de anchos fijos en el
 *   diálogo. La medición visual real queda como deuda declarada (T067).
 */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { EfficiencyOverlay } from '@app/Infrastructure/Components/EfficiencyOverlay';
import type {
  TEfficiencyReport,
  TEfficiencySessionMeta,
  TBand,
} from '@app/Domains/Efficiency/Efficiency.entity';
import { analyzeSession } from '@app/Domains/Efficiency/lib/analyzeSession';
import { BAND_LABEL } from '@app/Domains/Efficiency/lib/labels';
import { codePointLength, truncateCodePoints } from '@app/Domains/Efficiency/lib/text';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';
import { formatPercent } from '@app/Application/Helpers';
import { setupRadixUser } from '@app/test/radix';
import { renderWithProviders } from '@app/test/renderWithProviders';
import {
  INTEGRATION_SESSION_ID,
  createIntegrationQueryClient,
  seedDevice,
  seedMessages,
} from './harness';

const ROOT = INTEGRATION_SESSION_ID;
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
const CLOSE_OFFSET = 5_000;
const RETRY_ATTEMPT = 3;
/** Mismo límite colapsado que la tabla y las tarjetas (FR-030). */
const PROMPT_LIMIT = 120;
const VISIBLE_FINDINGS = 5;

/** Marca después del límite: solo debe aparecer al expandir. */
const LONG_MARKER = 'COLA-COMPLETA';
const LONG_PROMPT =
  `Revisa el panel de eficiencia de la sesión y documenta los estados visibles de la tabla y de las tarjetas en escritorio y en móvil ${LONG_MARKER}`;
const SHORT_PROMPT = 'Ajusta el layout del grafo sin recalcular aristas';
const THIRD_PROMPT =
  'Comprueba la accesibilidad del diálogo y el retorno de foco';
const FOURTH_PROMPT =
  'Documenta los totales del informe y contrasta la cabecera de la sesión';

const SESSIONS: Record<string, TEfficiencySessionMeta> = {
  [ROOT]: { status: 'idle' },
};

interface ToolOptions {
  status?: 'completed' | 'error';
}

/** Herramienta con firma propia: evita RES-3 por firmas repetidas. */
const toolAt = (
  id: string,
  start: number,
  { status = 'completed' }: ToolOptions = {},
): SessionMessageAssistant['content'][number] => {
  const created = start + 150;
  return buildToolPart({
    id,
    name: 'read',
    status,
    input: { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created,
    completed: created + 100,
  });
};

interface TurnOptions {
  retry?: boolean;
  outcome?: 'succeeded' | 'failed';
  failedTool?: boolean;
}

/**
 * Turno cerrado con dos pasos assistant y tres herramientas: cuatro turnos
 * superan los mínimos de Entrada (tres pares elegibles) y Ejecución (diez
 * llamadas y cinco pasos), de modo que el informe real queda `ok`.
 */
const turnMessages = (
  index: number,
  prompt: string,
  {
    retry = false,
    outcome = 'succeeded',
    failedTool = false,
  }: TurnOptions = {},
): TSessionMessage[] => {
  const start = BASE + (index - 1) * TURN_MS;
  const content: SessionMessageAssistant['content'] = [
    toolAt(`tool-${index}-a`, start, {
      status: failedTool ? 'error' : 'completed',
    }),
    toolAt(`tool-${index}-b`, start + 200),
    toolAt(`tool-${index}-c`, start + 400),
  ];

  return [
    buildUser({
      id: `user-${index}`,
      text: prompt,
      time: { created: start },
    }),
    buildAssistant({
      id: `assistant-${index}-tools`,
      time: { created: start + 100, completed: start + 2_000 },
      content,
      ...(retry
        ? {
            retry: {
              attempt: RETRY_ATTEMPT,
              at: start + 1_100,
              error: { type: 'api', message: 'límite temporal del proveedor' },
            },
          }
        : {}),
    }),
    buildAssistant({
      id: `assistant-${index}-close`,
      time: { created: start + 2_100, completed: start + 2_500 },
      content: [{ type: 'text', text: `Cierre del turno ${index}` }],
    }),
    buildIdle(outcome, {
      id: `idle-${index}`,
      time: { created: start + CLOSE_OFFSET },
    }),
  ];
};

/**
 * Una sola sesión raíz con cuatro turnos cerrados: el 1 largo y con error de
 * herramienta (RES-1), el 2 corto y con reintento (RES-2) y dos limpios.
 * Tokens con caché en todos los pasos para que las cuatro dimensiones pesen.
 */
const MESSAGES: TSessionMessage[] = [
  ...turnMessages(1, LONG_PROMPT, { failedTool: true }),
  ...turnMessages(2, SHORT_PROMPT, { retry: true, outcome: 'failed' }),
  ...turnMessages(3, THIRD_PROMPT),
  ...turnMessages(4, FOURTH_PROMPT),
];

const expectedReport = (): TEfficiencyReport =>
  analyzeSession({
    rootSessionId: ROOT,
    messagesBySession: { [ROOT]: MESSAGES },
    sessions: SESSIONS,
    now: BASE + 200_000,
  });

const coverageLabel = (coverage: number): string =>
  formatPercent(coverage, Number.isInteger(coverage) ? 0 : 1);

/** Nombre accesible del veredicto; el ancla de la paridad de nota/banda. */
const scoreName = (score: number, band: TBand): string =>
  `${score} de 100, ${BAND_LABEL[band]}`;

interface TParitySignature {
  nota: string | null;
  banda: string | null;
  cobertura: string | null;
  hallazgos: string[];
}

/**
 * Lee del DOM las cifras y hallazgos que deben sobrevivir al cambio de
 * presentación. Falla si el informe no puntúa: el fixture está pensado para
 * `status: 'ok'` y una guarda silenciosa ocultaría una regresión.
 */
const captureParity = (report: TEfficiencyReport): TParitySignature => {
  const { score, band } = report;
  if (score === null || band === null) {
    throw new Error(`El fixture debe puntuar; recibido ${report.status}`);
  }

  return {
    nota: screen.getByRole('img', { name: scoreName(score, band) }).textContent,
    banda: screen.getByText(BAND_LABEL[band]).textContent,
    cobertura: screen.getByText(`Cobertura ${coverageLabel(report.coverage)}`)
      .textContent,
    hallazgos: screen
      .getAllByRole('article', { name: /^Hallazgo / })
      .map((card) => card.getAttribute('aria-label') ?? ''),
  };
};

/** Hallazgos que monta la sección: cinco visibles + todas las señales. */
const expectedFindingLabels = (report: TEfficiencyReport): string[] =>
  [...report.findings.slice(0, VISIBLE_FINDINGS), ...report.weakSignals].map(
    (finding) => `Hallazgo ${finding.ruleId}`,
  );

const renderOverlay = (client: QueryClient, isMobile: boolean) => {
  seedDevice(client, isMobile);
  return renderWithProviders(
    <EfficiencyOverlay
      isOpen
      rootSessionId={ROOT}
      rootTitle="Sesión raíz"
      sessions={SESSIONS}
      rootReady
      truncated={false}
      graphError={false}
      now={BASE + 200_000}
      reference={null}
      onClose={() => undefined}
      onRestoreFocus={() => undefined}
    />,
    { queryClient: client },
  );
};

const openDialog = async (): Promise<HTMLElement> =>
  screen.findByRole('dialog', { name: 'Eficiencia de la sesión' });

/** Clases que imponen un ancho fijo y podrían desbordar a 320 px. */
const FIXED_WIDTH_CLASS =
  /(?:^|\s)(?:w|min-w|max-w)-\[[^\]]*(?:px|rem|em|ch|vw)\](\s|$)/;

/**
 * Anchuras fijas declaradas (clases o estilo inline) en el subárbol. No mide:
 * jsdom no calcula cajas; la garantía es estructural.
 */
const fixedWidthsIn = (root: HTMLElement): string[] => {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

  return elements.flatMap((element) => {
    const offenders: string[] = [];
    const className = element.getAttribute('class') ?? '';

    if (FIXED_WIDTH_CLASS.test(className)) {
      offenders.push(`class="${className}"`);
    }
    if (
      element.style.width !== '' ||
      element.style.minWidth !== '' ||
      element.style.maxWidth !== ''
    ) {
      offenders.push(`style="${element.getAttribute('style') ?? ''}"`);
    }

    return offenders;
  });
};

describe('EfficiencyOverlay · paridad responsive del informe', () => {
  it('conserva nota, banda, cobertura y hallazgos al pasar de móvil a escritorio', async () => {
    const report = expectedReport();
    expect(report.status).toBe('ok');
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.findings.length).toBeLessThanOrEqual(VISIBLE_FINDINGS);
    expect(codePointLength(LONG_PROMPT)).toBeGreaterThan(PROMPT_LIMIT);

    const client = createIntegrationQueryClient();
    seedMessages(client, { [ROOT]: MESSAGES });

    const mobile = renderOverlay(client, true);
    await openDialog();

    // Móvil: tarjetas, nunca la tabla ancha.
    expect(
      screen.queryByRole('table', { name: 'Turnos de la sesión' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('article', { name: /^Turno / }),
    ).toHaveLength(4);

    const mobileParity = captureParity(report);
    mobile.unmount();

    // Escritorio: misma caché y mismo informe; solo cambia la presentación.
    const desktop = renderOverlay(client, false);
    await openDialog();

    const table = screen.getByRole('table', {
      name: 'Turnos de la sesión',
    });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['1', '2', '3', '4']);
    expect(
      screen.queryByRole('article', { name: /^Turno / }),
    ).not.toBeInTheDocument();

    const desktopParity = captureParity(report);

    expect(desktopParity).toEqual(mobileParity);
    expect(mobileParity).toEqual({
      nota: String(report.score),
      banda: BAND_LABEL[report.band as TBand],
      cobertura: `Cobertura ${coverageLabel(report.coverage)}`,
      hallazgos: expectedFindingLabels(report),
    });

    desktop.unmount();
  });

  it('a 320 px usa tarjetas con min-w-0/break-words, sin anchos fijos, y expande el prompt completo', async () => {
    const client = createIntegrationQueryClient();
    seedMessages(client, { [ROOT]: MESSAGES });

    const view = renderOverlay(client, true);
    const dialog = await openDialog();
    const user = setupRadixUser();

    // Sin medición de layout: la garantía es que no hay tabla ancha.
    expect(
      screen.queryByRole('table', { name: 'Turnos de la sesión' }),
    ).not.toBeInTheDocument();

    const cards = [1, 2, 3, 4].map((index) =>
      screen.getByRole('article', { name: `Turno ${index}` }),
    );

    for (const card of cards) {
      expect(card).toHaveClass('min-w-0');
      expect(card).toHaveClass('break-words');
      expect(card.parentElement).toHaveClass('min-w-0');
    }

    const [longCard, shortCard] = cards;
    const truncatedPrompt = longCard.querySelector('p.break-words');
    expect(truncatedPrompt).not.toBeNull();
    expect(truncatedPrompt?.textContent).toBe(
      truncateCodePoints(LONG_PROMPT, PROMPT_LIMIT),
    );
    expect(truncatedPrompt).toHaveClass('break-words');
    expect(within(shortCard).getByText(SHORT_PROMPT)).toBeInTheDocument();

    // El prompt largo solo se monta completo al expandir.
    expect(dialog.textContent).not.toContain(LONG_MARKER);
    await user.click(
      within(longCard).getByRole('button', { name: 'Ver detalle' }),
    );

    const detail = screen.getByRole('region', {
      name: 'Detalle del turno 1',
    });
    const promptSection = within(detail).getByRole('region', {
      name: 'Prompt completo',
    });
    expect(promptSection.textContent).toContain(LONG_PROMPT);
    expect(dialog.textContent).toContain(LONG_MARKER);

    // Negativo: un prompt corto no ofrece expansión aunque tenga señales.
    expect(within(shortCard).queryByRole('button')).not.toBeInTheDocument();

    // El header envuelve y su bloque de título no empuja el ancho.
    const title = within(dialog).getByText('Eficiencia de la sesión');
    expect(title.parentElement).toHaveClass('min-w-0');
    expect(title.parentElement?.parentElement).toHaveClass('flex-wrap');

    expect(fixedWidthsIn(dialog)).toEqual([]);

    view.unmount();
  });
});
