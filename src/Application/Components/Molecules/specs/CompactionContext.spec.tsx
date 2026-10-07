import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SessionMessageInfo } from '@opencode/client';
import { CompactionContext } from '../CompactionContext';

const userMessage = (id: string, text: string): SessionMessageInfo => ({
  id,
  time: { created: 1 },
  type: 'user',
  text,
});

/** Mensaje sin texto propio: se muestra como "sin contenido" (FR-038). */
const agentSwitched: SessionMessageInfo = {
  id: 'switch',
  time: { created: 2 },
  type: 'agent-switched',
  agent: 'develop',
};

describe('CompactionContext', () => {
  it('shows the error state when the context query fails', () => {
    render(
      <CompactionContext messages={[]} isError isLoading={false} />,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(
      screen.getByText('No se pudo cargar el contexto de la compactación.'),
    ).toBeInTheDocument();
  });

  it('shows the loading state while the context is being fetched', () => {
    render(
      <CompactionContext messages={[]} isError={false} isLoading />,
    );

    expect(screen.queryByTestId('compaction-context')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Sin contexto de compactación.'),
    ).not.toBeInTheDocument();
  });

  it('shows an explicit empty state without messages', () => {
    render(
      <CompactionContext messages={[]} isError={false} isLoading={false} />,
    );

    expect(
      screen.getByText('Sin contexto de compactación.'),
    ).toBeInTheDocument();
  });

  it('renders the resulting context with a readable preview', () => {
    render(
      <CompactionContext
        messages={[userMessage('m1', 'contenido'), agentSwitched]}
        isError={false}
        isLoading={false}
      />,
    );

    expect(screen.getByTestId('compaction-context')).toBeInTheDocument();
    expect(screen.getByText('Contexto resultante')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(screen.getByText('sin contenido')).toBeInTheDocument();
  });
});
