/**
 * Utilidades de texto del motor de eficiencia (R4): normalización, similitud,
 * longitud en code points, detección de escritura y canonicalización acotada de
 * entradas de herramienta. Sin dependencias del SDK ni del DOM.
 */
import { PROMPT_TRUNCATE_CODE_POINTS } from './thresholds';

/** Stopwords es/en ya normalizadas (sin acentos) para el conjunto de similitud. */
const STOPWORDS: ReadonlySet<string> = new Set([
  // Español
  'a',
  'al',
  'algo',
  'algun',
  'alguna',
  'algunas',
  'alguno',
  'algunos',
  'ante',
  'antes',
  'como',
  'con',
  'contra',
  'cual',
  'cuales',
  'cuando',
  'de',
  'del',
  'desde',
  'donde',
  'durante',
  'e',
  'el',
  'ella',
  'ellas',
  'ello',
  'ellos',
  'en',
  'entre',
  'era',
  'eran',
  'eres',
  'es',
  'esa',
  'esas',
  'ese',
  'eso',
  'esos',
  'esta',
  'estaba',
  'estais',
  'estamos',
  'estan',
  'estar',
  'estas',
  'este',
  'esto',
  'estos',
  'estoy',
  'fue',
  'fueron',
  'ha',
  'habia',
  'habian',
  'han',
  'has',
  'hasta',
  'hay',
  'he',
  'hemos',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'mas',
  'me',
  'mi',
  'mis',
  'mucho',
  'muchos',
  'muy',
  'nada',
  'ni',
  'no',
  'nos',
  'nosotros',
  'o',
  'os',
  'otra',
  'otras',
  'otro',
  'otros',
  'para',
  'pero',
  'poco',
  'por',
  'porque',
  'que',
  'quien',
  'quienes',
  'se',
  'sea',
  'ser',
  'si',
  'sin',
  'sobre',
  'son',
  'su',
  'sus',
  'te',
  'todo',
  'todos',
  'tu',
  'tus',
  'un',
  'una',
  'unas',
  'uno',
  'unos',
  'vosotros',
  'y',
  'ya',
  'yo',
  // English
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
]);

/** Nombres de herramienta que escriben archivos (R4, case-insensitive). */
const WRITE_TOOL_NAMES: ReadonlySet<string> = new Set([
  'write',
  'edit',
  'patch',
  'apply_patch',
  'multiedit',
]);

/** Claves donde se busca la ruta de archivo, en orden de prioridad (R4). */
const FILE_PATH_KEYS: readonly string[] = [
  'filePath',
  'filepath',
  'path',
  'file',
  'filename',
];

/** Claves donde se busca el texto de una pregunta al usuario (R4). */
const QUESTION_TEXT_KEYS: ReadonlySet<string> = new Set([
  'title',
  'question',
  'header',
  'prompt',
]);

/** Profundidad máxima de búsqueda y canonicalización (R4). */
const MAX_DEPTH = 4;
/** Límite de code points por string canónico (R4). */
const MAX_CANONICAL_STRING = 256;
/** Límite de elementos de un array canónico (R4). */
const MAX_CANONICAL_ARRAY = 20;
/** Límite total del input canónico (R4). */
const MAX_CANONICAL_LENGTH = 1000;

/** Longitud en code points, sin partir emojis ni caracteres compuestos (R4). */
export const codePointLength = (text: string): number =>
  Array.from(text).length;

/**
 * Recorta a `limit` code points. El valor por defecto es el de la vista
 * (`PROMPT_TRUNCATE_CODE_POINTS`), sin duplicar el número.
 */
export const truncateCodePoints = (
  text: string,
  limit = PROMPT_TRUNCATE_CODE_POINTS,
): string => {
  const codePoints = Array.from(text);
  return codePoints.length <= limit
    ? text
    : codePoints.slice(0, limit).join('');
};

/** Normaliza a NFD, elimina marcas diacríticas y pasa a minúsculas (R4). */
export const normalizeText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** Divide en tokens alfanuméricos normalizados, descartando vacíos (R4). */
export const tokenize = (text: string): string[] =>
  normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);

/** Número total de tokens (longitud ≥ 1) para el umbral de 6 (R4). */
export const tokenCount = (text: string): number => tokenize(text).length;

/**
 * Conjunto de similitud: tokens con longitud ≥ 2 y sin stopwords es/en (R4).
 */
export const similaritySet = (text: string): Set<string> =>
  new Set(
    tokenize(text).filter(
      (token) =>
        codePointLength(token) >= 2 && !STOPWORDS.has(token),
    ),
  );

/** Jaccard sobre conjuntos; unión vacía ⇒ 0 (R4). */
export const jaccard = (
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number => {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of union) {
    if (a.has(token) && b.has(token)) intersection += 1;
  }
  return intersection / union.size;
};

/** ¿La herramienta escribe archivos? Comparación case-insensitive (R4). */
export const isWriteTool = (name: string): boolean =>
  WRITE_TOOL_NAMES.has(name.toLowerCase());

/**
 * Extrae la primera ruta de archivo del input de una herramienta (R4):
 * claves `filePath`/`filepath`/`path`/`file`/`filename`, profundidad ≤ 4 y
 * separadores normalizados a `/`.
 */
export const extractFilePath = (input: unknown): string | null => {
  const visit = (value: unknown, depth: number): string | null => {
    if (depth > MAX_DEPTH || value === null || typeof value !== 'object') {
      return null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item, depth + 1);
        if (found !== null) return found;
      }
      return null;
    }
    const record = value as Record<string, unknown>;
    for (const key of FILE_PATH_KEYS) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.replaceAll('\\', '/');
      }
    }
    for (const child of Object.values(record)) {
      const found = visit(child, depth + 1);
      if (found !== null) return found;
    }
    return null;
  };
  return visit(input, 0);
};

/**
 * Concatena el texto extraíble de una pregunta (`title`, `question`, `header`,
 * `prompt`) a profundidad ≤ 4; vacío si no hay texto (R4).
 */
export const extractQuestionText = (input: unknown): string => {
  const texts: string[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (depth > MAX_DEPTH || value === null || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        QUESTION_TEXT_KEYS.has(key) &&
        typeof child === 'string' &&
        child.trim().length > 0
      ) {
        texts.push(child.trim());
      }
      visit(child, depth + 1);
    }
  };
  visit(input, 0);
  return texts.join(' ');
};

const canonicalValue = (value: unknown, depth: number): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    return JSON.stringify(truncateCodePoints(value, MAX_CANONICAL_STRING));
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (typeof value !== 'object') return 'null';
  if (depth >= MAX_DEPTH) return 'null';
  if (Array.isArray(value)) {
    return `[${value
      .slice(0, MAX_CANONICAL_ARRAY)
      .map((item) => canonicalValue(item, depth + 1))
      .join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalValue(record[key], depth + 1)}`,
    );
  return `{${entries.join(',')}}`;
};

/**
 * Serializa una entrada de herramienta de forma estable y acotada (R4): claves
 * ordenadas, profundidad ≤ 4, strings ≤ 256 code points, arrays ≤ 20 elementos
 * y total ≤ 1 000 code points.
 */
export const canonicalToolInput = (input: unknown): string =>
  truncateCodePoints(canonicalValue(input, 0), MAX_CANONICAL_LENGTH);
