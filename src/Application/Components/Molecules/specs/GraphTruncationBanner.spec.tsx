import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { GraphTruncationBanner } from '../GraphTruncationBanner';

/**
 * Specs de la molecule `GraphTruncationBanner` (feature 011, T005, FR-006, SC-009;
 * `contracts/subtree-structure-contract.md` §5, `data-model.md` §7).
 *
 * El aviso de truncamiento es **informativo puro**: comunica que el resultado
 * está cortado sin ofrecer salida ni cifras ("N de M"), de modo que el mismo
 * componente sirve al corte del subárbol del grafo y al del listado de raíces.
 * Se anuncia con `role="status"` + `aria-live="polite"` (patrón `ConnectionBadge`)
 * y **nunca** con `role="alert"`, que ya ocupa el banner de atención del chat.
 *
 * La molecula no recibe props: al no conocer el recuento no puede exponer cifras.
 *
 * Ampliación aditiva (ola C de reparación): se añaden dos casos que fijan que el
 * aviso conserve el `data-testid` que consumen los paneles y que titule/describa
 * a través del `Alert` compartido con la variante `warning` (sin duplicar clases).
 */

const renderBanner = () => renderWithProviders(<GraphTruncationBanner />);

const getNotice = () => screen.getByRole('status');

describe('GraphTruncationBanner', () => {
  it('se anuncia como status políticamente (nunca como alert)', () => {
    renderBanner();

    const notice = getNotice();
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('comunica el corte con texto visible, no solo color', () => {
    renderBanner();

    expect(getNotice().textContent?.trim()).not.toBe('');
  });

  it('es informativo puro: sin acción', () => {
    renderBanner();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('no muestra cifras ("N de M")', () => {
    renderBanner();

    const text = getNotice().textContent ?? '';
    expect(text).not.toMatch(/\d+\s*(?:de|\/)\s*\d+/);
    expect(text).not.toMatch(/\d/);
  });

  it('expone el hook de test que esperan los paneles (GraphPane, rail de sesiones)', () => {
    renderBanner();

    expect(screen.getByTestId('graph-truncation-banner')).toBe(getNotice());
  });

  it('titula y describe el aviso a través del Alert compartido (variante warning)', () => {
    renderBanner();

    const notice = getNotice();
    expect(
      screen.getByRole('heading', { level: 5, name: 'Vista parcial' }),
    ).toBeInTheDocument();
    expect(notice).toHaveTextContent(
      'Hay más sesiones de las que se pudieron cargar',
    );
  });
});
