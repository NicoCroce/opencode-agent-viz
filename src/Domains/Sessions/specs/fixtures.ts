import type { SessionInfo } from '@opencode/client';
import type { TRootSessionItem, TSessionGroup } from '../Hooks/useRootSessions';

/**
 * Builders de fixtures para los specs del dominio `Sessions` (feature 005).
 *
 * Los campos que dirigen el filtrado —`location.directory` (proyecto) y
 * `time.updated` (última actividad, FR-009)— son siempre controlables, de modo
 * que los specs de rango, intersección y grupos vacíos no dependan del reloj
 * real ni de datos "mágicos".
 */

/** Directorio de proyecto por defecto para fixtures que no fijan uno. */
export const FIXTURE_DIRECTORY = '/Users/dev/proj';

/** Marca temporal por defecto para `time.created` y `time.updated`. */
export const FIXTURE_TIME = 1_000;

/**
 * Secuencia de ids autogenerados. Es determinista dentro de un mismo fichero
 * de test (Vitest aísla el módulo por fichero); los specs que asertan sobre un
 * id o título concretos deben pasarlos explícitamente.
 */
let sessionSeq = 0;

const nextSessionId = (): string => {
  sessionSeq += 1;
  return `ses_${sessionSeq}`;
};

export interface SessionFixtureOptions {
  /** Id de la sesión. Por defecto, autogenerado (`ses_1`, `ses_2`, …). */
  id?: string;
  /** Proyecto de la sesión (`location.directory`); decide a qué grupo pertenece. */
  directory?: string;
  /** Última actividad (`time.updated`), en ms. Base de la evaluación de rango. */
  updated?: number;
  /** Creación (`time.created`), en ms. */
  created?: number;
  /** Título visible. Por defecto, `session <id>`. */
  title?: string;
  /** Id de la sesión padre; fija una sesión no raíz si se indica. */
  parentID?: string;
  /** Proyecto del servidor (`projectID`). */
  projectID?: string;
  /** Agente asociado (`SessionInfo.agent`). */
  agent?: string;
}

/**
 * Construye una `SessionInfo` con todos los campos requeridos por el SDK y
 * `time` / `location.directory` controlables.
 */
export const buildSession = (
  options: SessionFixtureOptions = {},
): SessionInfo => {
  const id = options.id ?? nextSessionId();
  return {
    id,
    parentID: options.parentID,
    projectID: options.projectID ?? 'proj',
    agent: options.agent,
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: {
      created: options.created ?? FIXTURE_TIME,
      updated: options.updated ?? FIXTURE_TIME,
    },
    location: { directory: options.directory ?? FIXTURE_DIRECTORY },
    title: options.title ?? `session ${id}`,
  };
};

export interface RootSessionItemFixtureOptions extends SessionFixtureOptions {
  /**
   * Nombre del agente mostrado en la tarjeta; `null` = no disponible. Si se
   * omite, hereda `session.agent` (mismo criterio que `useRootSessions`).
   */
  agentName?: string | null;
}

/**
 * Construye un `TRootSessionItem` (sesión + nombre de agente) que alimenta
 * `TSessionGroup.items`.
 */
export const buildRootSessionItem = (
  options: RootSessionItemFixtureOptions = {},
): TRootSessionItem => {
  const { agentName, ...sessionOptions } = options;
  const session = buildSession(sessionOptions);
  return {
    session,
    agentName: agentName !== undefined ? agentName : (session.agent ?? null),
  };
};

export interface SessionGroupFixtureOptions {
  /** Directorio del grupo (`group.directory`); clave del filtro de proyecto. */
  directory: string;
  /** Items ya construidos. Tiene prioridad sobre `sessions`. */
  items?: TRootSessionItem[];
  /**
   * Atajo: cada entrada se construye con `buildRootSessionItem`, heredando el
   * `directory` del grupo (salvo que la sesión fije el suyo).
   */
  sessions?: RootSessionItemFixtureOptions[];
}

/**
 * Construye un `TSessionGroup`. Sin `items` ni `sessions` produce un grupo
 * vacío, útil para verificar que el filtrado descarta grupos sin sesiones
 * (FR-017).
 */
export const buildSessionGroup = ({
  directory,
  items,
  sessions,
}: SessionGroupFixtureOptions): TSessionGroup => ({
  directory,
  items:
    items ??
    (sessions ?? []).map((session) =>
      buildRootSessionItem({ directory, ...session }),
    ),
});

/** Descripción compacta de un grupo para `buildSessionGroups`. */
export interface SessionGroupsFixtureSpec {
  directory: string;
  sessions?: RootSessionItemFixtureOptions[];
}

/** Construye una lista de grupos preservando el orden de entrada (FR-020). */
export const buildSessionGroups = (
  specs: SessionGroupsFixtureSpec[],
): TSessionGroup[] => specs.map((spec) => buildSessionGroup(spec));
