#!/usr/bin/env node
// schedule.mjs — Fase `schedule` de SddOrch: calcula olas de implementación desde tasks.md.
//
// Uso:
//   node .opencode/scripts/bash/schedule.mjs <tasks.md> [--run-dir <dir>] [--max N]
//                                            [--group-tasks N] [--group-files N]
//
// Qué hace (determinista, sin LLM):
//   1. Lee las tareas pendientes (`- [ ] T### [P] [USn] descripción`).
//   2. Infiere los `writes` de cada tarea: rutas entre backticks cuyo primer tramo existe en la raíz del repo.
//   3. Calcula el nivel de cada tarea (camino más largo) con estas dependencias:
//        - fases bloqueantes (Setup/Foundational) antes de las historias; Polish/Convergence al final;
//        - dentro de una fase, una tarea sin [P] espera a todas las anteriores de su fase;
//          una [P] no espera a ninguna (solo a conflictos de archivo y dependencias explícitas);
//        - dependencias explícitas ("depende de T010", "tras T009");
//        - dependencias entre historias ("USn ... tras USm" en User Story Dependencies);
//        - conflicto de archivos: la tarea posterior espera a la anterior si comparten ruta o directorio.
//   4. Fusiona cadenas cortas de tareas de una historia en una sola unidad (máx. --group-tasks tareas
//      y --group-files archivos) para ahorrar ciclos de implementador.
//   5. Las unidades que tocan SHARED_FILES no se fusionan con otras tareas; instalaciones y tareas sin
//      rutas inferidas van solas; las olas se parten en --max simultáneas.
//   6. Notas de coherencia (no bloquean): archivos de código citados en spec.md, plan.md, data-model.md
//      o contracts/ que no existen aún y ninguna tarea escribe (`sin dueño`), y dependencias escritas en
//      prosa fuera de la línea de la tarea ("T025 antes de T029", "T029 depende de T025", "T025 → T029"),
//      que se aplican como aristas explícitas.
//
// Salida: tabla corta por stdout + <run-dir>/schedule.json + <run-dir>/units/Uxx.md (uno por unidad,
// con feature_directory, `## writes` y las líneas de tarea). El orquestador NO lee tasks.md:
// pasa a cada implementador la ruta de su Uxx.md.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = { max: 10, groupTasks: 3, groupFiles: 4, runDir: null };
let file = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--max') opt.max = Number(args[++i]);
  else if (a === '--group-tasks') opt.groupTasks = Number(args[++i]);
  else if (a === '--group-files') opt.groupFiles = Number(args[++i]);
  else if (a === '--run-dir') opt.runDir = args[++i];
  else file = a;
}
if (!file || !fs.existsSync(file)) {
  console.error('uso: schedule.mjs <tasks.md> [--run-dir <dir>] [--max N] [--group-tasks N] [--group-files N]');
  process.exit(2);
}

const featureDir = path.dirname(file).split(path.sep).join('/');
const runDir = opt.runDir ?? `.opencode/runs/${path.basename(featureDir)}`;
const rootEntries = new Set(fs.readdirSync(process.cwd()));
const SHARED = [/(^|\/)index\.ts$/, /(^|\/)queryKeys\.ts$/, /\.routes\.ts$/, /(^|\/)Routes\.tsx$/, /(^|\/)package\.json$/, /(^|\/)pnpm-lock\.yaml$/];
const INSTALL = /\bpnpm (add|install|i)\b|\bnpm (install|i)\b|migraci[oó]n|migrate\b|generador|codegen/i;

// ---------- parseo ----------
const lines = fs.readFileSync(file, 'utf8').split('\n');
const phaseRe = /^##\s+Phase\s+(\d+):\s*(.*)$/i;
const taskRe = /^\s*-\s\[([ xX])\]\s+(T\d+)\s*((?:\[[^\]]+\]\s*)*)(.*)$/;
const phases = [];
const all = [];
let cur = { idx: 0, name: '(sin fase)', kind: 'story' };
phases.push(cur);
let storyDeps = {};
let inStoryDeps = false;
const proseLines = [];

const kindOf = (name) =>
  /setup|foundational|blocking/i.test(name) ? 'block' : /polish|cross-cutting|converg|verify|fix/i.test(name) ? 'final' : 'story';

for (const line of lines) {
  const pm = line.match(phaseRe);
  if (pm) {
    cur = { idx: phases.length, name: pm[2].trim(), kind: kindOf(pm[2]) };
    phases.push(cur);
    inStoryDeps = false;
    continue;
  }
  if (/^###\s+User Story Dependencies/i.test(line)) { inStoryDeps = true; continue; }
  if (/^#{1,3}\s/.test(line) && !/User Story Dependencies/i.test(line)) inStoryDeps = false;
  if (inStoryDeps) {
    const sm = line.match(/\*\*(US\d+)/);
    if (sm) {
      const deps = new Set();
      for (const m of line.matchAll(/(?:tras|after|depende de|depends on)[^.;]*?(US\d+(?:\s*(?:,|y|and)\s*US\d+)*)/gi))
        for (const d of m[1].match(/US\d+/g)) if (d !== sm[1]) deps.add(d);
      if (deps.size) storyDeps[sm[1]] = [...deps];
    }
  }
  const tm = line.match(taskRe);
  if (!tm) {
    if (/\bT\d+\b/.test(line)) proseLines.push({ text: line, section: cur.name });
    continue;
  }
  const [, mark, id, tags, desc] = tm;
  all.push({
    id, done: mark !== ' ', parallel: /\[P\]/.test(tags), story: (tags.match(/\[(US\d+)\]/) || [])[1] ?? null,
    phase: cur, desc: desc.trim(), raw: line.trim(), order: all.length,
  });
}
const tasks = all.filter((t) => !t.done);
if (!tasks.length) { console.log('Sin tareas pendientes en ' + file); process.exit(0); }
const pendingIds = new Set(tasks.map((t) => t.id));

const expandBraces = (s) => {
  const m = s.match(/^(.*)\{([^{}]+)\}(.*)$/);
  return m ? m[2].split(',').flatMap((x) => expandBraces(m[1] + x.trim() + m[3])) : [s];
};
const normalize = (p) => p.replace(/^\.\//, '').replace(/\/\*{1,2}$/, '/').replace(/\*+$/, '');
function extractWrites(desc) {
  const out = new Set();
  for (const m of desc.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim();
    if (!/^[\w@.\/\-*{},]+$/.test(t)) continue;
    if (!t.includes('/') && !/\.\w{1,6}$/.test(t)) continue;
    if (!rootEntries.has(t.replace(/^\.\//, '').split('/')[0])) continue;
    for (const e of expandBraces(t)) out.add(normalize(e));
  }
  return [...out];
}
const conflict = (x, y) => x === y || (x.endsWith('/') && y.startsWith(x)) || (y.endsWith('/') && x.startsWith(y));

for (const t of tasks) {
  t.writes = extractWrites(t.desc);
  t.shared = t.writes.some((w) => SHARED.some((r) => r.test(w)));
  t.install = INSTALL.test(t.desc);
  t.solo = t.install || t.writes.length === 0;
  t.explicit = new Set();
  for (const m of t.desc.matchAll(/(?:depende(?:n)? de|dep\.|tras|after|depends on|requiere|necesita)\s+((?:T\d+(?:\s*(?:,|y|and|\/|&)\s*)?)+)/gi))
    for (const d of m[1].match(/T\d+/g)) if (d !== t.id && pendingIds.has(d)) t.explicit.add(d);
}

// Dependencias en prosa (fuera de la línea de la tarea): se aplican como aristas explícitas.
const proseNotes = [];
const ids = (s) => s.match(/T\d+/g) ?? [];
const ID_LIST = '(T\\d+(?:\\s*(?:,|y|and|/|&)\\s*T\\d+)*)';
function addProseDep(pred, succ, section) {
  if (pred === succ || !pendingIds.has(pred) || !pendingIds.has(succ)) return;
  const t = tasks.find((x) => x.id === succ);
  if (t.explicit.has(pred)) return;
  t.explicit.add(pred);
  proseNotes.push(`dependencia en prosa aplicada: ${succ} ← ${pred} (sección «${section}»)`);
}
for (const { text, section } of proseLines) {
  for (const m of text.matchAll(new RegExp(`${ID_LIST}\\s+(?:antes de|before)\\s+${ID_LIST}`, 'gi')))
    for (const p of ids(m[1])) for (const s of ids(m[2])) addProseDep(p, s, section);
  for (const m of text.matchAll(new RegExp(`${ID_LIST}\\s+(?:depende(?:n)? de|depends on|tras|after|requiere)\\s+${ID_LIST}`, 'gi')))
    for (const s of ids(m[1])) for (const p of ids(m[2])) addProseDep(p, s, section);
  for (const m of text.matchAll(/(T\d+)\s*(?:→|->|⇒)\s*(?=(T\d+))/g)) addProseDep(m[1], m[2], section);
}

// Archivos de código citados en los documentos de diseño que no existen y ninguna tarea escribe.
const ownerNotes = [];
(() => {
  const docs = ['spec.md', 'plan.md', 'data-model.md'].map((f) => path.join(featureDir, f));
  const cdir = path.join(featureDir, 'contracts');
  if (fs.existsSync(cdir)) for (const f of fs.readdirSync(cdir)) if (f.endsWith('.md')) docs.push(path.join(cdir, f));
  let repoFiles = [];
  try { repoFiles = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean); } catch { return; }
  const allWrites = all.flatMap((t) => extractWrites(t.desc));
  const codeRe = /^[\w@.\/\-]+\.(?:tsx?|jsx?|mjs)$/;
  const skipRe = /(^|\/)(node_modules|dist|specs|__fixtures__)\/|\.(spec|test)\.|^@|^\.\.\//;
  const exists = (tok) => repoFiles.some((f) => f === tok || f.endsWith('/' + tok));
  const covered = (tok) => allWrites.some((w) => w === tok || w.endsWith('/' + tok) || tok.endsWith('/' + w)
    || (w.endsWith('/') && tok.includes('/') && ('/' + w).includes('/' + path.posix.dirname(tok) + '/')));
  const seen = new Set();
  for (const doc of docs) {
    if (!fs.existsSync(doc)) continue;
    for (const m of fs.readFileSync(doc, 'utf8').matchAll(/`([^`\n]+)`/g)) {
      const tok = m[1].trim().replace(/^\.\//, '');
      if (!codeRe.test(tok) || skipRe.test(tok) || seen.has(tok)) continue;
      seen.add(tok);
      if (!exists(tok) && !covered(tok)) ownerNotes.push(`⚠ sin dueño: ${tok} (citada por ${path.basename(doc)})`);
    }
  }
})();

// ---------- predecesores y niveles ----------
const warnings = [];
const preds = new Map();
for (const t of tasks) {
  const p = new Set();
  const earlier = tasks.filter((o) => o.order < t.order);
  const samePhase = earlier.filter((o) => o.phase === t.phase);
  if (t.phase.kind === 'block') earlier.filter((o) => o.phase.kind === 'block' && o.phase !== t.phase).forEach((o) => p.add(o.id));
  if (t.phase.kind === 'story') tasks.filter((o) => o.phase.kind === 'block' && o.order < t.order).forEach((o) => p.add(o.id));
  if (t.phase.kind === 'final') earlier.filter((o) => o.phase !== t.phase).forEach((o) => p.add(o.id));
  if (!t.parallel) samePhase.forEach((o) => p.add(o.id));
  t.explicit.forEach((d) => p.add(d));
  for (const dep of storyDeps[t.story] ?? []) tasks.filter((o) => o.story === dep && o.id !== t.id).forEach((o) => p.add(o.id));
  for (const o of earlier) if (o.writes.some((a) => t.writes.some((b) => conflict(a, b)))) p.add(o.id);
  preds.set(t.id, p);
}
const byId = new Map(tasks.map((t) => [t.id, t]));
const level = new Map();
const visiting = new Set();
function lvl(id) {
  if (level.has(id)) return level.get(id);
  if (visiting.has(id)) { warnings.push(`ciclo en ${id}: se ignora una arista`); return 0; }
  visiting.add(id);
  let m = 0;
  for (const p of preds.get(id)) m = Math.max(m, lvl(p) + 1);
  visiting.delete(id);
  level.set(id, m);
  return m;
}
tasks.forEach((t) => lvl(t.id));

// ---------- unidades (fusión de cadenas) ----------
const units = [];
const unitOf = new Map();
const ordered = [...tasks].sort((a, b) => level.get(a.id) - level.get(b.id) || a.order - b.order);
for (const t of ordered) {
  const L = level.get(t.id);
  let merged = false;
  if (L > 0 && !t.solo && !t.shared) {
    const top = [...preds.get(t.id)].filter((p) => level.get(p) === L - 1);
    if (top.length === 1) {
      const u = unitOf.get(top[0]);
      if (u && u.tasks[u.tasks.length - 1].id === top[0] && !u.shared && !u.solo && u.story === t.story && u.phase === t.phase) {
        const files = new Set([...u.writes, ...t.writes]);
        const othersOk = [...preds.get(t.id)].every((p) => u.tasks.some((x) => x.id === p) || unitOf.get(p).wave < u.wave);
        if (u.tasks.length < opt.groupTasks && files.size <= opt.groupFiles && othersOk) {
          u.tasks.push(t); t.writes.forEach((w) => u.writes.add(w)); unitOf.set(t.id, u); merged = true;
        }
      }
    }
  }
  if (!merged) {
    const u = { tasks: [t], writes: new Set(t.writes), wave: L, story: t.story, phase: t.phase, shared: t.shared, solo: t.solo, install: t.install };
    units.push(u); unitOf.set(t.id, u);
  }
}

// ---------- olas finales (shared 1/ola, solo aparte, tope --max) ----------
const byWave = new Map();
for (const u of units) { if (!byWave.has(u.wave)) byWave.set(u.wave, []); byWave.get(u.wave).push(u); }
const waves = [];
for (const w of [...byWave.keys()].sort((a, b) => a - b)) {
  const us = byWave.get(w).sort((a, b) => a.tasks[0].order - b.tasks[0].order);
  const regular = us.filter((u) => !u.solo);
  const solo = us.filter((u) => u.solo);
  for (let c = 0; c < regular.length; c += opt.max) waves.push(regular.slice(c, c + opt.max));
  for (const u of solo) waves.push([u]);
}
let n = 0;
for (const w of waves) for (const u of w) u.id = 'U' + String(++n).padStart(2, '0');

// ---------- salida ----------
fs.mkdirSync(path.join(runDir, 'units'), { recursive: true });
for (const f of fs.readdirSync(path.join(runDir, 'units'))) if (/^U\d+\.md$/.test(f)) fs.rmSync(path.join(runDir, 'units', f));
waves.forEach((w, i) => w.forEach((u) => {
  const md = [
    `# ${u.id} · ${u.tasks.map((t) => t.id).join(', ')}`,
    `feature_directory: ${featureDir}`,
    `ola: ${i + 1}/${waves.length}`,
    '',
    '## writes',
    ...(u.writes.size ? [...u.writes].map((p) => `- ${p}`) : ['- (sin rutas inferidas: el orquestador debe declararlas antes de lanzar)']),
    '',
    '## tareas',
    ...u.tasks.map((t) => t.raw),
    '',
    '## contexto',
    'Lee solo las secciones de plan.md, data-model.md y contracts/ que citan estas tareas. No leas tasks.md completo.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(runDir, 'units', `${u.id}.md`), md);
}));
fs.writeFileSync(path.join(runDir, 'schedule.json'), JSON.stringify({
  feature_directory: featureDir, max: opt.max,
  waves: waves.map((w, i) => ({ wave: i + 1, units: w.map((u) => ({ id: u.id, tasks: u.tasks.map((t) => t.id), writes: [...u.writes], shared: u.shared, solo: u.solo })) })),
  storyDeps, warnings, unowned: ownerNotes, proseDeps: proseNotes,
}, null, 1));

const width = Math.max(...waves.map((w) => w.length));
console.log(`schedule: ${tasks.length} tareas → ${n} unidades en ${waves.length} olas · hasta ${width} simultáneas (tope ${opt.max})`);
waves.forEach((w, i) => console.log(`O${i + 1} (${w.length}): ` + w.map((u) => `${u.id}[${u.tasks.map((t) => t.id).join('+')}]${u.shared ? '*' : ''}${u.solo ? '!' : ''}`).join(' ')));
const solos = tasks.filter((t) => t.writes.length === 0).map((t) => t.id);
const notes = [];
if (waves.some((w) => w.some((u) => u.shared))) notes.push('* = toca SHARED_FILES (nunca fusionada; solo conflictos de ruta la serializan)');
if (solos.length) notes.push(`! sin rutas inferidas (ola propia, declara sus writes): ${solos.join(' ')}`);
if (tasks.some((t) => t.install)) notes.push('! instalación/migración/generador: ola propia');
if (Object.keys(storyDeps).length) notes.push('historias: ' + Object.entries(storyDeps).map(([k, v]) => `${k}←${v.join(',')}`).join(' '));
const big = units.filter((u) => u.writes.size > opt.groupFiles).map((u) => u.id);
if (big.length) notes.push(`unidades con >${opt.groupFiles} archivos (riesgo de corte de pasos): ${big.join(' ')}`);
notes.push(...warnings);
const MAX_NOTES = 8;
if (ownerNotes.length) {
  notes.push(...ownerNotes.slice(0, MAX_NOTES));
  if (ownerNotes.length > MAX_NOTES) notes.push(`⚠ sin dueño: +${ownerNotes.length - MAX_NOTES} más (detalle en schedule.json)`);
}
notes.push(...proseNotes.slice(0, MAX_NOTES));
notes.forEach((x) => console.log('· ' + x));
console.log(`detalle: ${runDir}/units/Uxx.md · ${runDir}/schedule.json`);
