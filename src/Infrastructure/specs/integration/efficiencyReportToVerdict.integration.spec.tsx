/**
 * U37 (T038) — E2E de la frontera U1↔U3: **motor §5 + overlay §5.2**.
 *
 * Monta el informe real de `analyzeSession` con `EfficiencyReport` (escritorio) y
 * comprueba el veredicto completo: nota entera, banda con texto + icono,
 * cobertura, confianza, el nombre accesible “N de 100, banda” y los 2–3 factores
 * de impacto con su conteo y signo. El `Disclosure` “Cómo se calcula” abre y
 * muestra pesos por dimensión y las omisiones del motor.
 *
 * Casos negativos: `in_progress` e `insufficient` no pintan nota, factores ni
 * valores de dimensión (en “Cómo se calcula” las dimensiones dicen “sin nota”),
 * pero sí la cobertura y las métricas crudas de la guarda.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { formatPercent } from '@app/Application/Helpers';
import { EfficiencyReport } from '@app/Domains/Efficiency/Components/EfficiencyReport';
import type {
  TBand,
  TEfficiencyReport,
} from '@app/Domains/Efficiency/Efficiency.entity';
import { analyzeSession } from '@app/Domains/Efficiency/lib/analyzeSession';
import { buildFactors } from '@app/Domains/Efficiency/lib/factors';
import {
  BAND_LABEL,
  CONFIDENCE_LABEL,
  DIMENSION_LABEL,
} from '@app/Domains/Efficiency/lib/labels';
import { buildOmissions } from '@app/Domains/Efficiency/lib/omissions';
import { RETRY_ALERT_THRESHOLD } from '@app/Domains/Efficiency/lib/thresholds';
import {
  buildAssistant,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';

const ROOT = 'root';
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
const TOOLS_OPEN = 4;

/** Pedidos distintos (≥6 tokens) para que INP-1 tenga pares elegibles. */
const PROMPTS = [
  'Revisa el flujo de conexión y documenta los estados de error visibles',
  'Ajusta la vista del grafo para que el layout no se recalcule al abrir paneles',
  'Añade pruebas del motor de eficiencia con umbrales y casos límite',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
];

interface TTurnOptions {
  /** Las cuatro herramientas del primer assistant fallan (RES-1). */
  failedTools?: boolean;
  /** El primer assistant reporta un reintento en el umbral (RES-2). */
  retry?: boolean;
}

const toolAt = (
  id: string,
  start: number,
  position: number,
  failed: boolean,
): SessionMessageAssistant['content'][number] => {
  const created = start + 200 + position * 10;
  return buildToolPart({
    id,
    name: 'read',
    status: failed ? 'error' : 'completed',
    input: { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created,
    completed: created + 100,
  });
};

/**
 * Turno cerrado con dos pasos assistant y cinco herramientas. Cuatro turnos dan
 * 20 llamadas y 8 pasos: Entrada, Ejecución, Contexto y Resultado puntúan.
 */
const turnMessages = (
  index: number,
  prompt: string,
  { failedTools = false, retry = false }: TTurnOptions = {},
): TSessionMessage[] => {
  const start = BASE + (index - 1) * TURN_MS;
  const firstContent: SessionMessageAssistant['content'] = Array.from(
    { length: TOOLS_OPEN },
    (_, position) =>
      toolAt(
        `tool-${index}-${position}`,
        start,
        position,
        failedTools,
      ),
  );
  const closeContent: SessionMessageAssistant['content'] = [
    toolAt(`tool-${index}-close`, start + 500, TOOLS_OPEN, false),
  ];

  return [
    buildUser({ id: `user-${index}`, text: prompt, time: { created: start } }),
    buildAssistant({
      id: `assistant-${index}-open`,
      time: { created: start + 100, completed: start + 2_000 },
      content: firstContent,
      ...(retry
        ? {
            retry: {
              attempt: RETRY_ALERT_THRESHOLD,
              at: start + 1_100,
              error: { type: 'api', message: 'límite temporal del proveedor' },
            },
          }
        : {}),
    }),
    buildAssistant({
      id: `assistant-${index}-close`,
      time: { created: start + 2_100, completed: start + 2_500 },
      content: closeContent,
    }),
    buildIdle('succeeded', {
      id: `idle-${index}`,
      time: { created: start + 5_000 },
    }),
  ];
};

/** Cuatro turnos: errores de herramienta en el 1 y reintento en el 2. */
const MESSAGES: TSessionMessage[] = [
  ...turnMessages(1, PROMPTS[0], { failedTools: true }),
  ...turnMessages(2, PROMPTS[1], { retry: true }),
  ...turnMessages(3, PROMPTS[2]),
  ...turnMessages(4, PROMPTS[3]),
];

/** Un solo turno cerrado: no alcanza el mínimo de dos. */
const SINGLE_TURN: TSessionMessage[] = turnMessages(
  1,
  PROMPTS[0],
  { failedTools: true },
);

const analyze = (
  messages: TSessionMessage[],
  status: 'idle' | 'active' = 'idle',
): TEfficiencyReport =>
  analyzeSession({
    rootSessionId: ROOT,
    messagesBySession: { [ROOT]: messages },
    sessions: { [ROOT]: { status } },
    now: BASE + 200_000,
  });

const renderReport = (report: TEfficiencyReport) =>
  render(<EfficiencyReport report={report} isMobile={false} />);

const coverageLabel = (coverage: number): string =>
  formatPercent(coverage, Number.isInteger(coverage) ? 0 : 1);

const closedTurns = (report: TEfficiencyReport): number =>
  report.turns.filter((turn) => turn.closed).length;

const scoreName = (score: number, band: TBand): string =>
  `${score} de 100, ${BAND_LABEL[band]}`;

/** Sección cuyo encabezado visible es `heading`. */
const sectionOf = (heading: string): HTMLElement => {
  const node = screen.getByText(heading).parentElement;
  if (node === null) throw new Error(`Sección “${heading}” ausente`);
  return node;
};

describe('EfficiencyReport · del informe al veredicto (T038, U1↔U3)', () => {
  it('pinta nota, banda, cobertura, confianza, factores y el cálculo abierto', async () => {
    const user = userEvent.setup();
    const report = analyze(MESSAGES);

    expect(report.status).toBe('ok');
    expect(report.score).not.toBeNull();
    expect(Number.isInteger(report.score)).toBe(true);
    expect(report.band).not.toBeNull();
    expect(report.confidence).not.toBeNull();

    const score = report.score as number;
    const band = report.band as TBand;
    renderReport(report);

    // Nota entera con el nombre accesible exacto.
    const verdict = screen.getByRole('img', {
      name: scoreName(score, band),
    });
    expect(verdict).toHaveTextContent(String(score));
    expect(screen.queryByLabelText(/de 100/)).toBe(verdict);

    // Banda con texto + icono (la señal no depende solo del color).
    const bandLabel = screen.getByText(BAND_LABEL[band]);
    expect(bandLabel.querySelector('svg')).not.toBeNull();

    // Cobertura y confianza visibles.
    expect(
      screen.getByText(`Cobertura ${coverageLabel(report.coverage)}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `confianza ${CONFIDENCE_LABEL[report.confidence as 'alta' | 'media' | 'baja']}`,
      ),
    ).toBeInTheDocument();

    // 2–3 factores de impacto con dimensión, conteo y signo.
    const factors = buildFactors(report.dimensions);
    expect(factors.length).toBeGreaterThanOrEqual(2);
    expect(factors.length).toBeLessThanOrEqual(3);

    const factorsSection = sectionOf('Factores de impacto');
    for (const factor of factors) {
      const sign = within(factorsSection).getByText(
        `${factor.kind} · ${factor.count}`,
      );
      const row = sign.closest('li');
      if (row === null) throw new Error(`Fila de ${factor.key} ausente`);
      expect(within(row).getByText(factor.label)).toBeInTheDocument();
      expect(
        within(row).getByText(DIMENSION_LABEL[factor.dimension]),
      ).toBeInTheDocument();
      expect(factor.count).toBeGreaterThan(0);
    }

    // “Cómo se calcula” explica pesos y omisiones del motor real.
    await user.click(
      screen.getByRole('button', { name: 'Cómo se calcula' }),
    );
    expect(
      screen.getByRole('button', { name: 'Ocultar cálculo' }),
    ).toHaveAttribute('aria-expanded', 'true');

    const weightsTable = screen.getByRole('table', {
      name: 'Pesos y valores de las dimensiones',
    });
    for (const [dimension, weight] of [
      ['entrada', 30],
      ['ejecucion', 30],
      ['contexto', 15],
      ['resultado', 25],
    ] as const) {
      const cell = within(weightsTable).getByText(
        DIMENSION_LABEL[dimension],
      );
      const row = cell.closest('tr');
      if (row === null) throw new Error(`Fila de ${dimension} ausente`);
      expect(within(row).getByText(String(weight))).toBeInTheDocument();
    }
    expect(within(weightsTable).queryAllByText('sin nota')).toHaveLength(0);

    const omissions = buildOmissions(report.dimensions);
    expect(omissions.length).toBeGreaterThan(0);
    const omissionsSection = sectionOf('Omisiones');
    for (const omission of omissions) {
      expect(
        within(omissionsSection).getByText(
          new RegExp(omission.reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          { selector: 'li' },
        ),
      ).toBeInTheDocument();
    }
  });

  it('en curso no pinta nota, factores ni valores de dimensión, pero sí cobertura y datos crudos', async () => {
    const user = userEvent.setup();
    const report = analyze(MESSAGES, 'active');

    expect(report.status).toBe('in_progress');
    expect(report.score).toBeNull();
    expect(report.band).toBeNull();
    renderReport(report);

    expect(
      screen.getByText('Sesión en curso: sin nota'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/de 100/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Factores de impacto'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Hallazgos')).not.toBeInTheDocument();

    // Datos crudos de la guarda: cobertura y conteo de turnos.
    expect(
      screen.getByText(`Cobertura ${coverageLabel(report.coverage)}.`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Turnos cerrados ${closedTurns(report)} de ${report.turns.length}.`,
      ),
    ).toBeInTheDocument();

    // Sin valores de dimensión que parezcan una nota.
    await user.click(
      screen.getByRole('button', { name: 'Cómo se calcula' }),
    );
    const weightsTable = screen.getByRole('table', {
      name: 'Pesos y valores de las dimensiones',
    });
    expect(within(weightsTable).getAllByText('sin nota')).toHaveLength(
      report.dimensions.length,
    );
  });

  it('insuficiente declara el motivo y tampoco inventa nota ni valores de dimensión', async () => {
    const user = userEvent.setup();
    const report = analyze(SINGLE_TURN);

    expect(report.status).toBe('insufficient');
    expect(report.score).toBeNull();
    expect(report.band).toBeNull();
    renderReport(report);

    expect(screen.getByText('Muestra insuficiente')).toBeInTheDocument();
    expect(
      screen.getByText(/Menos de 2 turnos cerrados \(1\)/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/de 100/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Factores de impacto'),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(`Cobertura ${coverageLabel(report.coverage)}.`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Turnos cerrados ${closedTurns(report)} de ${report.turns.length}.`,
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Cómo se calcula' }),
    );
    const weightsTable = screen.getByRole('table', {
      name: 'Pesos y valores de las dimensiones',
    });
    expect(within(weightsTable).getAllByText('sin nota')).toHaveLength(
      report.dimensions.length,
    );
  });
});
