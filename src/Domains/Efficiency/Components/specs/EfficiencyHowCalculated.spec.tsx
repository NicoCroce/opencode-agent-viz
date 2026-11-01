import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  TDimensionResult,
  TIndicatorResult,
} from '../../Efficiency.entity';
import {
  EfficiencyHowCalculated,
  type THowCalculatedData,
} from '../EfficiencyHowCalculated';

const indicator = (
  overrides: Partial<TIndicatorResult> = {},
): TIndicatorResult => ({
  key: 'INP-1',
  ratio: 0.25,
  cap: 0.5,
  score: 0.5,
  count: 6,
  minimum: 3,
  ...overrides,
});

const dimension = (
  overrides: Partial<TDimensionResult> = {},
): TDimensionResult => ({
  key: 'entrada',
  weight: 30,
  value: 90,
  available: true,
  indicators: [indicator()],
  ...overrides,
});

const dimensions = (): TDimensionResult[] => [
  dimension(),
  dimension({
    key: 'ejecucion',
    weight: 30,
    value: 80,
    indicators: [
      indicator({
        key: 'RES-1',
        ratio: 0.1,
        cap: 0.2,
        score: 0.5,
        count: 20,
        minimum: 10,
      }),
    ],
  }),
  dimension({
    key: 'contexto',
    weight: 15,
    value: 70,
    indicators: [
      indicator({
        key: 'RES-4',
        ratio: 0,
        cap: 2,
        score: 1,
        count: 1,
        minimum: 0,
      }),
      indicator({
        key: 'CACHE',
        ratio: 0.5,
        cap: 0.6,
        score: 0.8,
        count: 12,
        minimum: 10,
      }),
    ],
  }),
  dimension({
    key: 'resultado',
    weight: 25,
    value: 60,
    indicators: [
      indicator({
        key: 'OUTCOME',
        ratio: 0,
        cap: 1,
        score: 1,
        count: 1,
        minimum: 1,
      }),
    ],
  }),
];

const report = (
  overrides: Partial<THowCalculatedData> = {},
): THowCalculatedData => ({
  status: 'ok',
  dimensions: dimensions(),
  coverage: 85,
  confidence: 'alta',
  notes: ['El turno abierto no entra en los denominadores.'],
  ...overrides,
});

const openCalculation = async (data: THowCalculatedData) => {
  const user = userEvent.setup();
  render(<EfficiencyHowCalculated report={data} />);
  await user.click(screen.getByRole('button', { name: 'Cómo se calcula' }));
};

const dimensionRow = (label: string): HTMLElement => {
  const table = screen.getByRole('table', {
    name: 'Pesos y valores de las dimensiones',
  });
  return within(table).getByText(label).closest('tr') as HTMLElement;
};

const indicatorRow = (label: string): HTMLElement =>
  screen.getByText(label).closest('tr') as HTMLElement;

/**
 * “Cómo se calcula” (FR-014/FR-016; contrato overlay §5.5): Disclosure con
 * pesos de dimensión e indicador, muestra y mínimo, r, cap, aporte, puntos
 * perdidos, cobertura, omisiones, confianza, bandas, notas y la aclaración de
 * que coste y latencia no puntúan.
 */
describe('EfficiencyHowCalculated', () => {
  it('abre con pesos, indicadores, mínimos, cobertura, confianza, bandas y notas', async () => {
    await openCalculation(report());

    expect(
      screen.getByRole('button', { name: 'Ocultar cálculo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Cómo se calcula' }),
    ).toBeInTheDocument();

    expect(dimensionRow('Entrada')).toHaveTextContent('30');
    expect(dimensionRow('Entrada')).toHaveTextContent('90');
    expect(dimensionRow('Ejecución')).toHaveTextContent('30');
    expect(dimensionRow('Contexto')).toHaveTextContent('15');
    expect(dimensionRow('Resultado')).toHaveTextContent('25');

    const firstIndicator = indicatorRow('Pedidos consecutivos similares');
    expect(firstIndicator).toHaveTextContent('45%');
    expect(firstIndicator).toHaveTextContent('6 / 3');
    expect(firstIndicator).toHaveTextContent('0.25');
    expect(firstIndicator).toHaveTextContent('0.50');
    expect(firstIndicator).toHaveTextContent('50%');
    expect(firstIndicator).toHaveTextContent('6.8');

    expect(screen.getByText(/Cobertura: 85%/)).toBeInTheDocument();
    expect(screen.getByText(/Confianza alta/)).toBeInTheDocument();
    expect(screen.getByText(/85–100 eficiente/)).toBeInTheDocument();
    expect(screen.getByText(/70–84 aceptable/)).toBeInTheDocument();
    expect(screen.getByText(/50–69 mejorable/)).toBeInTheDocument();
    expect(screen.getByText(/0–49 fricción/)).toBeInTheDocument();
    expect(
      screen.getByText('El turno abierto no entra en los denominadores.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Coste y latencia se muestran; no puntúan.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Totales derivados de mensajes; no incluyen compactación.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sin omisiones/)).toBeInTheDocument();
  });

  it('declara la dimensión omitida con su motivo y peso perdido', async () => {
    await openCalculation(
      report({
        dimensions: [
          dimension({
            available: false,
            value: null,
            indicators: [indicator({ count: 2, minimum: 3 })],
          }),
          ...dimensions().slice(1),
        ],
        coverage: 70,
      }),
    );

    expect(dimensionRow('Entrada')).toHaveTextContent('omitida');
    expect(
      screen.getByText(/2 de 3 pares consecutivos elegibles/),
    ).toBeInTheDocument();
    expect(screen.getByText(/pierde 30 puntos/)).toBeInTheDocument();
    expect(screen.getByText(/Cobertura: 70%/)).toBeInTheDocument();
  });

  it('con status distinto de ok no pinta valores de dimensión que parezcan nota', async () => {
    await openCalculation(
      report({ status: 'in_progress', confidence: 'baja', coverage: 100 }),
    );

    expect(screen.getAllByText('sin nota')).toHaveLength(4);
    expect(screen.queryByText('90')).not.toBeInTheDocument();
    expect(screen.queryByText('80')).not.toBeInTheDocument();
    expect(screen.queryByText('70')).not.toBeInTheDocument();
    expect(screen.queryByText('60')).not.toBeInTheDocument();
    expect(screen.getByText(/Cobertura: 100%/)).toBeInTheDocument();
  });

  it('declara la caché omitida con su peso parcial de cobertura', async () => {
    const cacheOmitted = dimensions().map((item) =>
      item.key === 'contexto'
        ? {
            ...item,
            indicators: item.indicators.filter(
              (current) => current.key === 'RES-4',
            ),
          }
        : item,
    );

    await openCalculation(report({ dimensions: cacheOmitted }));

    expect(screen.getByText(/Caché no puntuable/)).toBeInTheDocument();
    expect(screen.getByText(/pierde 4.5 puntos/)).toBeInTheDocument();
  });

  it('muestra “Sin notas” cuando el motor no emite ninguna', async () => {
    await openCalculation(report({ notes: [] }));

    expect(screen.getByText('Sin notas.')).toBeInTheDocument();
  });
});
