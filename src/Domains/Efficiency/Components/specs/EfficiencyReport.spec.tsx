import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  TEfficiencyReference,
  TEfficiencyReport,
  TEfficiencyTotals,
  TFinding,
  TRuleId,
  TTurnAnalysis,
} from '../../Efficiency.entity';
import { EfficiencyReport } from '../EfficiencyReport';

const totals = (
  overrides: Partial<TEfficiencyTotals> = {},
): TEfficiencyTotals => ({
  cost: 1.2345,
  tokensIn: 1200,
  tokensOut: 345,
  cacheRead: 2000,
  cacheWrite: 4000,
  windowTokens: 7200,
  latencyP95Ms: 1500,
  slowToolCalls: 2,
  compactions: 1,
  retries: 0,
  toolErrors: 3,
  toolCalls: 42,
  ...overrides,
});

const report = (
  overrides: Partial<TEfficiencyReport> = {},
): TEfficiencyReport => ({
  status: 'ok',
  score: 78,
  band: 'aceptable',
  coverage: 100,
  confidence: 'alta',
  dimensions: [
    {
      key: 'entrada',
      weight: 30,
      value: 70,
      available: true,
      indicators: [
        { key: 'INP-1', ratio: 0.5, cap: 1, score: 0.5, count: 3, minimum: 3 },
      ],
    },
    {
      key: 'contexto',
      weight: 15,
      value: 90,
      available: true,
      indicators: [
        {
          key: 'CACHE',
          ratio: 0.8,
          cap: 0.6,
          score: 1,
          count: 12,
          minimum: 10,
        },
      ],
    },
  ],
  findings: [],
  weakSignals: [],
  turns: [],
  totals: totals(),
  notes: [],
  ...overrides,
});

const reference: TEfficiencyReference = {
  cost: 9.99,
  tokens: { input: 5000, output: 900, cacheRead: 8000, cacheWrite: 1000 },
};

const finding = (
  ruleId: TRuleId,
  overrides: Partial<TFinding> = {},
): TFinding => ({
  ruleId,
  severity: 'media',
  dimension: 'ejecucion',
  penalizes: true,
  evidence: { sessionId: 'root', messageId: `msg_${ruleId}`, turnIndex: 1 },
  quote: `[turno 1 · msg_${ruleId}] "evidencia de ${ruleId}"`,
  condition: `Condición medida de ${ruleId}`,
  recommendation: `Recomendación de ${ruleId}`,
  ...overrides,
});

/** Siete penalizantes: cinco visibles y dos bajo “Ver 2 hallazgos más”. */
const SEVEN_RULES: TRuleId[] = [
  'INP-1',
  'INP-2',
  'INP-3',
  'INP-4',
  'RES-1',
  'RES-2',
  'RES-3',
];

const turn = (overrides: Partial<TTurnAnalysis> = {}): TTurnAnalysis => ({
  index: 1,
  userMessageId: 'msg_user_1',
  at: Date.UTC(2026, 0, 15, 10, 30),
  prompt: 'Pedido del turno',
  promptTokens: 3,
  closed: true,
  outcome: 'succeeded',
  clarifications: 0,
  steps: 2,
  toolCalls: 2,
  toolErrors: 0,
  retries: 0,
  cost: 0.01,
  durationMs: 1_500,
  signals: [],
  ...overrides,
});

/** Mismo informe para contrastar escritorio y móvil (FR-034/SC-010). */
const parityReport = (): TEfficiencyReport =>
  report({
    coverage: 80,
    findings: [finding('INP-1')],
    turns: [
      turn(),
      turn({
        index: 2,
        userMessageId: 'msg_user_2',
        prompt: 'Segundo pedido',
        signals: ['RES-1'],
      }),
    ],
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Orquestador del informe (FR-008/FR-014/FR-015/FR-017; contrato overlay
 * §4–§5): con `status: 'ok'` compone veredicto, factores, “Cómo se calcula” y
 * totales. Sin nota (`score: null`) no pinta la cifra. No tiene fetch ni estados
 * de carga/error propios: los resuelve el overlay antes de montarlo.
 */
describe('EfficiencyReport', () => {
  it('compone veredicto, factores, cómo se calcula y totales con status ok', () => {
    render(<EfficiencyReport report={report()} isMobile={false} />);

    expect(
      screen.getByRole('img', { name: '78 de 100, aceptable' }),
    ).toHaveTextContent('78');

    expect(screen.getByText('Factores de impacto')).toBeInTheDocument();
    expect(
      screen.getByText('Pedidos consecutivos similares'),
    ).toBeInTheDocument();
    expect(screen.getByText('Aprovechamiento de caché')).toBeInTheDocument();

    expect(screen.getByText('Cómo se calcula')).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
    expect(
      screen.getByText('Coste', { selector: 'span' }).parentElement,
    ).toHaveTextContent('$1.23');
    expect(
      screen.getByText('Llamadas a herramientas', { selector: 'span' })
        .parentElement,
    ).toHaveTextContent('42');
  });

  it('pasa la referencia de la cabecera solo para contrastar los totales', () => {
    render(
      <EfficiencyReport
        report={report()}
        reference={reference}
        isMobile={false}
      />,
    );

    expect(
      screen.getByText('La cabecera incluye compactación; el panel no.'),
    ).toBeInTheDocument();
  });

  it('no pinta nota ni cifra de score cuando score es null', () => {
    render(
      <EfficiencyReport
        report={report({
          status: 'insufficient',
          score: null,
          band: null,
          confidence: 'baja',
          dimensions: [],
        })}
        isMobile={false}
      />,
    );

    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('78')).not.toBeInTheDocument();
    expect(screen.queryByText('Factores de impacto')).not.toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
  });

  it('no hace fetch ni pinta estados de carga o error propios', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<EfficiencyReport report={report()} isMobile={true} />);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/Cargando/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No se pudo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pinta hallazgos y señales en sus propias secciones y conserva la nota', () => {
    render(
      <EfficiencyReport
        report={report({
          findings: [finding('INP-1'), finding('RES-1')],
          weakSignals: [
            finding('RES-4', { penalizes: false, dimension: 'contexto' }),
          ],
        })}
        isMobile={false}
      />,
    );

    expect(
      screen.getByRole('img', { name: '78 de 100, aceptable' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Hallazgos')).toHaveLength(1);
    expect(screen.getAllByText('Señales (no restan)')).toHaveLength(1);
    expect(
      screen.getByRole('article', { name: 'Hallazgo INP-1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Hallazgo RES-1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Hallazgo RES-4' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Condición medida de INP-1')).toBeInTheDocument();
    expect(screen.queryByText('Sin hallazgos')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin señales débiles')).not.toBeInTheDocument();
  });

  it('declara ambos vacíos explícitos cuando no hay hallazgos ni señales', () => {
    render(
      <EfficiencyReport
        report={report({ findings: [], weakSignals: [] })}
        isMobile={false}
      />,
    );

    expect(screen.getByText('Sin hallazgos')).toBeInTheDocument();
    expect(screen.getByText('Sin señales débiles')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ver \d+ hallazgos más/ }),
    ).not.toBeInTheDocument();
  });

  it('muestra cinco hallazgos y el resto bajo "Ver 2 hallazgos más" sin duplicar secciones', async () => {
    const user = userEvent.setup();
    render(
      <EfficiencyReport
        report={report({
          findings: SEVEN_RULES.map((ruleId) => finding(ruleId)),
          weakSignals: [
            finding('RES-4', { penalizes: false, dimension: 'contexto' }),
            finding('RES-5', { penalizes: false, dimension: null }),
          ],
        })}
        isMobile={false}
      />,
    );

    expect(screen.getAllByText('Hallazgos')).toHaveLength(1);
    expect(screen.getAllByText('Señales (no restan)')).toHaveLength(1);
    // Cinco hallazgos visibles + las dos señales de su sección.
    expect(screen.getAllByRole('article')).toHaveLength(7);
    expect(screen.queryByLabelText('Hallazgo RES-2')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hallazgo RES-3')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Ver 2 hallazgos más' }),
    );

    const labels = screen
      .getAllByRole('article')
      .map((card) => card.getAttribute('aria-label'));
    expect(labels).toEqual([
      ...SEVEN_RULES.map((ruleId) => `Hallazgo ${ruleId}`),
      'Hallazgo RES-4',
      'Hallazgo RES-5',
    ]);
    expect(screen.getAllByLabelText('Hallazgo INP-1')).toHaveLength(1);
    expect(screen.getAllByLabelText('Hallazgo RES-4')).toHaveLength(1);
    expect(
      screen.getByRole('img', { name: '78 de 100, aceptable' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver menos' }));

    expect(screen.getAllByRole('article')).toHaveLength(7);
    expect(screen.queryByLabelText('Hallazgo RES-3')).not.toBeInTheDocument();
  });

  it('no pinta hallazgos ni señales cuando el informe no es puntuable', () => {
    render(
      <EfficiencyReport
        report={report({
          status: 'in_progress',
          score: null,
          band: null,
          dimensions: [],
          findings: [finding('INP-1')],
          weakSignals: [finding('RES-4', { penalizes: false })],
        })}
        isMobile={false}
      />,
    );

    expect(screen.queryByText('Hallazgos')).not.toBeInTheDocument();
    expect(screen.queryByText('Señales (no restan)')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('monta la tabla de turnos con los pedidos del informe en escritorio', () => {
    render(
      <EfficiencyReport
        report={report({
          turns: [
            turn(),
            turn({
              index: 2,
              userMessageId: 'msg_user_2',
              prompt: 'Segundo pedido',
              signals: ['RES-1'],
            }),
          ],
        })}
        isMobile={false}
      />,
    );

    const table = screen.getByRole('table', {
      name: 'Turnos de la sesión',
    });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['1', '2']);

    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Pedido del turno')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Segundo pedido')).toBeInTheDocument();
    expect(within(rows[2]).getByText('RES-1')).toBeInTheDocument();
  });

  it('declara “Sin turnos” cuando el informe no trae turnos', () => {
    render(
      <EfficiencyReport report={report({ turns: [] })} isMobile={false} />,
    );

    expect(screen.getByText('Sin turnos')).toBeInTheDocument();
  });

  it('en móvil pinta tarjetas de turno y conserva nota, cobertura y hallazgos', () => {
    const { container } = render(
      <EfficiencyReport report={parityReport()} isMobile={true} />,
    );

    expect(
      screen.queryByRole('table', { name: 'Turnos de la sesión' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Turno 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Turno 2' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);

    expect(
      screen.getByRole('img', { name: '78 de 100, aceptable' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cobertura 80%')).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Hallazgo INP-1' }),
    ).toBeInTheDocument();

    // Una sola sección de cada tipo y un solo turno montado: sin duplicados.
    expect(screen.getAllByText('Hallazgos')).toHaveLength(1);
    expect(screen.getAllByText('Señales (no restan)')).toHaveLength(1);
    expect(screen.getAllByText('Totales')).toHaveLength(1);
    expect(screen.getAllByText('Pedido del turno')).toHaveLength(1);
    expect(container.innerHTML).not.toContain('md:hidden');
  });

  it('en escritorio pinta la tabla y conserva nota, cobertura y hallazgos', () => {
    const { container } = render(
      <EfficiencyReport report={parityReport()} isMobile={false} />,
    );

    const table = screen.getByRole('table', {
      name: 'Turnos de la sesión',
    });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['1', '2']);
    expect(
      screen.queryByRole('article', { name: /^Turno / }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);

    expect(
      screen.getByRole('img', { name: '78 de 100, aceptable' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cobertura 80%')).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'Hallazgo INP-1' }),
    ).toBeInTheDocument();

    // Una sola sección de cada tipo y un solo turno montado: sin duplicados.
    expect(screen.getAllByText('Hallazgos')).toHaveLength(1);
    expect(screen.getAllByText('Señales (no restan)')).toHaveLength(1);
    expect(screen.getAllByText('Totales')).toHaveLength(1);
    expect(screen.getAllByText('Pedido del turno')).toHaveLength(1);
    expect(container.innerHTML).not.toContain('md:hidden');
  });

  it('en curso declara el estado y métricas crudas, sin nota, valores ni hallazgos', () => {
    render(
      <EfficiencyReport
        report={report({
          status: 'in_progress',
          score: null,
          band: null,
          confidence: 'baja',
          coverage: 100,
          dimensions: [
            {
              key: 'entrada',
              weight: 30,
              value: 70,
              available: true,
              indicators: [
                {
                  key: 'INP-1',
                  ratio: 0.5,
                  cap: 1,
                  score: 0.5,
                  count: 3,
                  minimum: 3,
                },
              ],
            },
          ],
          findings: [finding('INP-1')],
          weakSignals: [finding('RES-4', { penalizes: false })],
        })}
        isMobile={false}
      />,
    );

    expect(screen.getByText('Sesión en curso: sin nota')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /de 100/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Factores de impacto')).not.toBeInTheDocument();
    expect(screen.queryByText('Hallazgos')).not.toBeInTheDocument();
    expect(screen.queryByText('Señales (no restan)')).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    // El valor de una dimensión disponible no se pinta como si fuera la nota.
    expect(screen.queryByText('70')).not.toBeInTheDocument();

    expect(screen.getByText('Datos disponibles')).toBeInTheDocument();
    expect(screen.getByText('Cobertura 100%.')).toBeInTheDocument();
    expect(screen.getByText('Turnos cerrados 0 de 0.')).toBeInTheDocument();
    expect(screen.getByText('Sin dimensiones omitidas.')).toBeInTheDocument();
    expect(screen.getByText('Totales')).toBeInTheDocument();
  });

  it('insuficiente por menos de dos turnos cerrados declara ese motivo', () => {
    render(
      <EfficiencyReport
        report={report({
          status: 'insufficient',
          score: null,
          band: null,
          confidence: 'baja',
          coverage: 100,
          turns: [turn({ closed: true })],
        })}
        isMobile={false}
      />,
    );

    expect(screen.getByText('Muestra insuficiente')).toBeInTheDocument();
    expect(
      screen.getByText('Menos de 2 turnos cerrados (1).'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Cobertura inferior al 60%/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /de 100/ })).not.toBeInTheDocument();
  });

  it('insuficiente por cobertura menor que 60 declara ese motivo', () => {
    render(
      <EfficiencyReport
        report={report({
          status: 'insufficient',
          score: null,
          band: null,
          confidence: 'baja',
          coverage: 45,
          dimensions: [],
          turns: [turn({ closed: true }), turn({ index: 2, closed: true })],
        })}
        isMobile={false}
      />,
    );

    expect(screen.getByText('Muestra insuficiente')).toBeInTheDocument();
    expect(
      screen.getByText('Cobertura inferior al 60% (45%).'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Menos de 2 turnos cerrados/),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Cobertura 45%.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /de 100/ })).not.toBeInTheDocument();
  });

  it('no monta ningún bloque de informe cuando el estado es no_data', () => {
    const { container } = render(
      <EfficiencyReport
        report={report({
          status: 'no_data',
          score: null,
          band: null,
          confidence: null,
          coverage: 0,
          dimensions: [],
          turns: [],
        })}
        isMobile={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('img', { name: /de 100/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Totales')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin mensajes')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('muestra un solo turno visible y ninguna nota cuando el informe es insuficiente', () => {
    render(
      <EfficiencyReport
        report={report({
          status: 'insufficient',
          score: null,
          band: null,
          confidence: 'baja',
          dimensions: [],
          turns: [turn({ signals: ['RES-1'] })],
        })}
        isMobile={false}
      />,
    );

    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
    expect(screen.getByText('Pedido del turno')).toBeInTheDocument();
    expect(screen.getByText('RES-1')).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /de 100/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Factores de impacto')).not.toBeInTheDocument();
  });
});
