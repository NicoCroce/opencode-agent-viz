import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { TFactor } from '../../Efficiency.entity';
import { INDICATOR_LABEL } from '../../lib/labels';
import { EfficiencyFactors } from '../EfficiencyFactors';

const factor = (overrides: Partial<TFactor> = {}): TFactor => ({
  key: 'INP-1',
  dimension: 'entrada',
  label: INDICATOR_LABEL['INP-1'],
  count: 3,
  kind: 'resta',
  ...overrides,
});

const lossFactor = factor();
const gainFactor = factor({
  key: 'CACHE',
  dimension: 'contexto',
  label: INDICATOR_LABEL.CACHE,
  count: 12,
  kind: 'suma',
});

/**
 * Factores (FR-015; contrato overlay §5.2): 2–3 indicadores con etiqueta,
 * dimensión, conteo y signo `resta`/`suma`, en el orden recibido. El signo se
 * comunica con texto además del icono decorativo.
 */
describe('EfficiencyFactors', () => {
  it('muestra 2–3 factores con etiqueta, dimensión, conteo y signo', () => {
    render(<EfficiencyFactors factors={[lossFactor, gainFactor]} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(items[0]).toHaveTextContent('Pedidos consecutivos similares');
    expect(items[0]).toHaveTextContent('Entrada');
    expect(items[0]).toHaveTextContent(/resta/);
    expect(items[0]).toHaveTextContent('3');

    expect(items[1]).toHaveTextContent('Aprovechamiento de caché');
    expect(items[1]).toHaveTextContent('Contexto');
    expect(items[1]).toHaveTextContent(/suma/);
    expect(items[1]).toHaveTextContent('12');
  });

  it('respeta el orden de impacto recibido', () => {
    render(
      <EfficiencyFactors
        factors={[
          factor({
            key: 'RES-2',
            dimension: 'ejecucion',
            label: INDICATOR_LABEL['RES-2'],
            count: 2,
          }),
          factor(),
          gainFactor,
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Reintentos')).toBeInTheDocument();
    expect(
      within(items[1]).getByText('Pedidos consecutivos similares'),
    ).toBeInTheDocument();
    expect(
      within(items[2]).getByText('Aprovechamiento de caché'),
    ).toBeInTheDocument();
  });

  it('pinta el icono decorativo del signo (resta/suma)', () => {
    render(<EfficiencyFactors factors={[lossFactor, gainFactor]} />);

    const [loss, gain] = screen.getAllByRole('listitem');
    const lossIcon = loss.querySelector('svg');
    const gainIcon = gain.querySelector('svg');

    expect(lossIcon).toHaveAttribute('data-icon', 'circle-minus');
    expect(lossIcon).toHaveAttribute('aria-hidden', 'true');
    expect(gainIcon).toHaveAttribute('data-icon', 'circle-plus');
    expect(gainIcon).toHaveAttribute('aria-hidden', 'true');
  });

  it('rotula la sección y no pinta nada sin factores', () => {
    render(<EfficiencyFactors factors={[lossFactor]} />);
    expect(screen.getByText('Factores de impacto')).toBeInTheDocument();

    const { container } = render(<EfficiencyFactors factors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
