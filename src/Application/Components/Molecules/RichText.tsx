import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@app/Application/lib/utils';

type TRichTextVariant = 'answer' | 'reasoning';

interface RichTextProps {
  text: string;
  variant?: TRichTextVariant;
  className?: string;
}

const components: Components = {
  p: ({ node: _node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
  strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node: _node, ...props }) => <em className="italic" {...props} />,
  del: ({ node: _node, ...props }) => <del className="line-through opacity-70" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 italic" {...props} />
  ),
  h1: ({ node: _node, ...props }) => (
    <h1 className="mb-2 mt-4 text-base font-semibold" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="mb-2 mt-4 text-sm font-semibold" {...props} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold" {...props} />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="mb-1 mt-3 text-sm font-medium" {...props} />
  ),
  hr: ({ node: _node, ...props }) => <hr className="my-3 border-border" {...props} />,
  pre: ({ node: _node, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-flat border border-border bg-surface-0 p-3 font-mono text-xs leading-5 [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  code: ({ node: _node, className: codeClassName, ...props }) => (
    <code
      className={cn('rounded-flat bg-muted px-1 py-0.5 font-mono text-xs', codeClassName)}
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse border border-border text-xs" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => <thead className="bg-surface-0" {...props} />,
  th: ({ node: _node, ...props }) => (
    <th className="border border-border px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => <td className="border border-border px-2 py-1" {...props} />,
};

export const RichText = ({ text, variant = 'answer', className }: RichTextProps) => (
  <div
    className={cn(
      'font-sans text-sm leading-6',
      variant === 'reasoning' ? 'text-muted-foreground' : 'text-foreground',
      className,
    )}
  >
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
      {text}
    </Markdown>
  </div>
);
