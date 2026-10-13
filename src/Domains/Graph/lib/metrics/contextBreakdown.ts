import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type {
  TContextBreakdown,
  TContextBucket,
  TContextCategory,
} from '../../Graph.entity';

/** Orden canónico de las categorías antes de ordenar por peso. */
const CATEGORIES: TContextCategory[] = [
  'toolResult',
  'toolInput',
  'reasoning',
  'assistantText',
  'userText',
];

/** Caracteres de una parte de contenido de herramienta (`text` cuenta; `file` no). */
export const toolContentChars = (
  content: readonly { type: string; text?: string }[],
): number =>
  content.reduce(
    (total, entry) =>
      entry.type === 'text' && typeof entry.text === 'string'
        ? total + entry.text.length
        : total,
    0,
  );

/** Longitud serializada del input de una herramienta ya ejecutada. */
const jsonChars = (value: unknown): number => {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
};

/** Caracteres que aporta una parte al desglose (categoría → longitud). */
const partChars = (part: TContentPart): [TContextCategory, number] | null => {
  if (part.type === 'text') return ['assistantText', part.text.length];
  if (part.type === 'reasoning') return ['reasoning', part.text.length];
  if (part.type !== 'tool') return null;

  const { state } = part;
  // En streaming el input llega como texto parcial; una vez ejecutado, como
  // objeto (research R2). El resultado solo existe en `completed`/`error`.
  if (state.status === 'streaming') return ['toolInput', state.input.length];
  return ['toolInput', jsonChars(state.input)];
};

/**
 * Deriva el desglose del contexto de un agente (FR-001..FR-005;
 * `contracts/context-metrics-contract.md` §1). Clasifica el contenido en cinco
 * categorías, reparte los tokens reales de la **ventana del último paso**
 * (research R1/R2) por peso de caracteres y devuelve los buckets ordenados por
 * peso descendente. Los buckets sin contenido se omiten; sin mensajes, el
 * desglose queda vacío (`buckets: []`, `chars: 0`).
 */
export const deriveContextBreakdown = (
  messages: TSessionMessage[],
): TContextBreakdown => {
  const chars: Record<TContextCategory, number> = {
    toolResult: 0,
    toolInput: 0,
    reasoning: 0,
    assistantText: 0,
    userText: 0,
  };
  let windowTokens: number | null = null;

  for (const { info, parts } of messages) {
    if (info.type === 'user') {
      chars.userText += info.text.length;
      continue;
    }
    if (info.type !== 'assistant') continue;

    for (const part of parts) {
      if (part.type === 'tool') {
        const resultChars =
          part.state.status !== 'streaming' &&
          'content' in part.state &&
          part.state.content
            ? toolContentChars(part.state.content)
            : 0;
        chars.toolResult += resultChars;
      }
      const categorized = partChars(part);
      if (categorized) chars[categorized[0]] += categorized[1];
    }

    // El último mensaje assistant con tokens define la ventana del agente.
    if (info.tokens) {
      windowTokens =
        info.tokens.input + info.tokens.cache.read + info.tokens.cache.write;
    }
  }

  const totalChars = CATEGORIES.reduce(
    (total, category) => total + chars[category],
    0,
  );

  const buckets: TContextBucket[] = CATEGORIES.map((category) => ({
    category,
    chars: chars[category],
    tokens:
      windowTokens === null || totalChars === 0
        ? null
        : Math.round((windowTokens * chars[category]) / totalChars),
    pct: totalChars === 0 ? 0 : (chars[category] / totalChars) * 100,
  }))
    .filter((bucket) => bucket.chars > 0)
    .sort((a, b) => b.chars - a.chars);

  return {
    buckets,
    chars: totalChars,
    windowTokens,
    hasTokens: windowTokens !== null,
  };
};
