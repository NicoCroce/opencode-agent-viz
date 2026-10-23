/**
 * Orquestación del motor de eficiencia de sesión (engine §2–§4, §8).
 *
 * Fuente: `contracts/efficiency-engine-contract.md` §2–§4, §7–§9 y
 * `data-model.md` §2, §4, §7 (feature 015).
 *
 * - Valida la raíz, construye los hechos/turnos/totales (una sola pasada en
 *   `turns.ts`) y compone el veredicto con `score.ts`.
 * - Aplica la precedencia `no_data → in_progress → insufficient → ok`; las
 *   dimensiones y los totales disponibles se conservan cuando no hay nota.
 * - Las notas siguen el orden determinista de `data-model.md` §7. La nota de
 *   grafo truncado no vive aquí: el motor recibe `truncated` solo para marcar el
 *   análisis como parcial (`confidence`), nunca para inventar sesiones.
 * - `findings`/`weakSignals` salen del catálogo de `rules.ts` (US2) y las
 *   señales de cada turno se derivan de su evidencia; el orden y el cap ya
 *   vienen aplicados.
 *
 * Módulo puro: sin React, SDK, reloj ni azar. El único reloj es `now`, inyectado
 * y usado solo por la duración del turno abierto.
 */
import type {
  TEfficiencyInput,
  TEfficiencyReport,
  TEfficiencyStatus,
  TEfficiencyTotals,
} from '../Efficiency.entity';
import { attachTurnSignals, buildRuleFindings } from './rules';
import { bandFor, buildScore } from './score';
import { MIN_CLOSED_TURNS, MIN_COVERAGE } from './thresholds';
import { buildFacts, buildTotals, type TFacts } from './turns';

/** Totales de un informe sin datos: ningún valor reportado y conteos a cero. */
const EMPTY_TOTALS: TEfficiencyTotals = {
  cost: null,
  tokensIn: null,
  tokensOut: null,
  cacheRead: null,
  cacheWrite: null,
  windowTokens: null,
  latencyP95Ms: null,
  slowToolCalls: 0,
  compactions: 0,
  retries: 0,
  toolErrors: 0,
  toolCalls: 0,
};

/** Informe sin datos: sin dimensiones, turnos ni puntuación (data-model §2.2). */
const noDataReport = (): TEfficiencyReport => ({
  status: 'no_data',
  score: null,
  band: null,
  coverage: 0,
  confidence: null,
  dimensions: [],
  findings: [],
  weakSignals: [],
  turns: [],
  totals: { ...EMPTY_TOTALS },
  notes: [],
});

const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

/** ¿Hay al menos un mensaje cargado en alguna sesión? */
const hasAnyMessage = (
  messagesBySession: TEfficiencyInput['messagesBySession'],
): boolean =>
  Object.values(messagesBySession).some((messages) => messages.length > 0);

/**
 * Notas del motor en el orden de `data-model.md` §7. Cada nota aparece una sola
 * vez; las de compactación se ordenan por número de turno.
 */
const buildNotes = (facts: TFacts, cacheOmitted: boolean): string[] => {
  const notes: string[] = [];
  const add = (note: string): void => {
    if (!notes.includes(note)) notes.push(note);
  };

  if (facts.missingSessionIds.length > 0) {
    add(
      `Subárbol parcial: ${facts.missingSessionIds.length} sesiones sin mensajes cargados; el análisis puede estar incompleto.`,
    );
  }

  if (facts.windowTokens === null) {
    add(
      'Tokens no disponibles: la ventana de contexto y la caché se omiten.',
    );
  } else if (cacheOmitted) {
    add(
      'La caché no está reportada por el proveedor; Contexto se calcula solo con compactaciones.',
    );
  }

  const closedTurnIndexes = new Set(
    facts.turns
      .filter((turn) => turn.closed)
      .map((turn) => turn.index),
  );
  const compactionTurns = [
    ...new Set(
      facts.compactions
        .map((compaction) => compaction.turnIndex)
        .filter(
          (turnIndex): turnIndex is number =>
            turnIndex !== null && closedTurnIndexes.has(turnIndex),
        ),
    ),
  ].sort((left, right) => left - right);
  for (const turnIndex of compactionTurns) {
    add(
      `La compactación del turno ${turnIndex} puede afectar a los turnos siguientes.`,
    );
  }

  if (facts.turns.some((turn) => !turn.closed)) {
    add('El turno abierto no entra en los denominadores.');
  }

  if (facts.outcome === null) {
    add('No hay un cierre (idle) para la sesión; el resultado se omite.');
  }

  if (facts.compactions.length > 0) {
    add(
      'Los totales derivan de los pasos assistant; la compactación se muestra aparte.',
    );
  }

  return notes;
};

/**
 * Guardas de estado (engine §4.7): sin datos, en curso, muestra insuficiente o
 * puntuable. La precedencia es la del contrato.
 */
const resolveStatus = (
  facts: TFacts,
  sessions: TEfficiencyInput['sessions'],
  coverage: number,
  score: number | null,
): TEfficiencyStatus => {
  const active = Object.values(sessions).some(
    (meta) => meta.status === 'active',
  );
  if (active) return 'in_progress';
  if (facts.closedTurns < MIN_CLOSED_TURNS || coverage < MIN_COVERAGE) {
    return 'insufficient';
  }
  return score === null ? 'insufficient' : 'ok';
};

/**
 * Analiza una sesión raíz y su subárbol y devuelve un informe inmutable por
 * convención. No muta la entrada ni lee el reloj.
 */
export const analyzeSession = (
  input: TEfficiencyInput,
): TEfficiencyReport => {
  const { rootSessionId, messagesBySession, sessions } = input;

  // La raíz debe existir en el mapa de sesiones y debe haber algún mensaje.
  if (!hasOwn(sessions, rootSessionId) || !hasAnyMessage(messagesBySession)) {
    return noDataReport();
  }

  const facts = buildFacts(input);
  const isPartial =
    facts.missingSessionIds.length > 0 || input.truncated === true;
  const scoreResult = buildScore(facts, { rootSessionId, isPartial });
  const ruleCatalog = buildRuleFindings(facts, rootSessionId);
  const status = resolveStatus(
    facts,
    sessions,
    scoreResult.coverage,
    scoreResult.score,
  );
  const score = status === 'ok' ? scoreResult.score : null;

  return {
    status,
    score,
    band: bandFor(score),
    coverage: scoreResult.coverage,
    confidence: scoreResult.confidence,
    dimensions: scoreResult.dimensions,
    findings: ruleCatalog.findings,
    weakSignals: ruleCatalog.weakSignals,
    turns: attachTurnSignals(facts.turns, ruleCatalog),
    totals: buildTotals(facts),
    notes: buildNotes(facts, scoreResult.cacheOmitted),
  };
};
