import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type {
  TEfficiencyReference,
  TEfficiencyTotals,
} from '../../Efficiency.entity';
import { EfficiencyTotals } from '../EfficiencyTotals';

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

const absentTotals = (): TEfficiencyTotals =>
  totals({
    cost: null,
    tokensIn: null,
    tokensOut: null,
    cacheRead: null,
    cacheWrite: null,
    windowTokens: null,
    latencyP95Ms: null,
    slowToolCalls: 0,
    compactions: 0,
    retries: 0,
    toolErrors: 0,
    toolCalls: 0,
  });

const metric = (label: string): HTMLElement =>
  screen.getByText(label).parentElement as HTMLElement;

/**
 * Totales (FR-017/FR-045; contrato overlay §5.6): coste, tokens in/out, caché,
 * ventana, compactaciones, reintentos, errores, llamadas y latencia p95 con
 * “no disponible” en ausencia (nunca 0 ni 100). El contraste con la cabecera
 * solo aparece si difiere y no duplica `SessionSummaryBar`/`MetricsSection`.
 */
describe('EfficiencyTotals', () => {
  it('pinta coste, tokens, caché, conteos y latencia con sus valores', () => {
    render(<EfficiencyTotals totals={totals()} />);

    expect(screen.getByText('Totales')).toBeInTheDocument();
    expect(metric('Coste')).toHaveTextContent('$1.23');
    expect(metric('Tokens in')).toHaveTextContent('1.2k');
    expect(metric('Tokens out')).toHaveTextContent('345');
    expect(metric('Caché lectura')).toHaveTextContent('2.0k');
    expect(metric('Caché escritura')).toHaveTextContent('4.0k');
    expect(metric('Ventana de contexto')).toHaveTextContent('7.2k');
    expect(metric('Compactaciones')).toHaveTextContent('1');
    expect(metric('Reintentos')).toHaveTextContent('0');
    expect(metric('Errores de herramientas')).toHaveTextContent('3');
    expect(metric('Llamadas a herramientas')).toHaveTextContent('42');
    expect(metric('Latencia p95')).toHaveTextContent('1s');
    expect(metric('Llamadas >60 s')).toHaveTextContent('2');
  });

  it('usa “no disponible” en cada total ausente y nunca 0 ni 100', () => {
    render(<EfficiencyTotals totals={absentTotals()} />);

    expect(screen.getAllByLabelText('no disponible')).toHaveLength(7);
    expect(metric('Coste')).toHaveTextContent('—');
    expect(metric('Tokens in')).toHaveTextContent('—');
    expect(metric('Tokens out')).toHaveTextContent('—');
    expect(metric('Caché lectura')).toHaveTextContent('—');
    expect(metric('Caché escritura')).toHaveTextContent('—');
    expect(metric('Ventana de contexto')).toHaveTextContent('—');
    expect(metric('Latencia p95')).toHaveTextContent('—');

    expect(metric('Compactaciones')).toHaveTextContent('0');
    expect(metric('Errores de herramientas')).toHaveTextContent('0');
    expect(metric('Llamadas a herramientas')).toHaveTextContent('0');

    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument();
  });

  it('contrasta con la cabecera solo cuando los totales difieren', () => {
    const reference: TEfficiencyReference = {
      cost: 2,
      tokens: {
        input: 2000,
        output: 500,
        cacheRead: 3000,
        cacheWrite: 5000,
      },
    };

    const { rerender } = render(
      <EfficiencyTotals totals={totals()} reference={reference} />,
    );

    expect(
      screen.getByText('La cabecera incluye compactación; el panel no.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cabecera: coste \$2\.00/)).toBeInTheDocument();
    expect(screen.getByText(/tokens in 2\.0k/)).toBeInTheDocument();
    expect(screen.getByText(/tokens out 500/)).toBeInTheDocument();
    expect(screen.getByText(/caché lectura 3\.0k/)).toBeInTheDocument();
    expect(screen.getByText(/caché escritura 5\.0k/)).toBeInTheDocument();

    rerender(
      <EfficiencyTotals
        totals={totals()}
        reference={{
          cost: 1.2345,
          tokens: {
            input: 1200,
            output: 345,
            cacheRead: 2000,
            cacheWrite: 4000,
          },
        }}
      />,
    );

    expect(
      screen.queryByText('La cabecera incluye compactación; el panel no.'),
    ).not.toBeInTheDocument();
  });

  it('no duplica SessionSummaryBar ni MetricsSection', () => {
    render(<EfficiencyTotals totals={totals()} />);

    expect(screen.queryByText('Costo')).not.toBeInTheDocument();
    expect(screen.queryByText('Métricas')).not.toBeInTheDocument();
    expect(screen.queryByText('Contexto')).not.toBeInTheDocument();
  });

  it('no inventa contraste si la referencia no reporta coste ni tokens', () => {
    const reference: TEfficiencyReference = { cost: null, tokens: null };

    render(<EfficiencyTotals totals={totals()} reference={reference} />);

    expect(
      screen.queryByText('La cabecera incluye compactación; el panel no.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Cabecera:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no disponible/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('no disponible')).not.toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
    expect(metric('Coste')).toHaveTextContent('$1.23');
  });

  it('pinta “no disponible” en los campos ausentes de la referencia, nunca 0', () => {
    const reference: TEfficiencyReference = {
      cost: null,
      tokens: { input: 2_000, output: null, cacheRead: null, cacheWrite: null },
    };

    render(<EfficiencyTotals totals={totals()} reference={reference} />);

    expect(
      screen.getByText('La cabecera incluye compactación; el panel no.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cabecera: coste no disponible/)).toBeInTheDocument();
    expect(screen.getByText(/tokens in 2\.0k/)).toBeInTheDocument();
    expect(screen.getByText(/tokens out no disponible/)).toBeInTheDocument();
    expect(screen.getByText(/caché lectura no disponible/)).toBeInTheDocument();
    expect(screen.getByText(/caché escritura no disponible/)).toBeInTheDocument();
    expect(screen.queryByText(/Cabecera: coste \$0\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tokens out 0\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/caché lectura 0\b/)).not.toBeInTheDocument();
  });
});
