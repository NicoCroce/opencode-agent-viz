import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BAND_LABEL } from '../../lib/labels';
import { EfficiencySkeleton } from '../EfficiencySkeleton';

const LOADING_TEXT = 'Cargando análisis…';

/**
 * Esqueleto de carga del panel (contrato §4): anuncia el estado con
 * `role="status"` y el texto de carga, y no anuncia nota, banda ni datos
 * falsos. La silueta es decorativa: solo bloques, sin texto propio.
 */
describe('EfficiencySkeleton', () => {
  it('anuncia la carga con role="status" y su texto accesible', () => {
    render(<EfficiencySkeleton />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(LOADING_TEXT);
  });

  it('no anuncia una nota ni datos falsos: solo el texto de carga', () => {
    const { container } = render(<EfficiencySkeleton />);

    expect(container.textContent?.trim()).toBe(LOADING_TEXT);
    expect(container.textContent).not.toMatch(/\d/);
    expect(container.textContent).not.toMatch(/%/);
    for (const label of Object.values(BAND_LABEL)) {
      expect(container.textContent).not.toContain(label);
    }
  });

  it('renderiza la silueta de los bloques, sin contenido de informe', () => {
    const { container } = render(<EfficiencySkeleton />);

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });
});
