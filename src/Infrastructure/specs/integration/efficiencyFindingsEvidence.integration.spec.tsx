/**
 * U26 (T049) — E2E de la frontera U1↔U3: **motor §6 + overlay §5.3**.
 *
 * Monta el informe real (`analyzeSession`) sobre una sesión de fixture con
 * mensajes del SDK y lo pinta con `EfficiencyReport` (escritorio). Comprueba que
 * cada regla emitida tiene su tarjeta con `ruleId`, condición, severidad, cita
 * con ancla y recomendación; que las cinco primeras quedan visibles y el resto
 * bajo “Ver N hallazgos más”; que las señales débiles viven en su sección sin
 * tocar la nota; y que una cita de más de 120 code points solo se monta completa
 * al expandir.
 *
 * Casos negativos: un candidato cuyo `evidence.messageId` está vacío no se emite
 * ni aparece (FR-024), y la cita nunca inventa segmentos de ancla que la
 * evidencia no tiene (turno/herramienta/hora solo cuando existen).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { EfficiencyReport } from '@app/Domains/Efficiency/Components/EfficiencyReport';
import type {
  TEfficiencyReport,
  TFinding,
} from '@app/Domains/Efficiency/Efficiency.entity';
import { analyzeSession } from '@app/Domains/Efficiency/lib/analyzeSession';
import { BAND_LABEL, SEVERITY_LABEL } from '@app/Domains/Efficiency/lib/labels';
import {
  PROMPT_TRUNCATE_CODE_POINTS,
  RETRY_ALERT_THRESHOLD,
} from '@app/Domains/Efficiency/lib/thresholds';
import { truncateCodePoints } from '@app/Domains/Efficiency/lib/text';
import {
  buildAssistant,
  buildCompaction,
  buildIdle,
  buildToolPart,
  buildUser,
} from '@app/Domains/Efficiency/lib/specs/fixtures';

const ROOT = 'root';
const BASE = 1_700_000_000_000;
const TURN_MS = 10_000;
const TOOL_OFFSET = 150;
const IDLE_OFFSET = 5_000;

/** Marca fuera de los 120 code points: solo visible al expandir la cita. */
const LONG_MARKER = 'COLA-OCULTA';

/** Pedido corto y su repetición larga (mismo conjunto ⇒ similitud 1). */
const SHORT_PROMPT =
  'Revisa el panel de eficiencia y documenta los hallazgos visibles del informe';
const LONG_PROMPT = `${SHORT_PROMPT} ${SHORT_PROMPT} ${LONG_MARKER}`;

const PROMPTS = [
  SHORT_PROMPT,
  LONG_PROMPT,
  'Ajusta el layout del grafo para que las aristas no se recalculen al abrir paneles',
  'Comprueba la accesibilidad del diálogo y el retorno de foco al disparador',
  'Optimiza el renderizado de turnos largos sin cambiar la presentación del panel',
];

const QUESTION_FIRST = '¿Qué archivo debo revisar primero?';
const QUESTION_REPEATED = '¿Qué archivo debo revisar primero en el panel?';
const SHARED_INPUT = { filePath: '/repo/src/compartido.ts' };
const DISTINCT_OUTPUTS = ['uno', 'dos', 'tres'] as const;

const userAt = (index: number): TSessionMessage =>
  buildUser({
    id: `user-${index}`,
    text: PROMPTS[index - 1],
    time: { created: BASE + index * TURN_MS },
  });

const assistantAt = (
  index: number,
  id: string,
  content: SessionMessageAssistant['content'],
  extra: Partial<SessionMessageAssistant> = {},
): TSessionMessage =>
  buildAssistant({
    id,
    content,
    time: {
      created: BASE + index * TURN_MS + 100,
      completed: BASE + index * TURN_MS + 4_000,
    },
    ...extra,
  });

const idleAt = (
  index: number,
  outcome: 'succeeded' | 'failed' | 'interrupted',
): TSessionMessage =>
  buildIdle(outcome, {
    id: `idle-${index}`,
    time: { created: BASE + index * TURN_MS + IDLE_OFFSET },
  });

interface ToolOptions {
  name?: string;
  status?: 'completed' | 'error';
  input?: Record<string, string>;
  output?: string;
  durationMs?: number;
}

const toolAt = (
  id: string,
  index: number,
  options: ToolOptions = {},
): SessionMessageAssistant['content'][number] => {
  const created = BASE + index * TURN_MS + TOOL_OFFSET;
  return buildToolPart({
    id,
    name: options.name ?? 'read',
    status: options.status ?? 'completed',
    input: options.input ?? { filePath: `/repo/src/${id}.ts` },
    created,
    ran: created,
    completed: created + (options.durationMs ?? 100),
    ...(options.output === undefined
      ? {}
      : { content: [{ type: 'text' as const, text: options.output }] }),
  });
};

const questionAt = (
  id: string,
  index: number,
  question: string,
): SessionMessageAssistant['content'][number] =>
  toolAt(id, index, { name: 'question', input: { question } });

interface SessionOptions {
  /** Si es `false`, el último assistant no tiene `id` (candidato sin ancla). */
  anchorLastAssistant?: boolean;
}

/**
 * Sesión determinista que dispara siete penalizantes (INP-1/2/3, RES-1/2/3/4)
 * y dos señales débiles (RES-5/RES-6). Cinco turnos cerrados, diez tools, cinco
 * pasos y dos compactaciones automáticas de la raíz.
 */
const sessionMessages = ({
  anchorLastAssistant = true,
}: SessionOptions = {}): TSessionMessage[] => [
  // Turno 1: reintento en intento 3 (RES-2) y primera pregunta (INP-3).
  userAt(1),
  assistantAt(
    1,
    'assistant-1',
    [
      toolAt('read-1', 1),
      questionAt('question-1', 1, QUESTION_FIRST),
    ],
    {
      retry: {
        attempt: RETRY_ALERT_THRESHOLD,
        at: BASE + TURN_MS + 200,
        error: { type: 'api', message: 'límite temporal del proveedor' },
      },
    },
  ),
  idleAt(1, 'succeeded'),

  // Turno 2: pedido repetido (INP-1), pregunta repetida (INP-3) e interrupción (INP-2).
  userAt(2),
  assistantAt(2, 'assistant-2', [
    toolAt('read-2', 2),
    questionAt('question-2', 2, QUESTION_REPEATED),
  ]),
  idleAt(2, 'interrupted'),

  // Turno 3: tres firmas iguales (RES-3) y dos compactaciones automáticas (RES-4).
  userAt(3),
  assistantAt(3, 'assistant-3', [
    toolAt('repro-1', 3, { input: SHARED_INPUT, output: DISTINCT_OUTPUTS[0] }),
    toolAt('repro-2', 3, { input: SHARED_INPUT, output: DISTINCT_OUTPUTS[1] }),
  ]),
  buildCompaction('auto', {
    id: 'compaction-1',
    time: { created: BASE + 3 * TURN_MS + 2_000 },
  }),
  buildCompaction('auto', {
    id: 'compaction-2',
    time: { created: BASE + 3 * TURN_MS + 3_000 },
  }),
  idleAt(3, 'succeeded'),

  // Turno 4: tercera firma igual (RES-3) y tool lenta (RES-6).
  userAt(4),
  assistantAt(4, 'assistant-4', [
    toolAt('repro-3', 4, { input: SHARED_INPUT, output: DISTINCT_OUTPUTS[2] }),
    toolAt('slow-1', 4, { name: 'bash', durationMs: 61_000 }),
  ]),
  idleAt(4, 'succeeded'),

  // Turno 5: dos errores de herramienta (RES-1) y cierre fallido (RES-5).
  userAt(5),
  assistantAt(
    5,
    anchorLastAssistant ? 'assistant-5' : '',
    [
      toolAt('fail-1', 5, { status: 'error' }),
      toolAt('fail-2', 5, { status: 'error' }),
    ],
  ),
  idleAt(5, 'failed'),
];

const analyze = (messages: TSessionMessage[]): TEfficiencyReport =>
  analyzeSession({
    rootSessionId: ROOT,
    messagesBySession: { [ROOT]: messages },
    sessions: { [ROOT]: {} },
  });

const renderReport = (messages: TSessionMessage[]): TEfficiencyReport => {
  const report = analyze(messages);
  render(<EfficiencyReport report={report} isMobile={false} />);
  return report;
};

/** Nombre accesible del veredicto (`{nota} de 100, {banda}`). */
const scoreName = (report: TEfficiencyReport): string =>
  report.score === null || report.band === null
    ? 'sin nota'
    : `${report.score} de 100, ${BAND_LABEL[report.band]}`;

const findingsSectionOf = (): HTMLElement => {
  const heading = screen.getByText('Hallazgos').parentElement;
  if (heading === null) throw new Error('Sección de hallazgos ausente');
  return heading;
};

const weakSectionOf = (): HTMLElement => {
  const heading = screen.getByText('Señales (no restan)').parentElement;
  if (heading === null) throw new Error('Sección de señales ausente');
  return heading;
};

/** Ancla visible de la cita: `[turno N · msg · tool … · hh:mm]`. */
const anchorOf = (finding: TFinding): string =>
  finding.quote.slice(0, finding.quote.indexOf(']') + 1);

describe('EfficiencyReport · hallazgos del motor con evidencia real', () => {
  it('da tarjeta a cada regla emitida y reparte cinco visibles frente al resto', async () => {
    const user = userEvent.setup();
    const report = renderReport(sessionMessages());

    expect(report.status).toBe('ok');
    expect(report.findings.map((finding) => finding.ruleId)).toEqual([
      'RES-2',
      'RES-1',
      'INP-1',
      'INP-2',
      'INP-3',
      'RES-3',
      'RES-4',
    ]);
    expect(report.weakSignals.map((finding) => finding.ruleId)).toEqual([
      'RES-5',
      'RES-6',
    ]);

    const visible = report.findings.slice(0, 5);
    expect(
      screen
        .getAllByRole('article', { name: /^Hallazgo / })
        .map((card) => card.getAttribute('aria-label')),
    ).toEqual([
      ...visible.map((finding) => `Hallazgo ${finding.ruleId}`),
      'Hallazgo RES-5',
      'Hallazgo RES-6',
    ]);
    expect(screen.queryByLabelText('Hallazgo RES-3')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hallazgo RES-4')).not.toBeInTheDocument();

    const expand = screen.getByRole('button', {
      name: 'Ver 2 hallazgos más',
    });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await user.click(expand);

    const labels = screen
      .getAllByRole('article', { name: /^Hallazgo / })
      .map((card) => card.getAttribute('aria-label'));
    expect(labels).toEqual([
      ...report.findings.map((finding) => `Hallazgo ${finding.ruleId}`),
      'Hallazgo RES-5',
      'Hallazgo RES-6',
    ]);

    for (const finding of report.findings) {
      const card = screen.getByRole('article', {
        name: `Hallazgo ${finding.ruleId}`,
      });
      expect(within(card).getByText(finding.ruleId)).toBeInTheDocument();
      expect(
        within(card).getByText(`Severidad ${SEVERITY_LABEL[finding.severity]}`),
      ).toBeInTheDocument();
      expect(within(card).getByText(finding.condition)).toBeInTheDocument();
      expect(
        within(card).getByText(finding.recommendation),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          truncateCodePoints(
            finding.quote,
            PROMPT_TRUNCATE_CODE_POINTS,
          ),
        ),
      ).toBeInTheDocument();
    }
  });

  it('conserva el ancla de turno, mensaje, herramienta y hora de cada cita', async () => {
    const user = userEvent.setup();
    const report = renderReport(sessionMessages());

    await user.click(
      screen.getByRole('button', { name: 'Ver 2 hallazgos más' }),
    );

    for (const finding of report.findings) {
      const anchor = anchorOf(finding);
      const { evidence } = finding;

      expect(evidence.messageId).toBeTruthy();
      expect(anchor).toContain(evidence.messageId as string);
      expect(anchor.startsWith('[')).toBe(true);

      if (evidence.turnIndex !== undefined) {
        expect(anchor).toContain(`turno ${evidence.turnIndex}`);
      }
      if (evidence.toolId !== undefined) {
        expect(anchor).toMatch(/· tool \S+ ·/);
      } else {
        expect(anchor).not.toContain('tool');
      }
      if (evidence.at !== undefined) {
        expect(anchor).toMatch(/\d{2}:\d{2}\]$/);
      }
    }
  });

  it('mantiene las señales débiles en su sección y la nota intacta', async () => {
    const user = userEvent.setup();
    const report = renderReport(sessionMessages());

    expect(report.weakSignals.every((finding) => !finding.penalizes)).toBe(
      true,
    );
    const score = screen.getByRole('img', {
      name: scoreName(report),
    });
    expect(score).toHaveTextContent(String(report.score));

    const weakSection = weakSectionOf();
    const findingsSection = findingsSectionOf();
    for (const finding of report.weakSignals) {
      expect(
        within(weakSection).getByRole('article', {
          name: `Hallazgo ${finding.ruleId}`,
        }),
      ).toBeInTheDocument();
      expect(
        within(findingsSection).queryByLabelText(
          `Hallazgo ${finding.ruleId}`,
        ),
      ).not.toBeInTheDocument();
    }

    await user.click(
      screen.getByRole('button', { name: 'Ver 2 hallazgos más' }),
    );

    expect(
      screen.getByRole('img', {
        name: scoreName(report),
      }),
    ).toHaveTextContent(String(report.score));
    expect(
      within(weakSectionOf()).getByRole('article', { name: 'Hallazgo RES-5' }),
    ).toBeInTheDocument();
  });

  it('muestra la cita larga truncada y la completa solo al expandir', async () => {
    const user = userEvent.setup();
    const report = renderReport(sessionMessages());
    const longFinding = report.findings.find(
      (finding) => finding.ruleId === 'INP-1',
    );

    expect(longFinding).toBeDefined();
    expect(longFinding?.quote).toContain(LONG_MARKER);
    expect(
      Array.from(longFinding?.quote ?? '').length,
    ).toBeGreaterThan(PROMPT_TRUNCATE_CODE_POINTS);

    const card = screen.getByRole('article', { name: 'Hallazgo INP-1' });
    expect(within(card).queryByText(new RegExp(LONG_MARKER))).toBeNull();
    expect(
      within(card).getByText(
        truncateCodePoints(
          longFinding?.quote ?? '',
          PROMPT_TRUNCATE_CODE_POINTS,
        ),
      ),
    ).toBeInTheDocument();

    await user.click(
      within(card).getByRole('button', { name: 'Ver cita completa' }),
    );

    expect(
      within(card).getByText(new RegExp(LONG_MARKER)),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'Ocultar cita completa' }),
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(
      within(card).getByRole('button', { name: 'Ocultar cita completa' }),
    );

    expect(within(card).queryByText(new RegExp(LONG_MARKER))).toBeNull();
  });

  it('no emite ni pinta un candidato sin messageId de evidencia', async () => {
    const user = userEvent.setup();
    const report = renderReport(
      sessionMessages({ anchorLastAssistant: false }),
    );

    expect(report.findings.map((finding) => finding.ruleId)).not.toContain(
      'RES-1',
    );
    expect(report.weakSignals.map((finding) => finding.ruleId)).not.toContain(
      'RES-1',
    );
    expect(report.findings).toHaveLength(6);

    await user.click(
      screen.getByRole('button', { name: 'Ver 1 hallazgos más' }),
    );

    expect(screen.queryByLabelText('Hallazgo RES-1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article', { name: /^Hallazgo / })).toHaveLength(
      8,
    );
  });

  it('no inventa anclas que la evidencia no tiene', () => {
    const report = renderReport(sessionMessages());
    const weakFinding = report.weakSignals.find(
      (finding) => finding.ruleId === 'RES-5',
    );

    expect(weakFinding?.evidence.toolId).toBeUndefined();
    expect(anchorOf(weakFinding as TFinding)).toMatch(
      /^\[turno 5 · idle-5 · \d{2}:\d{2}\]$/,
    );
    expect(weakFinding?.quote).not.toContain('tool');

    const card = screen.getByRole('article', { name: 'Hallazgo RES-5' });
    expect(
      within(card).getByText(weakFinding?.quote as string),
    ).toBeInTheDocument();

    for (const finding of [...report.findings, ...report.weakSignals]) {
      expect(finding.evidence.messageId).toBeTruthy();
      expect(anchorOf(finding)).toContain(finding.evidence.messageId as string);
    }
  });
});
