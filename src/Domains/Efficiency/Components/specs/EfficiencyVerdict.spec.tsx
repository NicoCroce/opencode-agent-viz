import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BAND_LABEL } from '../../lib/labels';
import { EfficiencyVerdict, type TVerdictData } from '../EfficiencyVerdict';

const report = (overrides: Partial<TVerdictData> = {}): TVerdictData => ({
  score: 78,
  band: 'aceptable',
  coverage: 95.5,
  confidence: 'media',
  ...overrides,
});

/**
 * Veredicto (FR-008/FR-041; contrato overlay §5.2): nota entera ≥2rem con el
 * nombre accesible exacto "{score} de 100, {banda}", banda con texto + icono
 * decorativo (no depende del color), cobertura y confianza visibles. Sin nota
 * (`score === null`) no pinta ni la nota ni valores.
 */
describe('EfficiencyVerdict', () => {
  it('expone el aria-label exacto "78 de 100, aceptable" en una nota ≥2rem', () => {
    render(<EfficiencyVerdict report={report()} />);

    const note = screen.getByRole('img', { name: '78 de 100, aceptable' });
    expect(note).toHaveTextContent('78');
    expect(note).toHaveClass('text-4xl');
    expect(screen.getByLabelText('78 de 100, aceptable')).toBe(note);
  });

  it.each([
    ['eficiente', 'circle-check'],
    ['aceptable', 'thumbs-up'],
    ['mejorable', 'triangle-alert'],
    ['friccion', 'circle-alert'],
  ] as const)(
    'pinta la banda %s con texto e icono decorativo',
    (band, iconName) => {
      render(<EfficiencyVerdict report={report({ band })} />);

      const bandText = screen.getByText(BAND_LABEL[band]);
      const icon = bandText.parentElement?.querySelector('svg');

      expect(icon).toHaveClass(`lucide-${iconName}`);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('muestra la cobertura con un decimal cuando es fraccionaria', () => {
    render(<EfficiencyVerdict report={report({ coverage: 95.5 })} />);

    expect(screen.getByText('Cobertura 95.5%')).toBeInTheDocument();
  });

  it('muestra la cobertura entera sin decimales y la confianza', () => {
    render(
      <EfficiencyVerdict
        report={report({ coverage: 100, confidence: 'alta' })}
      />,
    );

    expect(screen.getByText('Cobertura 100%')).toBeInTheDocument();
    expect(screen.getByText('confianza alta')).toBeInTheDocument();
  });

  it('no pinta nota ni valores cuando score es null', () => {
    const { container } = render(
      <EfficiencyVerdict
        report={report({
          score: null,
          band: null,
          confidence: null,
          coverage: 42,
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/de 100/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cobertura/)).not.toBeInTheDocument();
  });
});
