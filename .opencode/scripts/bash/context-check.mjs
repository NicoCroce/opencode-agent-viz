#!/usr/bin/env node
// context-check.mjs — SddOrch: decide si conviene compactar la sesión ahora.
//
// Uso:
//   node .opencode/scripts/bash/context-check.mjs [--session <id>] [--apply]
//
// Qué hace (determinista, sin LLM):
//   1. Lee la sesión (`--session` o `OPENCODE_SESSION_ID`, que OpenCode expone en la shell) con
//      `opencode api`, que descubre y autentica el servicio.
//   2. Mide la ventana del último paso con tokens (`input + cache.read + cache.write`) y la compara con
//      el umbral: el menor entre 200k y el 70 % de la entrada del modelo (`limit.input ?? limit.context`).
//   3. Decide:
//        keep       la ventana está por debajo del umbral;
//        wait       la última compactación fue hace menos de 10 pasos (evita bucles);
//        too-large  justo después de la última compactación la ventana ya rondaba el umbral: compactar
//                   no libera contexto; conviene una sesión nueva que retome desde el `state`;
//        compact    conviene compactar. Con `--apply` la pide (`POST /compact`); OpenCode la ejecuta en
//                   el siguiente límite de paso y la sesión continúa.
//   4. Imprime una línea JSON: { decision, applied, windowTokens, thresholdTokens, inputLimit, model,
//      stepsSinceCompaction, postCompactionWindow, advice }. `stepsSinceCompaction` es `null` si nunca se
//      compactó o si no hizo falta contarlos (ventana bajo el umbral). Sale siempre con 0; un fallo devuelve
//      `decision: "error"` para no frenar al orquestador.
//
// Llamarlo solo en puntos seguros (cierre de fase u ola, con el `state` ya guardado en Engram).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const TARGET_TOKENS = 200_000;
export const LIMIT_SHARE = 0.7;
export const MIN_STEPS_BETWEEN = 10;
export const INEFFECTIVE_SHARE = 0.8;
const PAGE_SIZE = 20;
const MAX_PAGES = 15;

const fmt = (tokens) => `${Math.round(tokens / 1000)}k`;

export const thresholdFor = (inputLimit) =>
  inputLimit ? Math.min(TARGET_TOKENS, Math.floor(LIMIT_SHARE * inputLimit)) : TARGET_TOKENS;

/** Decisión pura a partir de las mediciones. `stepsSinceCompaction` es `null` si nunca se compactó. */
export const decide = ({ windowTokens, inputLimit, stepsSinceCompaction, postCompactionWindow }) => {
  const thresholdTokens = thresholdFor(inputLimit);
  if (windowTokens < thresholdTokens) {
    return { decision: 'keep', thresholdTokens, advice: `Ventana ${fmt(windowTokens)} < umbral ${fmt(thresholdTokens)}: no compactes.` };
  }
  if (stepsSinceCompaction !== null && stepsSinceCompaction < MIN_STEPS_BETWEEN) {
    return {
      decision: 'wait',
      thresholdTokens,
      advice: `La última compactación fue hace ${stepsSinceCompaction} pasos: no la repitas.`,
    };
  }
  if (postCompactionWindow !== null && postCompactionWindow >= INEFFECTIVE_SHARE * thresholdTokens) {
    return {
      decision: 'too-large',
      thresholdTokens,
      advice: `Tras la última compactación la ventana quedó en ${fmt(postCompactionWindow)}: compactar no libera contexto. Sugiere al usuario una sesión nueva que retome desde el state.`,
    };
  }
  return {
    decision: 'compact',
    thresholdTokens,
    advice: `Ventana ${fmt(windowTokens)} ≥ umbral ${fmt(thresholdTokens)}: compacta con el state ya guardado.`,
  };
};

// `opencode api` corta la salida al escribir en una tubería: se redirige a un archivo.
export const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'context-check-'));

const api = (dir, method, route, data) => {
  const out = path.join(dir, 'out.json');
  const fd = fs.openSync(out, 'w');
  const args = ['api', method, route, ...(data === undefined ? [] : ['--data', JSON.stringify(data)])];
  const result = spawnSync('opencode', args, { stdio: ['ignore', fd, 'pipe'], encoding: 'utf8' });
  fs.closeSync(fd);
  if (result.status !== 0) throw new Error(`opencode api ${method} ${route}: ${(result.stderr || '').trim().slice(0, 200)}`);
  return JSON.parse(fs.readFileSync(out, 'utf8'));
};

const windowOf = (message) => {
  const t = message.tokens;
  return t ? t.input + t.cache.read + t.cache.write : null;
};

/**
 * Mediciones de la sesión: último paso con tokens, pasos desde la última compactación y ventana del
 * primer paso posterior a ella. Pagina hacia atrás solo si la ventana alcanza el umbral.
 */
export const measure = (dir, session, thresholdOfModel) => {
  const base = `/api/session/${encodeURIComponent(session)}/message`;
  const lastCompaction = api(dir, 'get', `${base}?type=compaction&limit=1&order=desc`).data[0] ?? null;
  const lastAt = lastCompaction?.time.created ?? null;

  const steps = []; // pasos con tokens posteriores a la compactación, del más nuevo al más viejo
  let current = null;
  let reachedCompaction = false;
  let belowThreshold = false;
  let page = api(dir, 'get', `${base}?type=assistant&limit=${PAGE_SIZE}&order=desc`);
  for (let i = 0; i < MAX_PAGES; i++) {
    for (const message of page.data) {
      if (windowOf(message) === null) continue;
      current ??= message;
      if (lastAt !== null && message.time.created <= lastAt) {
        reachedCompaction = true;
        break;
      }
      steps.push(message);
    }
    belowThreshold = current !== null && windowOf(current) < thresholdOfModel(current.model);
    if (reachedCompaction || lastAt === null || belowThreshold || !page.cursor?.next || page.data.length === 0) break;
    page = api(dir, 'get', `${base}?type=assistant&limit=${PAGE_SIZE}&cursor=${page.cursor.next}`);
  }
  return {
    current,
    // `null` sin compactación previa o si no hizo falta contar (ventana bajo el umbral).
    stepsSinceCompaction: lastAt === null || (belowThreshold && !reachedCompaction) ? null : steps.length,
    postCompactionWindow: reachedCompaction && steps.length > 0 ? windowOf(steps[steps.length - 1]) : null,
  };
};

const inputLimitOf = (dir, model) => {
  if (!model) return null;
  const models = api(dir, 'get', '/api/model').data ?? [];
  const match =
    models.find((m) => m.providerID === model.providerID && m.id === model.id) ??
    models.find((m) => m.providerID === model.providerID && m.modelID === model.id);
  const limit = match?.limit?.input ?? match?.limit?.context ?? null;
  return limit && limit > 0 ? limit : null;
};

const main = () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const sessionIndex = args.indexOf('--session');
  const session = sessionIndex >= 0 ? args[sessionIndex + 1] : process.env.OPENCODE_SESSION_ID;
  const print = (result) => console.log(JSON.stringify(result));

  if (!session) {
    print({ decision: 'error', applied: false, advice: 'Sin sesión: pasa --session <id> o corre dentro de OpenCode.' });
    return;
  }

  const dir = tmpDir();
  try {
    const limits = new Map();
    const limitOf = (model) => {
      const key = model ? `${model.providerID}/${model.id}` : '';
      if (!limits.has(key)) limits.set(key, inputLimitOf(dir, model));
      return limits.get(key);
    };
    const { current, stepsSinceCompaction, postCompactionWindow } = measure(dir, session, (model) =>
      thresholdFor(limitOf(model)),
    );
    if (current === null) {
      print({ decision: 'keep', applied: false, advice: 'Todavía no hay pasos con tokens.' });
      return;
    }
    const windowTokens = windowOf(current);
    const model = current.model ? `${current.model.providerID}/${current.model.id}` : null;
    const inputLimit = limitOf(current.model);
    const verdict = decide({ windowTokens, inputLimit, stepsSinceCompaction, postCompactionWindow });

    let applied = false;
    let advice = verdict.advice;
    if (verdict.decision === 'compact' && apply) {
      api(dir, 'post', `/api/session/${encodeURIComponent(session)}/compact`, {});
      applied = true;
      advice = 'Compactación pedida: se ejecuta en el próximo paso. Después recupera el estado desde Engram.';
    } else if (verdict.decision === 'compact') {
      advice += ' Vuelve a correr con --apply.';
    }

    print({
      decision: verdict.decision,
      applied,
      windowTokens,
      thresholdTokens: verdict.thresholdTokens,
      inputLimit,
      model,
      stepsSinceCompaction,
      postCompactionWindow,
      advice,
    });
  } catch (error) {
    print({ decision: 'error', applied: false, advice: `No se pudo medir el contexto: ${error.message}` });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
