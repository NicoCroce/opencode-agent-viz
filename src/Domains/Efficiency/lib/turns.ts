/**
 * Hechos, segmentación de turnos y totales del motor de eficiencia.
 *
 * Fuente: `data-model.md` §2.4/§2.5/§5.1 y `contracts/efficiency-engine-contract.md`
 * §4, §7 y §10 (feature 015).
 *
 * - Una sola pasada por `messagesBySession` construye `TFacts` (raíz + subárbol);
 *   las reglas y el score leen de ahí y no vuelven a recorrer mensajes.
 * - El input humano (`user`) y los cierres (`idle`) solo cuentan en la raíz; los
 *   pasos `assistant` y las herramientas de toda la raíz + subárbol se atribuyen
 *   a un turno por ventana temporal `[user.created, cierre)`.
 * - El turno abierto queda fuera de denominadores (`closed: false`) y su
 *   `durationMs` usa el reloj inyectado (`now`), nunca `Date.now()`.
 * - La entrada no se muta: los arrays de salida se ordenan explícitamente.
 */
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type {
  TEfficiencyInput,
  TEfficiencyTotals,
  TRuleId,
  TTurnAnalysis,
} from '../Efficiency.entity';
import {
  MIN_PROMPT_TOKENS,
  QUESTION_REPEAT_SIMILARITY,
  SIMILARITY_THRESHOLD,
  SLOW_TOOL_MS,
} from './thresholds';
import {
  canonicalToolInput,
  extractFilePath,
  extractQuestionText,
  isWriteTool,
  jaccard,
  similaritySet,
  tokenCount,
  truncateCodePoints,
} from './text';

/** Parte de herramienta dentro del contenido de un assistant. */
type TToolPart = Extract<TContentPart, { type: 'tool' }>;

/** Estado de una parte de herramienta (`streaming` | `running` | …). */
type TToolStatus = TToolPart['state']['status'];

/** Herramientas que originan una pregunta al usuario (R3/R4). */
const QUESTION_TOOL_NAMES: ReadonlySet<string> = new Set(['question', 'form']);

/** Longitud máxima de la salida canónica de una herramienta (R4). */
const MAX_TOOL_OUTPUT = 256;

// ---------------------------------------------------------------------------
// Hechos (§5.1)
// ---------------------------------------------------------------------------

export interface TUserFact {
  sessionId: string;
  messageId: string;
  at: number;
  text: string;
  /** Tokens de palabra del prompt (incluye stopwords). */
  promptTokens: number;
  /** Turno al que pertenece; `null` fuera de todo turno. */
  turnIndex: number | null;
}

export interface TAssistantTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface TAssistantFact {
  sessionId: string;
  messageId: string;
  at: number;
  cost: number | null;
  tokens: TAssistantTokens | null;
  /** `info.error` presente (fallo del propio paso). */
  hasError: boolean;
  toolCalls: number;
  toolErrors: number;
  retry: { attempt: number; at: number } | null;
  turnIndex: number | null;
}

export interface TToolFact {
  sessionId: string;
  messageId: string;
  toolId: string;
  name: string;
  status: TToolStatus;
  /** `time.created` de la parte (criterio de ventana del turno). */
  at: number;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  /** Firma `nombre.toLowerCase() + '\\0' + input canónico`. */
  signature: string;
  /** Texto de `state.content` acotado a 256 code points; `''` si no hay. */
  output: string;
  filePath: string | null;
  isWrite: boolean;
  isQuestion: boolean;
  turnIndex: number | null;
}

export interface TIdleFact {
  sessionId: string;
  messageId: string;
  at: number;
  outcome: 'succeeded' | 'failed' | 'interrupted';
  turnIndex: number | null;
}

export interface TCompactionFact {
  sessionId: string;
  messageId: string;
  at: number;
  reason: 'auto' | 'manual';
  turnIndex: number | null;
}

export interface TRetryFact {
  sessionId: string;
  messageId: string;
  at: number;
  attempt: number;
  turnIndex: number | null;
}

export interface TReformulationPair {
  /** `user` que abrió el primer turno del par. */
  firstUserMessageId: string;
  /** `user` que abrió el segundo turno (evidencia de INP-1). */
  secondUserMessageId: string;
  /** `user.time.created` del segundo turno. */
  at: number;
  similarity: number;
  /** Índice del segundo turno. */
  turnIndex: number;
}

export interface TInterruptionFact {
  sessionId: string;
  /** `idle` interrumpido o `user` que interrumpió. */
  messageId: string;
  at: number;
  kind: 'idle' | 'user';
  turnIndex: number;
}

export interface TQuestionFact {
  sessionId: string;
  messageId: string;
  toolId: string;
  at: number;
  text: string;
  repeated: boolean;
  turnIndex: number | null;
}

export interface TTokenStep {
  messageId: string;
  at: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Hechos internos: única fuente de conteos para reglas y score. */
export interface TFacts {
  /** Solo raíz. */
  users: TUserFact[];
  /** Raíz + subárbol. */
  assistants: TAssistantFact[];
  /** Raíz + subárbol. */
  tools: TToolFact[];
  /** Solo raíz. */
  idles: TIdleFact[];
  /** Raíz + subárbol (solo `completed`). */
  compactions: TCompactionFact[];
  turns: TTurnAnalysis[];
  closedTurns: number;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  openErrors: boolean;
  toolErrors: number;
  retries: TRetryFact[];
  redundantCalls: TToolFact[];
  reformulationPairs: TReformulationPair[];
  eligiblePairs: number;
  interruptions: TInterruptionFact[];
  /** Tools `question`/`form` de la raíz con texto extraíble. */
  questionCalls: TQuestionFact[];
  repeatedQuestions: TQuestionFact[];
  firstWrite: TToolFact | null;
  filesTouched: number;
  /** Duraciones de tools terminadas, ascendentes. */
  toolDurationsMs: number[];
  /** Pasos de la raíz con tokens, en orden cronológico. */
  rootTokenSteps: TTokenStep[];
  windowTokens: number | null;
  /** Sesiones del subárbol sin mensajes cargados, ordenadas. */
  missingSessionIds: string[];
}

// ---------------------------------------------------------------------------
// Helpers de lectura
// ---------------------------------------------------------------------------

const isToolPart = (part: TContentPart): part is TToolPart =>
  part.type === 'tool';

const isQuestionTool = (name: string): boolean =>
  QUESTION_TOOL_NAMES.has(name.toLowerCase());

/** Texto extraíble de `state.content` (completed/error), vacío si no hay. */
const toolOutputText = (tool: TToolPart): string => {
  if (tool.state.status !== 'completed' && tool.state.status !== 'error') {
    return '';
  }
  const content = tool.state.content;
  if (content === undefined) return '';
  return truncateCodePoints(
    content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n'),
    MAX_TOOL_OUTPUT,
  );
};

const readToolFact = (
  sessionId: string,
  messageId: string,
  part: TToolPart,
): TToolFact => {
  const { input } = part.state;
  const canonicalInput = canonicalToolInput(input);
  const startedAt = part.time.ran ?? part.time.created;
  const completedAt = part.time.completed ?? null;
  const filePath = extractFilePath(input);
  return {
    sessionId,
    messageId,
    toolId: part.id,
    name: part.name,
    status: part.state.status,
    at: part.time.created,
    startedAt,
    completedAt,
    durationMs: completedAt === null ? null : completedAt - startedAt,
    signature: `${part.name.toLowerCase()}\u0000${canonicalInput}`,
    output: toolOutputText(part),
    filePath,
    isWrite: isWriteTool(part.name),
    isQuestion: isQuestionTool(part.name),
    turnIndex: null,
  };
};

const readAssistantTokens = (
  message: Extract<TSessionMessage['info'], { type: 'assistant' }>,
): TAssistantTokens | null => {
  const tokens = message.tokens;
  if (tokens === undefined) return null;
  return {
    input: tokens.input,
    output: tokens.output,
    cacheRead: tokens.cache.read,
    cacheWrite: tokens.cache.write,
  };
};

const compareIds = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Orden por instante y, en empate, por id (determinista). */
const byAtAndId = <T extends { at: number }>(
  id: (item: T) => string,
) => (a: T, b: T): number =>
  a.at === b.at ? compareIds(id(a), id(b)) : a.at - b.at;

/** Orden por instante, sesión y id (determinista, subárbol intercalado). */
const byAtSessionAndId = <T extends { at: number; sessionId: string }>(
  id: (item: T) => string,
) => (a: T, b: T): number => {
  if (a.at !== b.at) return a.at - b.at;
  const bySession = compareIds(a.sessionId, b.sessionId);
  return bySession !== 0 ? bySession : compareIds(id(a), id(b));
};

/** Suma de valores reportados; `null` si no se reportó ninguno. */
const sumReported = (values: readonly (number | null)[]): number | null => {
  const reported = values.filter((value): value is number => value !== null);
  return reported.length === 0
    ? null
    : reported.reduce((total, value) => total + value, 0);
};

/**
 * Percentil 95 nearest-rank sobre duraciones (ascendentes o no): sin muestras
 * devuelve `null`; con n muestras toma la posición `ceil(0,95 · n)`.
 */
export const nearestRankP95 = (
  durationsMs: readonly number[],
): number | null => {
  if (durationsMs.length === 0) return null;
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const rank = Math.ceil(sorted.length * 0.95);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index];
};

// ---------------------------------------------------------------------------
// Segmentación de turnos (§5.2, research R3)
// ---------------------------------------------------------------------------

interface TTurnWindow {
  index: number;
  start: number;
  end: number;
}

interface TTurnDraft {
  user: TUserFact;
  /** `null` ⇒ turno abierto. */
  closedBy: 'idle' | 'user' | null;
  closeAt: number | null;
  outcome: TTurnAnalysis['outcome'];
  idleId: string | null;
  interruptionId: string | null;
  /** El turno nació de un `user` que interrumpió al anterior. */
  afterInterruption: boolean;
}

type TRootEvent =
  | { kind: 'user'; fact: TUserFact }
  | { kind: 'idle'; fact: TIdleFact };

const EVENT_RANK = { user: 0, idle: 1 } as const;

/**
 * Segmenta los eventos de la raíz. Devuelve los borradores en orden
 * cronológico de cierre (el abierto, si existe, siempre el último).
 */
const segmentTurns = (
  users: readonly TUserFact[],
  idles: readonly TIdleFact[],
  assistants: readonly TAssistantFact[],
): TTurnDraft[] => {
  const events: TRootEvent[] = [
    ...users.map((fact): TRootEvent => ({ kind: 'user', fact })),
    ...idles.map((fact): TRootEvent => ({ kind: 'idle', fact })),
  ].sort(
    (a, b) =>
      a.fact.at - b.fact.at ||
      EVENT_RANK[a.kind] - EVENT_RANK[b.kind] ||
      compareIds(a.fact.messageId, b.fact.messageId),
  );

  const stepsBetween = (start: number, end: number): number =>
    assistants.filter((step) => step.at >= start && step.at < end).length;

  const drafts: TTurnDraft[] = [];
  let open: TTurnDraft | null = null;

  for (const event of events) {
    if (event.kind === 'user') {
      const afterInterruption: boolean = open !== null;
      if (open !== null) {
        drafts.push({
          ...open,
          closedBy: 'user',
          closeAt: event.fact.at,
          outcome: 'interrupted',
          interruptionId: event.fact.messageId,
        });
      }
      open = {
        user: event.fact,
        closedBy: null,
        closeAt: null,
        outcome: null,
        idleId: null,
        interruptionId: null,
        afterInterruption,
      };
      continue;
    }

    if (open === null) continue;

    // `idle` sin pasos del turno actual: cancelación del turno anterior cuando
    // el turno nació de una interrupción; si no, cierra el turno vacío.
    if (stepsBetween(open.user.at, event.fact.at) === 0 && open.afterInterruption) {
      continue;
    }

    drafts.push({
      ...open,
      closedBy: 'idle',
      closeAt: event.fact.at,
      outcome: event.fact.outcome,
      idleId: event.fact.messageId,
    });
    open = null;
  }

  if (open !== null) drafts.push(open);
  return drafts;
};

const buildTurnAnalysis = (
  drafts: readonly TTurnDraft[],
  assistants: readonly TAssistantFact[],
  tools: readonly TToolFact[],
  rootSessionId: string,
  now: number | undefined,
): TTurnAnalysis[] =>
  drafts.map((draft, position) => {
    const end = draft.closeAt ?? Number.POSITIVE_INFINITY;
    const steps = assistants.filter(
      (step) => step.at >= draft.user.at && step.at < end,
    );
    const windowTools = tools.filter(
      (tool) => tool.at >= draft.user.at && tool.at < end,
    );
    const costs = sumReported(steps.map((step) => step.cost));
    return {
      index: position + 1,
      userMessageId: draft.user.messageId,
      at: draft.user.at,
      prompt: draft.user.text,
      promptTokens: draft.user.promptTokens,
      closed: draft.closedBy !== null,
      outcome: draft.closedBy === null ? null : draft.outcome,
      clarifications: windowTools.filter(
        (tool) => tool.sessionId === rootSessionId && tool.isQuestion,
      ).length,
      steps: steps.length,
      toolCalls: windowTools.length,
      toolErrors: windowTools.filter((tool) => tool.status === 'error').length,
      retries: steps.filter((step) => step.retry !== null).length,
      cost: costs,
      durationMs:
        draft.closedBy === null
          ? now === undefined
            ? null
            : now - draft.user.at
          : (draft.closeAt as number) - draft.user.at,
      signals: [] as TRuleId[],
    };
  });

const turnWindows = (drafts: readonly TTurnDraft[]): TTurnWindow[] =>
  drafts.map((draft, position) => ({
    index: position + 1,
    start: draft.user.at,
    end: draft.closeAt ?? Number.POSITIVE_INFINITY,
  }));

const indexAt = (windows: readonly TTurnWindow[], at: number): number | null => {
  for (const window of windows) {
    if (at >= window.start && at < window.end) return window.index;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

/**
 * Construye todos los hechos del motor en una pasada por los mensajes cargados.
 * No lee el reloj: `now` (si existe) solo alimenta la duración del turno abierto.
 */
export const buildFacts = (input: TEfficiencyInput): TFacts => {
  const { rootSessionId, messagesBySession, sessions, now } = input;

  const users: TUserFact[] = [];
  const assistants: TAssistantFact[] = [];
  const tools: TToolFact[] = [];
  const idles: TIdleFact[] = [];
  const compactions: TCompactionFact[] = [];
  const retries: TRetryFact[] = [];
  const questionCalls: TQuestionFact[] = [];

  for (const sessionId of Object.keys(messagesBySession).sort()) {
    const messages = messagesBySession[sessionId] ?? [];
    const isRoot = sessionId === rootSessionId;

    for (const message of messages) {
      const { info, parts } = message;
      const created = info.time?.created;
      if (typeof created !== 'number' || !Number.isFinite(created)) continue;

      if (info.type === 'user') {
        if (!isRoot) continue;
        users.push({
          sessionId,
          messageId: info.id,
          at: created,
          text: info.text,
          promptTokens: tokenCount(info.text),
          turnIndex: null,
        });
        continue;
      }

      if (info.type === 'assistant') {
        const toolParts = parts.filter(isToolPart);
        const toolFacts = toolParts.map((part) =>
          readToolFact(sessionId, info.id, part),
        );
        const toolErrors = toolFacts.filter(
          (tool) => tool.status === 'error',
        ).length;
        tools.push(...toolFacts);

        assistants.push({
          sessionId,
          messageId: info.id,
          at: created,
          cost: info.cost ?? null,
          tokens: readAssistantTokens(info),
          hasError: info.error !== undefined,
          toolCalls: toolFacts.length,
          toolErrors,
          retry:
            info.retry === undefined
              ? null
              : { attempt: info.retry.attempt, at: info.retry.at },
          turnIndex: null,
        });

        if (info.retry !== undefined) {
          retries.push({
            sessionId,
            messageId: info.id,
            at: created,
            attempt: info.retry.attempt,
            turnIndex: null,
          });
        }

        for (const [position, part] of toolParts.entries()) {
          const tool = toolFacts[position];
          if (!isRoot || !tool.isQuestion) continue;
          const text = extractQuestionText(part.state.input);
          if (text.length === 0) continue;
          questionCalls.push({
            sessionId,
            messageId: info.id,
            toolId: tool.toolId,
            at: tool.at,
            text,
            repeated: false,
            turnIndex: null,
          });
        }
        continue;
      }

      if (info.type === 'idle') {
        if (!isRoot) continue;
        idles.push({
          sessionId,
          messageId: info.id,
          at: created,
          outcome: info.outcome,
          turnIndex: null,
        });
        continue;
      }

      if (info.type === 'compaction' && info.status === 'completed') {
        compactions.push({
          sessionId,
          messageId: info.id,
          at: created,
          reason: info.reason,
          turnIndex: null,
        });
      }
    }
  }

  users.sort(byAtAndId((user) => user.messageId));
  assistants.sort(byAtSessionAndId((step) => step.messageId));
  tools.sort(
    byAtSessionAndId((tool) => `${tool.toolId}\u0000${tool.messageId}`),
  );
  idles.sort(byAtAndId((idle) => idle.messageId));
  compactions.sort(byAtSessionAndId((compaction) => compaction.messageId));
  retries.sort(byAtSessionAndId((retry) => retry.messageId));

  const drafts = segmentTurns(users, idles, assistants);
  const turns = buildTurnAnalysis(
    drafts,
    assistants,
    tools,
    rootSessionId,
    now,
  );
  const windows = turnWindows(drafts);

  // Atribución del índice de turno (ventanas `[at, cierre)`; el abierto no cierra).
  users.forEach((user) => {
    user.turnIndex = indexAt(windows, user.at);
  });
  assistants.forEach((step) => {
    step.turnIndex = indexAt(windows, step.at);
  });
  tools.forEach((tool) => {
    tool.turnIndex = indexAt(windows, tool.at);
  });
  compactions.forEach((compaction) => {
    compaction.turnIndex = indexAt(windows, compaction.at);
  });
  retries.forEach((retry) => {
    retry.turnIndex = indexAt(windows, retry.at);
  });

  const idleTurn = new Map<string, number>();
  drafts.forEach((draft, position) => {
    if (draft.idleId !== null) idleTurn.set(draft.idleId, position + 1);
  });
  idles.forEach((idle) => {
    idle.turnIndex = idleTurn.get(idle.messageId) ?? null;
  });

  questionCalls.sort(
    byAtSessionAndId((question) => `${question.toolId}\u0000${question.messageId}`),
  );
  questionCalls.forEach((question) => {
    question.turnIndex = indexAt(windows, question.at);
  });

  // INP-3: una pregunta es repetida si su Jaccard con alguna anterior es ≥ 0,7.
  const repeatedQuestions: TQuestionFact[] = [];
  questionCalls.forEach((question, position) => {
    const set = similaritySet(question.text);
    const repeated = questionCalls
      .slice(0, position)
      .some(
        (previous) =>
          jaccard(similaritySet(previous.text), set) >=
          QUESTION_REPEAT_SIMILARITY,
      );
    question.repeated = repeated;
    if (repeated) repeatedQuestions.push(question);
  });

  // INP-1: pares consecutivos elegibles y, entre ellos, los similares.
  const draftByUser = new Map(
    drafts.map((draft, position) => [draft.user.messageId, { draft, position }]),
  );
  const reformulationPairs: TReformulationPair[] = [];
  let eligiblePairs = 0;
  for (let position = 0; position + 1 < turns.length; position += 1) {
    const first = turns[position];
    const second = turns[position + 1];
    const firstDraft = draftByUser.get(first.userMessageId)?.draft;
    if (firstDraft === undefined || firstDraft.closedBy !== 'idle') continue;
    if (
      first.promptTokens < MIN_PROMPT_TOKENS ||
      second.promptTokens < MIN_PROMPT_TOKENS
    ) {
      continue;
    }
    const writeBetween = tools.some(
      (tool) =>
        tool.isWrite && tool.at >= first.at && tool.at < second.at,
    );
    if (writeBetween) continue;

    eligiblePairs += 1;
    const similarity = jaccard(
      similaritySet(first.prompt),
      similaritySet(second.prompt),
    );
    if (similarity >= SIMILARITY_THRESHOLD) {
      reformulationPairs.push({
        firstUserMessageId: first.userMessageId,
        secondUserMessageId: second.userMessageId,
        at: second.at,
        similarity,
        turnIndex: second.index,
      });
    }
  }

  // Interrupciones (una como máximo por turno).
  const interruptions: TInterruptionFact[] = [];
  drafts.forEach((draft, position) => {
    const turnIndex = position + 1;
    if (draft.closedBy === 'user' && draft.interruptionId !== null) {
      interruptions.push({
        sessionId: rootSessionId,
        messageId: draft.interruptionId,
        at: draft.closeAt as number,
        kind: 'user',
        turnIndex,
      });
    } else if (
      draft.closedBy === 'idle' &&
      draft.outcome === 'interrupted' &&
      draft.idleId !== null
    ) {
      interruptions.push({
        sessionId: rootSessionId,
        messageId: draft.idleId,
        at: draft.closeAt as number,
        kind: 'idle',
        turnIndex,
      });
    }
  });

  // RES-3: misma firma ≥3 veces, o ≥2 llamadas con la misma salida no vacía.
  const signatureCounts = new Map<string, number>();
  for (const tool of tools) {
    signatureCounts.set(
      tool.signature,
      (signatureCounts.get(tool.signature) ?? 0) + 1,
    );
  }
  const seenBySignature = new Map<string, number>();
  const outputsBySignature = new Map<string, Set<string>>();
  const redundantCalls: TToolFact[] = [];
  for (const tool of tools) {
    const occurrences = (seenBySignature.get(tool.signature) ?? 0) + 1;
    seenBySignature.set(tool.signature, occurrences);
    const outputs = outputsBySignature.get(tool.signature) ?? new Set<string>();
    outputsBySignature.set(tool.signature, outputs);

    const repeatedSignature = (signatureCounts.get(tool.signature) ?? 0) >= 3;
    const duplicateOutput =
      tool.output.length > 0 && outputs.has(tool.output);
    if ((occurrences > 1 && repeatedSignature) || duplicateOutput) {
      redundantCalls.push(tool);
    }
    if (tool.output.length > 0) outputs.add(tool.output);
  }

  const toolDurationsMs = tools
    .map((tool) => tool.durationMs)
    .filter((duration): duration is number => duration !== null)
    .sort((a, b) => a - b);

  const rootTokenSteps: TTokenStep[] = assistants
    .filter((step) => step.sessionId === rootSessionId && step.tokens !== null)
    .map((step) => ({
      messageId: step.messageId,
      at: step.at,
      input: (step.tokens as TAssistantTokens).input,
      output: (step.tokens as TAssistantTokens).output,
      cacheRead: (step.tokens as TAssistantTokens).cacheRead,
      cacheWrite: (step.tokens as TAssistantTokens).cacheWrite,
    }));
  const lastTokenStep = rootTokenSteps[rootTokenSteps.length - 1];
  const windowTokens =
    lastTokenStep === undefined
      ? null
      : lastTokenStep.input + lastTokenStep.cacheRead + lastTokenStep.cacheWrite;

  const firstWrite = tools.find((tool) => tool.isWrite) ?? null;
  const touchedFiles = new Set(
    tools
      .filter((tool) => tool.isWrite)
      .map((tool) => tool.filePath)
      .filter((path): path is string => path !== null),
  );

  const outcome = idles[idles.length - 1]?.outcome ?? null;
  const rootAssistants = assistants.filter(
    (step) => step.sessionId === rootSessionId,
  );
  const lastRootAssistant = rootAssistants[rootAssistants.length - 1];
  const openErrors =
    outcome === 'failed' ||
    (lastRootAssistant !== undefined &&
      (lastRootAssistant.hasError || lastRootAssistant.toolErrors > 0));

  const missingSessionIds = Object.keys(sessions)
    .filter(
      (sessionId) =>
        sessionId !== rootSessionId && messagesBySession[sessionId] === undefined,
    )
    .sort(compareIds);

  return {
    users,
    assistants,
    tools,
    idles,
    compactions,
    turns,
    closedTurns: turns.filter((turn) => turn.closed).length,
    outcome,
    openErrors,
    toolErrors: tools.filter((tool) => tool.status === 'error').length,
    retries,
    redundantCalls,
    reformulationPairs,
    eligiblePairs,
    interruptions,
    questionCalls,
    repeatedQuestions,
    firstWrite,
    filesTouched: touchedFiles.size,
    toolDurationsMs,
    rootTokenSteps,
    windowTokens,
    missingSessionIds,
  };
};

// ---------------------------------------------------------------------------
// Totales (engine §7)
// ---------------------------------------------------------------------------

/**
 * Totales derivados de `TFacts`: token/coste solo de pasos assistant (nunca de
 * compactación), `null` cuando el proveedor no reportó el dato y `0` real en los
 * conteos. `windowTokens` se mide en la raíz.
 */
export const buildTotals = (facts: TFacts): TEfficiencyTotals => ({
  cost: sumReported(facts.assistants.map((step) => step.cost)),
  tokensIn: sumReported(
    facts.assistants.map((step) => step.tokens?.input ?? null),
  ),
  tokensOut: sumReported(
    facts.assistants.map((step) => step.tokens?.output ?? null),
  ),
  cacheRead: sumReported(
    facts.assistants.map((step) => step.tokens?.cacheRead ?? null),
  ),
  cacheWrite: sumReported(
    facts.assistants.map((step) => step.tokens?.cacheWrite ?? null),
  ),
  windowTokens: facts.windowTokens,
  latencyP95Ms: nearestRankP95(facts.toolDurationsMs),
  slowToolCalls: facts.toolDurationsMs.filter(
    (duration) => duration > SLOW_TOOL_MS,
  ).length,
  compactions: facts.compactions.length,
  retries: facts.retries.length,
  toolErrors: facts.toolErrors,
  toolCalls: facts.tools.length,
});
