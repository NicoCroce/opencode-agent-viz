import type {
  SessionMessageAssistantTool,
  SessionMessageCompaction,
  SessionMessageShell,
  SessionMessageUser,
  ToolContent,
} from '@opencode/client';
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type {
  THistoryAttachment,
  THistoryEntry,
  THistoryQuestion,
  THistoryQuestionEntry,
  THistoryToolEntry,
  TToolEntry,
} from '../History.entity';

/** Nombres de herramienta que originan una pregunta al usuario (R8). */
const QUESTION_TOOL_NAMES: ReadonlySet<string> = new Set(['question', 'form']);

/** Opciones de `buildHistory`: preguntas al usuario a incorporar (FR-033). */
export interface BuildHistoryOptions {
  /**
   * Formularios/preguntas de la sesión, en el orden reportado por el servidor.
   * Estructuralmente compatibles con `TQuestionEntry` (Inspector).
   */
  questions?: THistoryQuestion[];
}

/**
 * Proyecta los mensajes normalizados del SDK (`TSessionMessage`) en entradas de
 * histórico ordenables cronológicamente (`THistoryEntry`, FR-009).
 *
 * Función pura: no muta la entrada, no depende del SDK en runtime (solo de sus
 * tipos) y es determinista. El `id` de cada entrada es estable: id del mensaje
 * + ordinal de la parte (`assistant`) o `:0` para el resto.
 *
 * Con `options.questions` incorpora las preguntas al usuario en su posición
 * cronológica anclándolas a su tool call (`mergeQuestions`, FR-033).
 */
export function buildHistory(
  messages: TSessionMessage[],
  options: BuildHistoryOptions = {},
): THistoryEntry[] {
  // Copia ordenada por `info.time.created` ascendente (FR-009). El sort es
  // estable, así que los mensajes con el mismo instante conservan su orden.
  const ordered = [...messages].sort(
    (a, b) => a.info.time.created - b.info.time.created,
  );
  const entries = ordered.flatMap(toMessageEntries);
  const questions = options.questions ?? [];
  if (questions.length === 0) return entries;
  return mergeQuestions(entries, questions);
}

/** Convierte un mensaje normalizado en una o más entradas del histórico. */
function toMessageEntries(message: TSessionMessage): THistoryEntry[] {
  const { info } = message;
  const at = info.time.created;
  const id = `${info.id}:0`;

  switch (info.type) {
    case 'assistant':
      return toAssistantEntries(info, message.parts, at);
    case 'user':
      return [
        {
          id,
          at,
          kind: 'user',
          text: info.text,
          attachments: toAttachments(info),
        },
      ];
    case 'agent-switched':
      return [
        {
          id,
          at,
          kind: 'agent-switched',
          agent: info.agent,
          previous: info.previous ?? null,
        },
      ];
    case 'model-switched':
      return [
        {
          id,
          at,
          kind: 'model-switched',
          model: info.model,
          previous: info.previous ?? null,
        },
      ];
    case 'location-switched':
      return [
        {
          id,
          at,
          kind: 'location-switched',
          directory: info.location.directory,
        },
      ];
    case 'system':
      return [
        {
          id,
          at,
          kind: 'system',
          text: info.text,
          description: info.description ?? null,
        },
      ];
    case 'synthetic':
      return [
        {
          id,
          at,
          kind: 'synthetic',
          text: info.text,
          description: info.description ?? null,
        },
      ];
    case 'skill':
      return [
        {
          id,
          at,
          kind: 'skill',
          skill: info.skill,
          name: info.name,
          text: info.text,
        },
      ];
    case 'shell':
      return [
        {
          id,
          at,
          kind: 'shell',
          command: info.command,
          status: info.status,
          exit: toExit(info.exit),
        },
      ];
    case 'compaction':
      return [
        {
          id,
          at,
          kind: 'compaction',
          status: info.status,
          reason: info.reason,
          summary: toCompactionSummary(info),
        },
      ];
    case 'idle':
      return [{ id, at, kind: 'idle', outcome: info.outcome }];
  }
}

/**
 * Intercala las partes del assistant en su orden de producción (FR-003). Un
 * assistant sin `time.completed` marca sus respuestas/razonamiento como "en
 * curso" y nunca se presenta texto parcial como completo (FR-005/006).
 */
function toAssistantEntries(
  info: Extract<TSessionMessage['info'], { type: 'assistant' }>,
  parts: TContentPart[],
  at: number,
): THistoryEntry[] {
  const isComplete = info.time.completed != null;
  return parts.map((part, index) => {
    const id = `${info.id}:${index}`;
    switch (part.type) {
      case 'text':
        return {
          id,
          at,
          kind: 'answer' as const,
          text: part.text,
          isComplete,
        };
      case 'reasoning':
        return {
          id,
          at,
          kind: 'reasoning' as const,
          text: part.text,
          isComplete,
        };
      case 'tool':
        return {
          id,
          at,
          kind: 'tool' as const,
          entry: toToolEntry(part),
        };
    }
  });
}

/** Adjuntos de un prompt de usuario, normalizados por tipo y nombre (FR-007). */
function toAttachments(info: SessionMessageUser): THistoryAttachment[] {
  const attachments: THistoryAttachment[] = [];
  for (const file of info.files ?? []) {
    attachments.push({ kind: 'file', name: file.name ?? null });
  }
  for (const agent of info.agents ?? []) {
    attachments.push({ kind: 'agent', name: agent.name ?? null });
  }
  for (const skill of info.skills ?? []) {
    attachments.push({ kind: 'skill', name: skill.name ?? null });
  }
  return attachments;
}

/**
 * Refleja el estado real de una llamada a herramienta; nunca inventa un
 * resultado cuando todavía no terminó (FR-004/FR-011).
 */
function toToolEntry(part: SessionMessageAssistantTool): TToolEntry {
  const { state, time } = part;
  const startedAt = time.created;
  const completedAt = time.completed ?? null;
  const durationMs = completedAt !== null ? completedAt - startedAt : null;

  let result: string | null = null;
  let error: string | null = null;
  if (state.status === 'completed') {
    result = toolContentToText(state.content);
  } else if (state.status === 'error') {
    error = state.error.message;
    if (state.content) {
      result = toolContentToText(state.content);
    }
  }

  return {
    id: part.id,
    name: part.name,
    status: state.status,
    input: state.input,
    result,
    error,
    startedAt,
    completedAt,
    durationMs,
  };
}

/** Serializa el contenido de un resultado de herramienta a texto plano. */
function toolContentToText(content: readonly ToolContent[]): string {
  return content
    .map((item) => (item.type === 'text' ? item.text : item.name ?? item.uri))
    .join('\n');
}

/** `exit` del SDK puede venir como sentinel no numérico; se normaliza a `null`. */
function toExit(exit: SessionMessageShell['exit']): number | null {
  return typeof exit === 'number' ? exit : null;
}

/** Una compactación `failed` no trae `summary`; nunca se presenta como exitosa. */
function toCompactionSummary(info: SessionMessageCompaction): string | null {
  return 'summary' in info ? info.summary : null;
}

/* ------------------------------------------------------------------ */
/* Preguntas al usuario (FR-033)                                       */
/* ------------------------------------------------------------------ */

/** Ancla disponible para una pregunta: el tool call que la originó. */
interface TQuestionAnchor {
  id: string;
  at: number;
  /** Títulos candidatos del input del tool call, para emparejar por contenido. */
  titles: string[];
}

/** ¿Es una entrada de tool que pudo originar una pregunta? */
const isQuestionTool = (entry: THistoryEntry): entry is THistoryToolEntry =>
  entry.kind === 'tool' && QUESTION_TOOL_NAMES.has(entry.entry.name);

/**
 * Títulos candidatos que el input de un tool de pregunta puede exponer: `title`
 * (form) o `question`/`header`/`prompt` (question), incluso anidados dentro de
 * `questions[]`. Permite emparejar el formulario con su tool call por contenido.
 */
const candidateTitles = (input: unknown): string[] => {
  const titles: string[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (depth > 4 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        (key === 'title' ||
          key === 'question' ||
          key === 'header' ||
          key === 'prompt') &&
        typeof child === 'string' &&
        child.length > 0
      ) {
        titles.push(child);
      }
      visit(child, depth + 1);
    }
  };
  visit(input, 0);
  return titles;
};

/**
 * Elige el ancla de una pregunta: primero por coincidencia de título con el
 * input del tool call y, si no la hay, el primer ancla libre en orden
 * cronológico. `null` si no queda ninguna disponible.
 */
const pickAnchor = (
  anchors: TQuestionAnchor[],
  used: ReadonlySet<string>,
  question: THistoryQuestion,
): TQuestionAnchor | null => {
  const available = anchors.filter((anchor) => !used.has(anchor.id));
  if (available.length === 0) return null;
  return (
    available.find((anchor) => anchor.titles.includes(question.title)) ??
    available[0]
  );
};

const toQuestionEntry = (
  question: THistoryQuestion,
  at: number,
  anchorId: string | null,
): THistoryQuestionEntry => ({
  id: `question:${question.id}`,
  at,
  kind: 'question',
  formId: question.id,
  title: question.title,
  fields: question.fields,
  state: question.state,
  answer: question.answer,
  anchorId,
  anchored: anchorId !== null,
});

/**
 * Incorpora las preguntas al histórico en su posición cronológica (FR-033).
 *
 * `FormInfo`/`FormDetail` no exponen tiempo, así que la pregunta se ancla a la
 * **llamada a herramienta** que la originó (tool `question`/`form`, R8): la
 * entrada de tool se sustituye por la entrada `question` estructurada en la
 * misma posición, de modo que la pregunta aparece junto a su respuesta sin
 * inventar un timestamp. Emparejado: por título del input y, si no coincide, por
 * orden. **Fallback** (documentado): si no queda ninguna ancla disponible (el
 * tool call no está en la página cargada o no se llama `question`/`form`), la
 * pregunta se añade al final del histórico con `anchored: false`.
 */
const mergeQuestions = (
  entries: THistoryEntry[],
  questions: THistoryQuestion[],
): THistoryEntry[] => {
  const anchors: TQuestionAnchor[] = entries
    .filter(isQuestionTool)
    .map((entry) => ({
      id: entry.entry.id,
      at: entry.at,
      titles: candidateTitles(entry.entry.input),
    }));

  const used = new Set<string>();
  const anchoredQuestions: THistoryQuestionEntry[] = [];
  const fallbackQuestions: THistoryQuestionEntry[] = [];

  for (const question of questions) {
    const anchor = pickAnchor(anchors, used, question);
    if (anchor) {
      used.add(anchor.id);
      anchoredQuestions.push(toQuestionEntry(question, anchor.at, anchor.id));
    } else {
      fallbackQuestions.push(toQuestionEntry(question, 0, null));
    }
  }

  // El tool call ancla se sustituye por la pregunta estructurada (sin duplicar).
  const withoutAnchors = entries.filter(
    (entry) => !(entry.kind === 'tool' && used.has(entry.entry.id)),
  );
  const merged = [...withoutAnchors, ...anchoredQuestions].sort(
    (a, b) => a.at - b.at,
  );
  if (fallbackQuestions.length === 0) return merged;

  const lastAt = merged.length > 0 ? merged[merged.length - 1].at : 0;
  return [
    ...merged,
    ...fallbackQuestions.map((entry, index) => ({
      ...entry,
      at: lastAt + index + 1,
    })),
  ];
};
