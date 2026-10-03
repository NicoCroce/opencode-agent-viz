import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceList } from '../ResourceList';
import type { TResourceUsage } from '../../Inspector.entity';

const resources: TResourceUsage = {
  mcpServers: [{ name: 'context7', status: 'connected' }],
  instructions: ['.opencode/instructions/app.instructions.md'],
  skills: [],
  tools: ['bash'],
  availability: 'available',
};

describe('ResourceList', () => {
  it('lists resources labelled as available', () => {
    render(<ResourceList resources={resources} />);
    expect(screen.getByText('context7 (connected)')).toBeInTheDocument();
    expect(screen.getAllByText('disponible').length).toBeGreaterThan(0);
  });

  it('shows an explanatory empty state', () => {
    render(
      <ResourceList
        resources={{
          mcpServers: [],
          instructions: [],
          skills: [],
          tools: [],
          availability: 'available',
        }}
      />,
    );
    expect(
      screen.getByText('Sin recursos configurados para este agente.'),
    ).toBeInTheDocument();
  });
});
