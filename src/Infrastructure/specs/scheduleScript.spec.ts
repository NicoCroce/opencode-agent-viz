/**
 * Reglas de parseo de `.opencode/scripts/bash/schedule.mjs` (U01 del chore de
 * tooling): cada tarea de `tasks.md` se lee como **bloque multilínea** —desde
 * `- [ ] T###` hasta la primera línea vacía, otra tarea, otro heading, una línea
 * `**Bold**`, `---` o una fila de tabla—, y de ese bloque completo salen los
 * `writes:` entre backticks y las dependencias explícitas; el bloque entero
 * (`raw`) es lo que se escribe en cada `Uxx.md` bajo `## tareas`.
 *
 * `schedule.mjs` es un script de Node, no un módulo importable: cada caso lo
 * **ejecuta de verdad** (`execFileSync`) sobre un `tasks.md` de fixture creado en
 * un directorio temporal (`mkdtempSync(os.tmpdir())`, nunca dentro del repo) y
 * con `--run-dir` apuntando a ese mismo temporal. Se pasa
 * `--group-tasks 1 --group-files 1` para aislar el parseo de la fusión de
 * cadenas: así hay exactamente una unidad por tarea y las olas del
 * `schedule.json` reflejan solo las aristas calculadas.
 *
 * El fixture reproduce el formato real de
 * `specs/014-inspector-detail-tabs/tasks.md`: `writes:` en la primera línea y en
 * una línea de continuación, `Depende de Txxx` al final del bloque, tareas `[P]`,
 * dos tareas que solapan fichero (conflicto de archivo) y prosa con menciones a
 * tareas dentro y fuera de los bloques.
 *
 * Casos cubiertos: (a) `writes:` inferidos de la línea de continuación;
 * (b) la dependencia del final del bloque se aplica como arista; (c) cada
 * `Uxx.md` conserva el bloque completo y no absorbe la línea `**Bold**` que lo
 * cierra; (d) una mención dentro del bloque no se convierte en dependencia en
 * prosa, mientras que la prosa fuera de los bloques sí; (e) conflicto de archivo
 * en la misma fase; (f) **caso negativo**: una tarea sin `writes:` inferidos sale
 * con `!` (ola propia) y su `Uxx.md` avisa de que el orquestador debe
 * declararlos; (g) sin tareas pendientes el script termina con «Sin tareas
 * pendientes» y exit 0.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = process.cwd();
const SCRIPT = path.join(REPO_ROOT, '.opencode/scripts/bash/schedule.mjs');

/** Una unidad por tarea: el parseo se observa sin la fusión de cadenas. */
const NO_GROUPING = ['--group-tasks', '1', '--group-files', '1'];

/**
 * Fixture del caso principal. Las constantes de fragmentos que usan las
 * aserciones viven aquí al lado para que el texto del fixture y lo que se
 * espera de él no se puedan desincronizar.
 */
const FIXTURE_LINES = [
  '# Tasks: fixture de parseo del schedule',
  '',
  '## Phase 1: Setup (línea base del fixture)',
  '',
  '- [ ] T001 [P] (writes: `src/Domains/Inspector/Components/Alpha.tsx`) Crear Alpha y su hook: la primera línea',
  '  declara un fichero y la línea de continuación declara el otro `src/Domains/Inspector/Hooks/useAlpha.ts`,',
  '  que es la que debe inferirse como write del bloque completo.',
  '**Checkpoint**: Alpha lista (no pertenece al bloque de T001).',
  '',
  '## Phase 2: User Story 1 - Cadenas del fixture',
  '',
  '- [ ] T002 [P] [US1] (writes: `src/Domains/Inspector/Components/Beta.tsx`) Crear Beta con un bloque de tres',
  '  líneas de continuación; la última menciona en prosa interna `T006 antes de T007`, que no debe contar',
  '  como dependencia en prosa porque vive dentro del bloque de la tarea.',
  '- [ ] T003 [P] [US1] (writes: `src/Domains/Inspector/Hooks/useBeta.ts`) Crear el hook de Beta.',
  '  Depende de T002.',
  '- [ ] T004 [P] [US1] (writes: `src/Domains/Inspector/Components/Gamma.tsx`) Crear Gamma.',
  '- [ ] T005 [P] [US1] (writes: `src/Domains/Inspector/Components/Delta.tsx`) Crear Delta.',
  '- [ ] T006 [P] [US1] (writes: `src/Domains/Inspector/Components/Epsilon.tsx`) Crear Epsilon.',
  '- [ ] T007 [P] [US1] (writes: `src/Domains/Inspector/Components/Zeta.tsx`) Crear Zeta.',
  '- [ ] T008 [P] [US1] (writes: `src/Domains/Inspector/Components/Epsilon.tsx`) Ampliar Epsilon: solapa',
  '  fichero con T006 dentro de la misma fase (conflicto de archivo).',
  '',
  '## Phase 3: Polish (cierre del fixture)',
  '',
  '- [ ] T009 Revisar el cierre del fixture, sin rutas entre backticks ni ficheros que declarar.',
  '',
  'T004 antes de T005',
  '',
];
const FIXTURE = FIXTURE_LINES.join('\n');

/** Primer fichero de T001 (primera línea del bloque). */
const ALPHA_PATH = 'src/Domains/Inspector/Components/Alpha.tsx';
/** Segundo fichero de T001: solo aparece en la línea de continuación. */
const USE_ALPHA_PATH = 'src/Domains/Inspector/Hooks/useAlpha.ts';
/** Cola exacta de la última línea de continuación del bloque de T001. */
const T001_TAIL = 'que es la que debe inferirse como write del bloque completo.';
/** Cola exacta de la última línea de continuación del bloque de T002. */
const T002_TAIL =
  'como dependencia en prosa porque vive dentro del bloque de la tarea.';
/** Texto de la línea `**Bold**` que cierra el bloque de T001. */
const CHECKPOINT_TEXT = 'Alpha lista (no pertenece al bloque de T001).';

interface TScheduleUnit {
  id: string;
  tasks: string[];
  writes: string[];
  shared: boolean;
  solo: boolean;
}

interface TSchedule {
  feature_directory: string;
  waves: { wave: number; units: TScheduleUnit[] }[];
  storyDeps: Record<string, string[]>;
  warnings: string[];
  unowned: string[];
  proseDeps: string[];
}

interface TRun {
  tasksFile: string;
  runDir: string;
  stdout: string;
  schedule: TSchedule;
  unitMd: (unitId: string) => string;
}

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

const makeTempDir = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

/** Ejecuta el script real sobre `tasksMd` y devuelve su salida y su `run-dir`. */
const runSchedule = (tasksMd: string, extraArgs = NO_GROUPING): TRun => {
  const dir = makeTempDir('schedule-spec-');
  const tasksFile = path.join(dir, 'tasks.md');
  fs.writeFileSync(tasksFile, tasksMd);
  const runDir = path.join(dir, 'run');

  const stdout = execFileSync(
    'node',
    [SCRIPT, tasksFile, '--run-dir', runDir, ...extraArgs],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );

  const schedulePath = path.join(runDir, 'schedule.json');
  const schedule = JSON.parse(
    fs.readFileSync(schedulePath, 'utf8'),
  ) as TSchedule;

  return {
    tasksFile,
    runDir,
    stdout,
    schedule,
    unitMd: (unitId: string) =>
      fs.readFileSync(path.join(runDir, 'units', `${unitId}.md`), 'utf8'),
  };
};

/** Unidad que contiene la tarea (con `--group-tasks 1` es 1:1). */
const unitWithTask = (schedule: TSchedule, taskId: string): TScheduleUnit => {
  for (const wave of schedule.waves) {
    const unit = wave.units.find((candidate) =>
      candidate.tasks.includes(taskId),
    );
    if (unit) return unit;
  }
  throw new Error(`Ninguna unidad contiene ${taskId}`);
};

/** Número de ola (1-based) en el que sale la tarea. */
const waveWithTask = (schedule: TSchedule, taskId: string): number => {
  const wave = schedule.waves.find((candidate) =>
    candidate.units.some((unit) => unit.tasks.includes(taskId)),
  );
  if (!wave) throw new Error(`Ninguna ola contiene ${taskId}`);
  return wave.wave;
};

describe('schedule.mjs — bloques multilínea de tasks.md (U01)', () => {
  let run: TRun;

  beforeAll(() => {
    run = runSchedule(FIXTURE);
  });

  it('infiere los writes declarados en una línea de continuación del bloque', () => {
    const unit = unitWithTask(run.schedule, 'T001');

    // El primer fichero viene de la primera línea y el segundo solo de la
    // continuación: si el parseo se quedara en la primera línea, faltaría.
    expect(unit.writes).toEqual([ALPHA_PATH, USE_ALPHA_PATH]);
    expect(FIXTURE_LINES[4]).toContain(ALPHA_PATH);
    expect(FIXTURE_LINES[4]).not.toContain('useAlpha');

    // El `Uxx.md` de la unidad declara los dos writes.
    const md = run.unitMd(unit.id);
    expect(md).toContain('## writes');
    expect(md).toContain(`- ${ALPHA_PATH}`);
    expect(md).toContain(`- ${USE_ALPHA_PATH}`);
  });

  it('aplica como arista la dependencia declarada al final del bloque', () => {
    // T003 es `[P]` en la misma fase que T002: la única arista posible es el
    // «Depende de T002.» del final de su bloque.
    expect(waveWithTask(run.schedule, 'T003')).toBeGreaterThan(
      waveWithTask(run.schedule, 'T002'),
    );
    expect(run.schedule.warnings).toEqual([]);

    // La dependencia es la del bloque, no de una línea de prosa suelta.
    expect(run.schedule.proseDeps.join(' ')).not.toContain('T003');
  });

  it('escribe el bloque completo en el Uxx.md, sin truncar y sin absorber el **Bold**', () => {
    const md = run.unitMd(unitWithTask(run.schedule, 'T001').id);

    expect(md).toContain('## tareas');
    // Primera línea y última línea de continuación, íntegras.
    expect(md).toContain(`- [ ] T001 [P] (writes: \`${ALPHA_PATH}\`)`);
    expect(md).toContain(`\`${USE_ALPHA_PATH}\`,`);
    expect(md).toContain(T001_TAIL);

    // La línea `**Bold**` cierra el bloque: no es contenido de la tarea.
    expect(md).not.toContain('**Checkpoint**');
    expect(md).not.toContain(CHECKPOINT_TEXT);

    // El bloque de tres líneas de continuación también llega entero.
    const betaMd = run.unitMd(unitWithTask(run.schedule, 'T002').id);
    expect(betaMd).toContain('Crear Beta con un bloque de tres');
    expect(betaMd).toContain(T002_TAIL);
  });

  it('no convierte en dependencia una mención dentro del bloque, pero sí la prosa exterior', () => {
    // «T006 antes de T007» vive dentro del bloque de T002: se ignora.
    expect(run.schedule.proseDeps).toHaveLength(1);
    expect(run.schedule.proseDeps[0]).toContain('T005');
    expect(run.schedule.proseDeps[0]).toContain('T004');
    expect(run.schedule.proseDeps.join(' ')).not.toContain('T007');

    // La prosa exterior «T004 antes de T005» sí ordena las olas…
    expect(waveWithTask(run.schedule, 'T005')).toBeGreaterThan(
      waveWithTask(run.schedule, 'T004'),
    );
    // …y T006/T007 siguen en la misma ola, sin arista entre ellos.
    expect(waveWithTask(run.schedule, 'T006')).toBe(
      waveWithTask(run.schedule, 'T007'),
    );
    expect(waveWithTask(run.schedule, 'T006')).toBeLessThan(
      waveWithTask(run.schedule, 'T005'),
    );
  });

  it('serializa en olas distintas dos tareas [P] de la misma fase que solapan fichero', () => {
    const epsilon = 'src/Domains/Inspector/Components/Epsilon.tsx';

    expect(unitWithTask(run.schedule, 'T006').writes).toEqual([epsilon]);
    expect(unitWithTask(run.schedule, 'T008').writes).toEqual([epsilon]);
    expect(waveWithTask(run.schedule, 'T008')).toBeGreaterThan(
      waveWithTask(run.schedule, 'T006'),
    );
  });

  it('marca con ! la tarea sin writes inferidos y avisa de que hay que declararlos', () => {
    const unit = unitWithTask(run.schedule, 'T009');

    expect(unit.writes).toEqual([]);
    expect(unit.solo).toBe(true);
    // Ola propia: la unidad está sola en su ola.
    const wave = run.schedule.waves.find((candidate) =>
      candidate.units.some((candidate2) => candidate2.id === unit.id),
    );
    expect(wave?.units).toHaveLength(1);

    // Señal en stdout y aviso en el `Uxx.md` que lee el orquestador.
    expect(run.stdout).toMatch(/O\d+ \(1\): U\d+\[T009\]!/);
    expect(run.stdout).toContain('sin rutas inferidas');
    expect(run.stdout).toContain('T009');
    expect(run.unitMd(unit.id)).toContain(
      'el orquestador debe declararlas antes de lanzar',
    );
  });
});

describe('schedule.mjs — sin tareas pendientes (U01)', () => {
  it('termina con «Sin tareas pendientes» y exit 0, sin crear el run-dir', () => {
    const dir = makeTempDir('schedule-spec-done-');
    const tasksFile = path.join(dir, 'tasks.md');
    const runDir = path.join(dir, 'run');
    fs.writeFileSync(
      tasksFile,
      [
        '# Tasks: fixture ya completado',
        '',
        '## Phase 1: Setup',
        '',
        '- [X] T001 [P] (writes: `src/Domains/Inspector/Components/Alpha.tsx`) Ya hecha.',
        '- [x] T002 (writes: `src/Domains/Inspector/Hooks/useAlpha.ts`) Ya hecha también.',
        '',
      ].join('\n'),
    );

    const stdout = execFileSync(
      'node',
      [SCRIPT, tasksFile, '--run-dir', runDir],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );

    expect(stdout).toContain('Sin tareas pendientes en');
    expect(stdout).toContain(tasksFile);
    expect(fs.existsSync(runDir)).toBe(false);
  });
});
