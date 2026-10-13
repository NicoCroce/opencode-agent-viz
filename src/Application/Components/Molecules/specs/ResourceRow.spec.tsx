import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import { ResourceRow } from '../ResourceRow';

/**
 * Specs de la molecule `ResourceRow` (feature 011, T044, US6, FR-010, SC-007;
 * `contracts/inspector-skills-contract.md` §3–§4 → I5, I6; `research.md` §UI).
 *
 * T049 la extiende a `items: { label: string; note?: string }[]`:
 * - con `note` pinta `label · note` (p. ej. `frontend-design · ~3.4k tokens`) y
 *   **sin** el chip "disponible", porque la skill ya se cargó;
 * - sin `note` conserva el chip "disponible" (MCP/Instructions/Tools intactos, I6).
 *
 * La estimación es **aproximada**: el `~` visible se completa con "aproximadamente"
 * deletreado en el `aria-label`, nunca como única señal semántica.
 *
 * RED por diseño: hoy `ResourceRow` recibe `string[]`, así que los casos con
 * `note` fallan (React no puede pintar el objeto) hasta que llegue T049.
 */

type RowItem = { label: string; note?: string };

const renderRow = (items: RowItem[], emptyLabel = 'Sin skills cargadas') =>
  render(<ResourceRow label="Skills" items={items} emptyLabel={emptyLabel} />);

describe('ResourceRow', () => {
  it('pinta "label · note" cuando el item trae note', () => {
    const { container } = renderRow([{ label: 'frontend-design', note: '~3.4k tokens' }]);

    expect(container).toHaveTextContent(/frontend-design\s*·\s*~3\.4k tokens/);
  });

  it('con note no afirma "disponible": la skill ya se usó', () => {
    const { container } = renderRow([{ label: 'frontend-design', note: '~3.4k tokens' }]);

    expect(container).not.toHaveTextContent('disponible');
  });

  it('sin note conserva el chip "disponible" (MCP/Instructions/Tools intactos)', () => {
    const { container } = renderRow([{ label: 'bash' }], 'Sin herramientas usadas');

    expect(container).toHaveTextContent(/bash\s*disponible/);
  });

  it('deletrea "aproximadamente" en el aria-label, no solo con el "~"', () => {
    const { container } = renderRow([{ label: 'frontend-design', note: '~3.4k tokens' }]);

    const spelled = within(container).getByLabelText(/aproximadamente/i);

    expect(spelled).toBeInTheDocument();
    // La forma corta sigue visible: el aria-label la completa, no la sustituye.
    expect(container).toHaveTextContent(/~3\.4k tokens/);
  });

  it('mezcla items con y sin note en la misma fila', () => {
    const { container } = renderRow([
      { label: 'frontend-design', note: '~3.4k tokens' },
      { label: 'test-driven-development' },
    ]);

    expect(container).toHaveTextContent(/frontend-design\s*·\s*~3\.4k tokens/);
    expect(container).toHaveTextContent(/test-driven-development\s*disponible/);
    expect(container.textContent?.match(/disponible/g)).toHaveLength(1);
  });

  it('sin recursos pinta el emptyLabel y no muestra chips', () => {
    const { container } = renderRow([], 'Sin skills cargadas');

    expect(container).toHaveTextContent('Sin skills cargadas');
    expect(container).not.toHaveTextContent('disponible');
  });
});
