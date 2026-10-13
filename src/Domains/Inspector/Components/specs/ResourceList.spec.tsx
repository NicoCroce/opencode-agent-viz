import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { ResourceList } from '../ResourceList';
import type { TResourceUsage } from '../../Inspector.entity';

/**
 * T043 (US6, FR-009/FR-010, SC-007): los recursos se ejercen con datos reales,
 * no solo con el vacío. `TResourceUsage.skills` pasa a `TSkillUsage[]`
 * (U17, ola 4) y `ResourceList` pinta `nombre · ~N tokens` + "Sin skills
 * cargadas" (U23, ola 6): los casos de skills quedan en **RED por diseño**
 * hasta que aterricen esas unidades.
 */
const buildResources = (
  overrides: Partial<TResourceUsage> = {},
): TResourceUsage => ({
  mcpServers: [{ name: 'context7', status: 'connected' }],
  instructions: ['.opencode/instructions/app.instructions.md'],
  skills: [],
  tools: ['bash'],
  availability: 'available',
  ...overrides,
});

const skillsRow = () => screen.getByText('Skills').parentElement as HTMLElement;

describe('ResourceList', () => {
  it('lists resources labelled as available', () => {
    renderWithProviders(<ResourceList resources={buildResources()} />);

    expect(screen.getByText('context7 (connected)')).toBeInTheDocument();
    expect(screen.getAllByText('disponible').length).toBeGreaterThan(0);
  });

  it('shows an explanatory empty state', () => {
    renderWithProviders(
      <ResourceList
        resources={buildResources({
          mcpServers: [],
          instructions: [],
          skills: [],
          tools: [],
        })}
      />,
    );

    expect(
      screen.getByText('Sin recursos configurados para este agente.'),
    ).toBeInTheDocument();
  });

  it('muestra la skill cargada con su estimación aproximada de tokens (I5)', () => {
    renderWithProviders(
      <ResourceList
        resources={buildResources({
          skills: [
            {
              name: 'frontend-design',
              count: 1,
              estTokens: 3400,
              firstLoadedAt: 1_700_000_000_000,
            },
          ],
        })}
      />,
    );

    const row = skillsRow();
    expect(row).toHaveTextContent('frontend-design');
    expect(row).toHaveTextContent('~3.4k tokens');
    expect(
      within(row).getAllByLabelText(/aproximadamente/i).length,
    ).toBeGreaterThan(0);
  });

  it('no inventa la estimación cuando la skill no tiene texto (I5)', () => {
    renderWithProviders(
      <ResourceList
        resources={buildResources({
          skills: [
            {
              name: 'commit-conventions',
              count: 1,
              estTokens: null,
              firstLoadedAt: 1_700_000_000_000,
            },
          ],
        })}
      />,
    );

    const row = skillsRow();
    expect(row).toHaveTextContent('commit-conventions');
    expect(row).not.toHaveTextContent('~');
    expect(row).not.toHaveTextContent(/tokens/);
  });

  it('dice "Sin skills cargadas" en vez del vacío genérico (I4)', () => {
    renderWithProviders(<ResourceList resources={buildResources()} />);

    expect(screen.getByText('Sin skills cargadas')).toBeInTheDocument();
    expect(screen.queryByText('Sin skills configuradas')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Sin recursos configurados para este agente.'),
    ).not.toBeInTheDocument();
  });

  it('mantiene visible la sección cuando solo hay skills (I4)', () => {
    renderWithProviders(
      <ResourceList
        resources={buildResources({
          mcpServers: [],
          instructions: [],
          tools: [],
          skills: [
            {
              name: 'frontend-design',
              count: 2,
              estTokens: 3400,
              firstLoadedAt: 1_700_000_000_000,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Recursos')).toBeInTheDocument();
    expect(skillsRow()).toHaveTextContent('frontend-design');
    expect(
      screen.queryByText('Sin recursos configurados para este agente.'),
    ).not.toBeInTheDocument();
  });
});
