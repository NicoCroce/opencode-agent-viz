import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichText } from '../RichText';

describe('RichText', () => {
  it('renders markdown lists as list items', () => {
    render(<RichText text={'- uno\n- dos'} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('uno');
    expect(items[1]).toHaveTextContent('dos');
  });

  it('renders fenced code blocks preserving their content', () => {
    render(<RichText text={'```ts\nconst x = 1;\n```'} />);

    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    render(<RichText text={'Ejecuta `pnpm test` antes de continuar'} />);

    expect(screen.getByText('pnpm test')).toBeInTheDocument();
  });

  it('renders GFM tables with headers and cells', () => {
    render(<RichText text={'| Herramienta | Estado |\n| --- | --- |\n| build | ok |'} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Herramienta' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'build' })).toBeInTheDocument();
  });

  it('renders emphasis as strong and em elements', () => {
    render(<RichText text={'**fuerte** y _suave_'} />);

    expect(screen.getByText('fuerte').tagName).toBe('STRONG');
    expect(screen.getByText('suave').tagName).toBe('EM');
  });

  it('shows raw HTML as inert text and never mounts a script element', () => {
    const { container } = render(
      <RichText text={'<script>window.__pwned = true</script>\n\nHola'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(screen.getByText('Hola')).toBeInTheDocument();
  });

  it('does not keep javascript: URLs on links', () => {
    const { container } = render(<RichText text={'[click](javascript:alert(1))'} />);

    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
  });

  it('applies the reasoning variant style without altering the content', () => {
    const { container } = render(<RichText text="pensando en voz alta" variant="reasoning" />);

    expect(screen.getByText('pensando en voz alta')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('text-muted-foreground');
  });
});
