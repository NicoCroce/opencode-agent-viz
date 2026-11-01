/**
 * Catálogo de hallazgos y señales débiles del motor de eficiencia (engine §6,
 * research R6).
 *
 * Fuente: `contracts/efficiency-engine-contract.md` §6, `research.md` R6 y
 * `spec.md` (catálogo de hallazgos) de la feature 015.
 *
 * - Cada regla emite **como máximo una vez**: agrega el conteo y elige la
 *   evidencia más representativa. Sin `messageId` no hay hallazgo (FR-024).
 * - `quote` sigue el formato `[turno N · msg_… · tool … · hh:mm] "texto"` con
 *   `formatClock`; `condition` es la medida neutral y `recommendation` es
 *   específica de la condición.
 * - El orden es determinista: `penalizes` → severidad → peso de dimensión →
 *   `turnIndex` → `ruleId`. `findings` y `weakSignals` se cortan a 10.
 *
 * Módulo puro: sin React, SDK, reloj ni azar. Todo sale de `TFacts`.
 */
import { formatClock } from '@app/Application/Helpers/format/clock';
import type {
  TDimensionKey,
  TEvidence,
  TFinding,
  TRuleId,
  TSeverity,
  TTurnAnalysis,
} from '../Efficiency.entity';
import { normalizeText } from './text';
import {
  DIMENSION_WEIGHTS,
  MAX_FINDINGS,
  MAX_WEAK_SIGNALS,
  RETRY_ALERT_THRESHOLD,
  SLOW_TOOL_MIN_CALLS,
  SLOW_TOOL_MS,
} from './thresholds';
import {
  nearestRankP95,
  type TFacts,
  type TRetryFact,
  type TToolFact,
} from './turns';

/** Catálogo emitido, ya ordenado y capado. */
export interface TRuleCatalog {
  findings: TFinding[];
  weakSignals: TFinding[];
}

/** Recomendación accionable y específica de cada regla (FR-028). */
export const RULE_RECOMMENDATION: Record<TRuleId, string> = {
  'INP-1':
    'Agrupa los pedidos en un solo mensaje con el alcance y el criterio de aceptación antes de enviarlo.',
  'INP-2':
    'Deja que el turno termine con su cierre antes de enviar el siguiente pedido; si hace falta, cancélalo de forma explícita.',
  'INP-3':
    'Incluye en el primer pedido las aclaraciones que suelen repetirse (archivos, alcance y límites) para evitar preguntas posteriores.',
  'INP-4':
    'Define las restricciones (qué no tocar y qué usar) en el pedido inicial, antes de la primera escritura.',
  'RES-1':
    'Revisa el input de la herramienta que falló y añade la validación o el permiso que falta antes de reintentar.',
  'RES-2':
    'Reduce los reintentos: corrige la causa del error o cambia de estrategia tras el primer fallo.',
  'RES-3':
    'Reutiliza el resultado de la primera llamada y evita repetir la misma firma o salida dentro del turno.',
  'RES-4':
    'Divide el trabajo en sesiones más cortas o resume los hallazgos antes de que el contexto se compacte.',
  'RES-5':
    'Cierra o reanuda el trabajo pendiente para que el coste invertido tenga un resultado verificable.',
  'RES-6':
    'Acota el alcance de las herramientas lentas (rutas, patrones o timeouts) para que terminen antes.',
};

/** Marcadores de restricción de INP-4 sobre texto normalizado (sin acentos). */
const CONSTRAINT_MARKERS = /\b(?:no|sin|solo|debe|must|only)\b/;

/** Pesos usados solo para ordenar; una dimensión `null` pesa 0. */
const dimensionWeight = (dimension: TDimensionKey | null): number =>
  dimension === null ? 0 : DIMENSION_WEIGHTS[dimension];

const SEVERITY_RANK: Record<TSeverity, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

/** Comparación lexicográfica estable de identificadores. */
const compareIds = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Número con coma decimal (copy en español, determinista). */
const formatNumber = (value: number, decimals = 2): string =>
  value.toFixed(decimals).replace('.', ',');

const formatPercent = (ratio: number): string =>
  `${formatNumber(ratio * 100, 1)} %`;

const formatSeconds = (ms: number): string =>
  `${formatNumber(ms / 1_000, 1)} s`;

const outcomeLabel = (
  outcome: 'succeeded' | 'failed' | 'interrupted',
): string => {
  if (outcome === 'succeeded') return 'correcto';
  return outcome === 'failed' ? 'fallido' : 'interrumpido';
};

/** Una cita sin ancla no se emite: `messageId` debe ser no vacío (FR-024). */
const makeFinding = (finding: TFinding): TFinding | null => {
  const messageId = finding.evidence.messageId;
  if (messageId === undefined || messageId.length === 0) return null;
  return finding;
};

interface TQuoteInput {
  evidence: TEvidence;
  text: string;
  toolName?: string;
}

/**
 * Cita con ancla: `[turno N · msg_… · tool … · hh:mm] "texto"`. Los segmentos
 * de herramienta y turno se omiten cuando el hecho no los tiene.
 */
const buildQuote = ({ evidence, text, toolName }: TQuoteInput): string => {
  const segments: string[] = [];
  if (evidence.turnIndex !== undefined && evidence.turnIndex !== null) {
    segments.push(`turno ${evidence.turnIndex}`);
  }
  segments.push(evidence.messageId ?? 'msg —');
  if (evidence.toolId !== undefined) {
    segments.push(`tool ${toolName ?? evidence.toolId}`);
  }
  segments.push(
    evidence.at === undefined ? '--:--' : formatClock(evidence.at),
  );
  return `[${segments.join(' · ')}] "${text}"`;
};

const toolNameOf = (facts: TFacts, toolId: string): string | undefined =>
  facts.tools.find((tool) => tool.toolId === toolId)?.name;

/**
 * Fin de la ventana de un turno: el cierre real (contract §4.1/§4.5) o el
 * `user` siguiente, el que llegue antes. Un turno sin cierre conocido termina
 * en `Infinity`; lo posterior al último cierre queda fuera de todo turno.
 */
const turnEndAt = (
  turns: readonly TTurnAnalysis[],
  position: number,
  turn: TTurnAnalysis,
): number => {
  const nextStart = turns[position + 1]?.at ?? Number.POSITIVE_INFINITY;
  const closeAt =
    turn.closed && turn.durationMs !== null
      ? turn.at + turn.durationMs
      : Number.POSITIVE_INFINITY;
  return Math.min(nextStart, closeAt);
};

/** Turno cuya ventana `[at, cierre)` contiene el instante (o `null`). */
const turnIndexAt = (
  turns: readonly TTurnAnalysis[],
  at: number | undefined,
): number | null => {
  if (at === undefined) return null;
  for (const [position, turn] of turns.entries()) {
    const end = turnEndAt(turns, position, turn);
    if (at >= turn.at && at < end) return turn.index;
  }
  return null;
};

const toolQuoteText = (tool: TToolFact): string =>
  tool.output.length > 0
    ? tool.output
    : `La herramienta ${tool.name} terminó con error`;

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

/** INP-1: pares consecutivos similares, sin escritura intermedia. */
const evaluateInp1 = (facts: TFacts): TFinding | null => {
  const pairs = facts.reformulationPairs;
  if (pairs.length === 0) return null;

  const best = pairs.reduce((current, pair) => {
    if (pair.similarity !== current.similarity) {
      return pair.similarity > current.similarity ? pair : current;
    }
    return pair.turnIndex < current.turnIndex ? pair : current;
  });
  const user = facts.users.find(
    (candidate) => candidate.messageId === best.secondUserMessageId,
  );
  if (user === undefined) return null;

  const evidence: TEvidence = {
    sessionId: user.sessionId,
    messageId: user.messageId,
    at: user.at,
    turnIndex: best.turnIndex,
  };
  return makeFinding({
    ruleId: 'INP-1',
    severity: pairs.length >= 2 ? 'alta' : 'media',
    dimension: 'entrada',
    penalizes: true,
    evidence,
    quote: buildQuote({ evidence, text: user.text }),
    condition: `${pairs.length} de ${facts.eligiblePairs} pares consecutivos repitieron el pedido con similitud ≥ 0,6`,
    recommendation: RULE_RECOMMENDATION['INP-1'],
  });
};

/** INP-2: turno cerrado por una interrupción o por el `user` siguiente. */
const evaluateInp2 = (facts: TFacts): TFinding | null => {
  const interruption = facts.interruptions[0];
  if (interruption === undefined) return null;

  const interruptingUser = facts.users.find(
    (user) => user.messageId === interruption.messageId,
  );
  const text =
    interruption.kind === 'user' && interruptingUser !== undefined
      ? interruptingUser.text
      : 'El turno se cerró como interrumpido';
  const evidence: TEvidence = {
    sessionId: interruption.sessionId,
    messageId: interruption.messageId,
    at: interruption.at,
    turnIndex: interruption.turnIndex,
  };
  return makeFinding({
    ruleId: 'INP-2',
    severity: 'media',
    dimension: 'entrada',
    penalizes: true,
    evidence,
    quote: buildQuote({ evidence, text }),
    condition: `${facts.interruptions.length} de ${facts.closedTurns} turnos cerrados se interrumpieron`,
    recommendation: RULE_RECOMMENDATION['INP-2'],
  });
};

/** INP-3: pregunta o formulario de la raíz repetido (Jaccard ≥ 0,7). */
const evaluateInp3 = (facts: TFacts): TFinding | null => {
  const repeated = facts.repeatedQuestions[facts.repeatedQuestions.length - 1];
  if (repeated === undefined) return null;

  const evidence: TEvidence = {
    sessionId: repeated.sessionId,
    messageId: repeated.messageId,
    toolId: repeated.toolId,
    at: repeated.at,
    turnIndex: repeated.turnIndex ?? undefined,
  };
  return makeFinding({
    ruleId: 'INP-3',
    severity: 'media',
    dimension: 'entrada',
    penalizes: true,
    evidence,
    quote: buildQuote({
      evidence,
      text: repeated.text,
      toolName: toolNameOf(facts, repeated.toolId),
    }),
    condition: `${facts.repeatedQuestions.length} de ${facts.questionCalls.length} preguntas o formularios de la raíz repitieron una anterior con similitud ≥ 0,7`,
    recommendation: RULE_RECOMMENDATION['INP-3'],
  });
};

/** INP-4: restricción tardía seguida de la reedición del mismo archivo. */
const evaluateInp4 = (facts: TFacts): TFinding | null => {
  if (facts.firstWrite === null) return null;

  let candidate: { userMessageId: string; toolId: string } | null = null;
  for (const user of facts.users) {
    if (user.at <= facts.firstWrite.at) continue;
    if (!CONSTRAINT_MARKERS.test(normalizeText(user.text))) continue;

    const priorWrite = [...facts.tools]
      .reverse()
      .find(
        (tool) =>
          tool.isWrite && tool.filePath !== null && tool.at < user.at,
      );
    if (priorWrite === undefined || priorWrite.filePath === null) continue;

    const reedit = facts.tools.find(
      (tool) =>
        tool.isWrite &&
        tool.filePath === priorWrite.filePath &&
        tool.at >= user.at,
    );
    if (reedit === undefined) continue;

    const stepsBetween = facts.assistants.filter(
      (step) =>
        step.sessionId === user.sessionId &&
        step.at >= user.at &&
        step.at <= reedit.at,
    ).length;
    if (stepsBetween > 2) continue;

    candidate = { userMessageId: user.messageId, toolId: reedit.toolId };
  }
  if (candidate === null) return null;

  const user = facts.users.find(
    (fact) => fact.messageId === candidate?.userMessageId,
  );
  if (user === undefined) return null;

  const evidence: TEvidence = {
    sessionId: user.sessionId,
    messageId: user.messageId,
    toolId: candidate.toolId,
    at: user.at,
    turnIndex: user.turnIndex ?? undefined,
  };
  return makeFinding({
    ruleId: 'INP-4',
    severity: 'baja',
    dimension: null,
    penalizes: false,
    evidence,
    quote: buildQuote({
      evidence,
      text: user.text,
      toolName: toolNameOf(facts, candidate.toolId),
    }),
    condition: `Marcador de restricción después de la primera escritura y reedición del mismo archivo en ≤ 2 pasos`,
    recommendation: RULE_RECOMMENDATION['INP-4'],
  });
};

/** RES-1: errores de herramienta sobre llamadas (≥ 10 % o ≥ 3 errores). */
const evaluateRes1 = (facts: TFacts): TFinding | null => {
  const failed = facts.tools.filter((tool) => tool.status === 'error');
  if (failed.length === 0 || facts.tools.length === 0) return null;

  const ratio = failed.length / facts.tools.length;
  if (ratio < 0.1 && failed.length < 3) return null;

  const tool = failed[failed.length - 1];
  const evidence: TEvidence = {
    sessionId: tool.sessionId,
    messageId: tool.messageId,
    toolId: tool.toolId,
    at: tool.at,
    turnIndex: tool.turnIndex ?? undefined,
  };
  const contributesToFailure = facts.outcome === 'failed';
  return makeFinding({
    ruleId: 'RES-1',
    severity: ratio >= 0.25 || contributesToFailure ? 'alta' : 'media',
    dimension: 'ejecucion',
    penalizes: true,
    evidence,
    quote: buildQuote({
      evidence,
      text: toolQuoteText(tool),
      toolName: tool.name,
    }),
    condition: `${failed.length} de ${facts.tools.length} llamadas fallaron (${formatPercent(ratio)}); umbral 10 % o 3 errores`,
    recommendation: RULE_RECOMMENDATION['RES-1'],
  });
};

/** RES-2: intento ≥ 3 o ≥ 3 reintentos; el resto solo puntúa por indicador. */
const evaluateRes2 = (facts: TFacts): TFinding | null => {
  const maxAttempt = facts.assistants.reduce(
    (maximum, step) => (step.retry === null ? maximum : Math.max(maximum, step.retry.attempt)),
    0,
  );
  if (
    maxAttempt < RETRY_ALERT_THRESHOLD &&
    facts.retries.length < RETRY_ALERT_THRESHOLD
  ) {
    return null;
  }

  // La cita debe apuntar al mismo reintento que mide la condición: el de
  // `attempt` máximo, con desempate estable por `at` y `messageId`. El último
  // de `facts.retries` no sirve porque el array va ordenado por tiempo.
  const retry = facts.retries.reduce<TRetryFact | null>((current, candidate) => {
    if (current === null) return candidate;
    if (candidate.attempt !== current.attempt) {
      return candidate.attempt > current.attempt ? candidate : current;
    }
    if (candidate.at !== current.at) {
      return candidate.at < current.at ? candidate : current;
    }
    return compareIds(candidate.messageId, current.messageId) < 0
      ? candidate
      : current;
  }, null);
  if (retry === null) return null;

  const evidence: TEvidence = {
    sessionId: retry.sessionId,
    messageId: retry.messageId,
    at: retry.at,
    turnIndex: retry.turnIndex ?? undefined,
  };
  return makeFinding({
    ruleId: 'RES-2',
    severity: 'alta',
    dimension: 'ejecucion',
    penalizes: true,
    evidence,
    quote: buildQuote({
      evidence,
      text: `Reintento con intento ${retry.attempt}`,
    }),
    condition: `${facts.retries.length} reintentos en la sesión; intento máximo ${maxAttempt}`,
    recommendation: RULE_RECOMMENDATION['RES-2'],
  });
};

/** RES-3: firma repetida ≥ 3 veces o ≥ 2 salidas exactas iguales. */
const evaluateRes3 = (facts: TFacts): TFinding | null => {
  const redundant = facts.redundantCalls[0];
  if (redundant === undefined) return null;

  const evidence: TEvidence = {
    sessionId: redundant.sessionId,
    messageId: redundant.messageId,
    toolId: redundant.toolId,
    at: redundant.at,
    turnIndex: redundant.turnIndex ?? undefined,
  };
  return makeFinding({
    ruleId: 'RES-3',
    severity: 'media',
    dimension: 'ejecucion',
    penalizes: true,
    evidence,
    quote: buildQuote({
      evidence,
      text:
        redundant.output.length > 0
          ? redundant.output
          : `Llamada repetida a ${redundant.name}`,
      toolName: redundant.name,
    }),
    condition: `${facts.redundantCalls.length} de ${facts.tools.length} llamadas repitieron firma o salida`,
    recommendation: RULE_RECOMMENDATION['RES-3'],
  });
};

/** RES-4: compactaciones automáticas de la raíz; la primera no resta. */
const evaluateRes4 = (
  facts: TFacts,
  rootSessionId: string,
): TFinding | null => {
  const automatic = facts.compactions.filter(
    (compaction) =>
      compaction.sessionId === rootSessionId && compaction.reason === 'auto',
  );
  if (automatic.length === 0) return null;

  const repetitions = automatic.length;
  const compaction = repetitions >= 2 ? automatic[1] : automatic[0];
  const evidence: TEvidence = {
    sessionId: compaction.sessionId,
    messageId: compaction.messageId,
    at: compaction.at,
    turnIndex: compaction.turnIndex ?? undefined,
  };
  return makeFinding({
    ruleId: 'RES-4',
    severity: 'baja',
    dimension: 'contexto',
    penalizes: repetitions >= 2,
    evidence,
    quote: buildQuote({
      evidence,
      text: 'Compactación automática completada',
    }),
    condition:
      repetitions >= 2
        ? `${repetitions} compactaciones automáticas completadas en la raíz; la primera no resta`
        : '1 compactación automática completada en la raíz; la primera no resta',
    recommendation: RULE_RECOMMENDATION['RES-4'],
  });
};

/** RES-5: coste con resultado fallido o interrumpido (señal débil). */
const evaluateRes5 = (facts: TFacts): TFinding | null => {
  if (facts.outcome !== 'failed' && facts.outcome !== 'interrupted') {
    return null;
  }
  const cost = facts.assistants.reduce<number | null>((total, step) => {
    if (step.cost === null) return total;
    return (total ?? 0) + step.cost;
  }, null);
  if (cost === null || cost <= 0) return null;

  const idle = facts.idles[facts.idles.length - 1];
  if (idle === undefined) return null;

  const evidence: TEvidence = {
    sessionId: idle.sessionId,
    messageId: idle.messageId,
    at: idle.at,
    turnIndex: idle.turnIndex ?? undefined,
  };
  return makeFinding({
    ruleId: 'RES-5',
    severity: 'media',
    dimension: null,
    penalizes: false,
    evidence,
    quote: buildQuote({
      evidence,
      text: `Resultado ${outcomeLabel(facts.outcome)} después del coste reportado`,
    }),
    condition: `Coste ${formatNumber(cost)} con resultado ${outcomeLabel(facts.outcome)} y ${facts.filesTouched} archivos modificados`,
    recommendation: RULE_RECOMMENDATION['RES-5'],
  });
};

/** RES-6: p95 > 60 s o ≥ 3 llamadas lentas (señal débil). */
const evaluateRes6 = (facts: TFacts): TFinding | null => {
  const slow = facts.tools.filter(
    (tool) => tool.durationMs !== null && tool.durationMs > SLOW_TOOL_MS,
  );
  const p95 = nearestRankP95(facts.toolDurationsMs);
  if (!((p95 !== null && p95 > SLOW_TOOL_MS) || slow.length >= SLOW_TOOL_MIN_CALLS)) {
    return null;
  }

  const slowest = [...facts.tools]
    .filter(
      (tool): tool is TToolFact & { durationMs: number } =>
        tool.durationMs !== null,
    )
    .reduce((current, tool) =>
      tool.durationMs > current.durationMs ? tool : current,
    );

  const evidence: TEvidence = {
    sessionId: slowest.sessionId,
    messageId: slowest.messageId,
    toolId: slowest.toolId,
    at: slowest.at,
    turnIndex: slowest.turnIndex ?? undefined,
  };
  return makeFinding({
    ruleId: 'RES-6',
    severity: 'baja',
    dimension: null,
    penalizes: false,
    evidence,
    quote: buildQuote({
      evidence,
      text: `La herramienta ${slowest.name} tardó ${formatSeconds(slowest.durationMs)}`,
      toolName: slowest.name,
    }),
    condition: `p95 de duración ${formatSeconds(p95 ?? slowest.durationMs)}; ${slow.length} llamadas superaron 60 s`,
    recommendation: RULE_RECOMMENDATION['RES-6'],
  });
};

// ---------------------------------------------------------------------------
// Orden, corte y señales por turno
// ---------------------------------------------------------------------------

/** Orden del contrato §6: impacto, severidad, peso, turno y regla. */
export const compareFindings = (left: TFinding, right: TFinding): number => {
  if (left.penalizes !== right.penalizes) return left.penalizes ? -1 : 1;
  if (left.severity !== right.severity) {
    return SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
  }
  const byWeight =
    dimensionWeight(right.dimension) - dimensionWeight(left.dimension);
  if (byWeight !== 0) return byWeight;

  const leftTurn = left.evidence.turnIndex ?? Number.POSITIVE_INFINITY;
  const rightTurn = right.evidence.turnIndex ?? Number.POSITIVE_INFINITY;
  if (leftTurn !== rightTurn) return leftTurn - rightTurn;
  return compareIds(left.ruleId, right.ruleId);
};

/** Ordena y separa penalizantes/débiles, capando ambos a 10. */
export const splitRuleFindings = (
  findings: readonly TFinding[],
): TRuleCatalog => {
  const ordered = [...findings].sort(compareFindings);
  return {
    findings: ordered
      .filter((finding) => finding.penalizes)
      .slice(0, MAX_FINDINGS),
    weakSignals: ordered
      .filter((finding) => !finding.penalizes)
      .slice(0, MAX_WEAK_SIGNALS),
  };
};

/**
 * Ejecuta el catálogo sobre los hechos. Devuelve solo hallazgos con ancla, ya
 * ordenados y capados; `findings` y `weakSignals` conservan el orden global.
 */
export const buildRuleFindings = (
  facts: TFacts,
  rootSessionId: string,
): TRuleCatalog => {
  const candidates = [
    evaluateInp1(facts),
    evaluateInp2(facts),
    evaluateInp3(facts),
    evaluateInp4(facts),
    evaluateRes1(facts),
    evaluateRes2(facts),
    evaluateRes3(facts),
    evaluateRes4(facts, rootSessionId),
    evaluateRes5(facts),
    evaluateRes6(facts),
  ].filter((finding): finding is TFinding => finding !== null);

  return splitRuleFindings(candidates);
};

const signalsForTurn = (
  findings: readonly TFinding[],
  turns: readonly TTurnAnalysis[],
  turn: TTurnAnalysis,
): TRuleId[] => {
  const signals: TRuleId[] = [];
  for (const finding of findings) {
    const index =
      finding.evidence.turnIndex ??
      turnIndexAt(turns, finding.evidence.at) ??
      null;
    if (index !== turn.index) continue;
    if (!signals.includes(finding.ruleId)) signals.push(finding.ruleId);
  }
  return signals;
};

/**
 * Puebla `TTurnAnalysis.signals` con las reglas cuya evidencia cae en la
 * ventana del turno. Solo crea objetos nuevos cuando la lista cambia.
 */
export const attachTurnSignals = (
  turns: readonly TTurnAnalysis[],
  catalog: TRuleCatalog,
): TTurnAnalysis[] => {
  const ordered = [...catalog.findings, ...catalog.weakSignals];
  return turns.map((turn) => {
    const signals = signalsForTurn(ordered, turns, turn);
    if (
      signals.length === turn.signals.length &&
      signals.every((ruleId, position) => ruleId === turn.signals[position])
    ) {
      return turn;
    }
    return { ...turn, signals };
  });
};
