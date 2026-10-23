import { describe, expect, it } from 'vitest';
import { PROMPT_TRUNCATE_CODE_POINTS, SIMILARITY_THRESHOLD } from '../thresholds';
import {
  canonicalToolInput,
  codePointLength,
  extractFilePath,
  extractQuestionText,
  isWriteTool,
  jaccard,
  normalizeText,
  similaritySet,
  tokenCount,
  tokenize,
  truncateCodePoints,
} from '../text';

/** Tokens sintéticos normalizados para construir conjuntos con ratio exacto. */
const tokens = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`);

/**
 * Jaccard de dos conjuntos con `shared` tokens comunes y `extra` exclusivos de
 * cada lado; permite fijar ratios alrededor del umbral de 0,6 sin depender del
 * texto de un prompt real.
 */
const jaccardWith = (shared: number, onlyA: number, onlyB: number): number => {
  const common = tokens('comun', shared);
  return jaccard(
    new Set([...common, ...tokens('soloA', onlyA)]),
    new Set([...common, ...tokens('soloB', onlyB)]),
  );
};

/**
 * Contrato de texto de R4: normalización, tokens, similitud y canonicalización
 * acotada de herramientas. Todo es puro y determinista.
 */
describe('text', () => {
  describe('normalizeText', () => {
    it('quita acentos, marcas y mayúsculas', () => {
      expect(normalizeText('Compiláción de FUNCIÓN')).toBe(
        'compilacion de funcion',
      );
    });

    it('trata igual la forma compuesta y la descompuesta', () => {
      expect(normalizeText('cafe\u0301')).toBe('cafe');
      expect(normalizeText('CAFÉ')).toBe('cafe');
    });
  });

  describe('tokenize / tokenCount', () => {
    it('separa por cualquier carácter no alfanumérico', () => {
      expect(tokenize('Hola, ¿qué tal? — 2 archivos.')).toEqual([
        'hola',
        'que',
        'tal',
        '2',
        'archivos',
      ]);
      expect(tokenize('listo👍ahora')).toEqual(['listo', 'ahora']);
    });

    it('descarta vacíos y texto sin tokens', () => {
      expect(tokenize('   ')).toEqual([]);
      expect(tokenCount('   ')).toBe(0);
      expect(tokenCount('uno, dos... tres!')).toBe(3);
    });

    it('cuenta 5, 6 y 7 tokens incluyendo stopwords', () => {
      const five = 'uno dos tres cuatro cinco';
      expect(tokenCount(five)).toBe(5);
      expect(tokenCount(`${five} seis`)).toBe(6);
      expect(tokenCount(`${five} seis siete`)).toBe(7);
    });
  });

  describe('similaritySet', () => {
    it('quita stopwords es/en, acentos y mayúsculas', () => {
      expect(similaritySet('La FUNCIÓN del archivo y el TEST')).toEqual(
        new Set(['funcion', 'archivo', 'test']),
      );
      expect(similaritySet('The function of the file')).toEqual(
        new Set(['function', 'file']),
      );
    });

    it('excluye tokens de un solo carácter', () => {
      expect(similaritySet('a b c')).toEqual(new Set());
      expect(similaritySet('x de la y')).toEqual(new Set());
    });
  });

  describe('jaccard', () => {
    it('devuelve 0 con unión vacía y 1 con conjuntos idénticos', () => {
      expect(jaccardWith(0, 0, 0)).toBe(0);
      expect(jaccardWith(4, 0, 0)).toBe(1);
    });

    it('rodea el umbral 0,59 / 0,60 / 0,61 de INP-1', () => {
      const below = jaccardWith(10, 0, 7);
      const at = jaccardWith(3, 0, 2);
      const above = jaccardWith(11, 0, 7);

      expect(below).toBeCloseTo(0.59, 2);
      expect(below).toBeLessThan(SIMILARITY_THRESHOLD);

      expect(at).toBe(0.6);
      expect(at).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);

      expect(above).toBeCloseTo(0.61, 2);
      expect(above).toBeGreaterThan(SIMILARITY_THRESHOLD);
    });
  });

  describe('codePointLength / truncateCodePoints', () => {
    it('cuenta code points y no unidades UTF-16', () => {
      expect(codePointLength('a😀b')).toBe(3);
      expect(codePointLength('😀')).toBe(1);
    });

    it('recorta sin partir un emoji y usa el umbral de thresholds por defecto', () => {
      expect(truncateCodePoints('😀😀😀', 2)).toBe('😀😀');

      const long = 'x'.repeat(PROMPT_TRUNCATE_CODE_POINTS + 80);
      expect(truncateCodePoints(long)).toBe(
        truncateCodePoints(long, PROMPT_TRUNCATE_CODE_POINTS),
      );
      expect(codePointLength(truncateCodePoints(long))).toBe(
        PROMPT_TRUNCATE_CODE_POINTS,
      );
      expect(truncateCodePoints('corto')).toBe('corto');
    });
  });

  describe('isWriteTool', () => {
    it('reconoce las herramientas de escritura sin distinguir mayúsculas', () => {
      for (const name of [
        'write',
        'edit',
        'patch',
        'apply_patch',
        'multiedit',
        'WRITE',
        'Apply_Patch',
      ]) {
        expect(isWriteTool(name)).toBe(true);
      }
    });

    it('no asume escritura para bash ni otras tools', () => {
      for (const name of ['bash', 'read', 'question', 'form', 'write_file']) {
        expect(isWriteTool(name)).toBe(false);
      }
    });
  });

  describe('extractFilePath', () => {
    it('busca las claves declaradas y normaliza los separadores', () => {
      expect(extractFilePath({ filePath: 'src\\Domains\\A.ts' })).toBe(
        'src/Domains/A.ts',
      );
      expect(extractFilePath({ input: { file: 'src/b.ts' } })).toBe(
        'src/b.ts',
      );
      expect(extractFilePath({ filename: 'notas.md' })).toBe('notas.md');
    });

    it('respeta la prioridad de claves y la profundidad 4', () => {
      expect(
        extractFilePath({ filePath: 'a.ts', path: 'b.ts' }),
      ).toBe('a.ts');
      expect(
        extractFilePath({ a: { b: { c: { path: 'x.ts' } } } }),
      ).toBe('x.ts');
      expect(
        extractFilePath({ a: { b: { c: { d: { e: { path: 'x.ts' } } } } } }),
      ).toBeNull();
    });

    it('devuelve null si no hay una ruta de texto', () => {
      expect(extractFilePath({ other: 'x' })).toBeNull();
      expect(extractFilePath({ path: 42 })).toBeNull();
      expect(extractFilePath(null)).toBeNull();
      expect(extractFilePath('src/a.ts')).toBeNull();
    });

    it('recorre arrays anidados hasta encontrar la ruta', () => {
      expect(
        extractFilePath({
          files: [{ name: 'a' }, { filePath: 'src\\Domains\\A.ts' }],
        }),
      ).toBe('src/Domains/A.ts');
      expect(extractFilePath([{ nested: [{ path: '/repo/b.ts' }] }])).toBe(
        '/repo/b.ts',
      );
      expect(extractFilePath({ files: [] })).toBeNull();
    });
  });

  describe('extractQuestionText', () => {
    it('concatena title/question/header/prompt, incluso anidados', () => {
      expect(
        extractQuestionText({
          title: 'Elige',
          questions: [{ question: '¿Cuál?', header: 'Detalle' }],
        }),
      ).toBe('Elige ¿Cuál? Detalle');
      expect(
        extractQuestionText({ input: { questions: [{ header: 'H' }] } }),
      ).toBe('H');
    });

    it('devuelve vacío si no hay texto extraíble', () => {
      expect(extractQuestionText({ other: 'sin texto' })).toBe('');
      expect(extractQuestionText({ prompt: '   ' })).toBe('');
      expect(extractQuestionText(null)).toBe('');
    });
  });

  describe('canonicalToolInput', () => {
    it('ordena claves y es estable entre ejecuciones', () => {
      expect(canonicalToolInput({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
      expect(canonicalToolInput({ b: 2, a: 1 })).toBe(
        canonicalToolInput({ a: 1, b: 2 }),
      );
      expect(
        canonicalToolInput({ input: { z: [1, 2], a: 'x' } }),
      ).toBe('{"input":{"a":"x","z":[1,2]}}');
    });

    it('acota strings a 256 code points, arrays a 20 y el total a 1000', () => {
      const longString = canonicalToolInput('a'.repeat(400));
      expect(JSON.parse(longString)).toHaveLength(256);

      const manyItems = Array.from({ length: 25 }, (_, index) => index);
      expect(canonicalToolInput(manyItems)).toBe(
        canonicalToolInput(manyItems.slice(0, 20)),
      );

      const huge = canonicalToolInput({
        items: Array.from({ length: 20 }, () => '😀'.repeat(100)),
      });
      expect(codePointLength(huge)).toBeLessThanOrEqual(1000);
    });

    it('corta la profundidad mayor que 4 sin lanzar', () => {
      const canonical = canonicalToolInput({
        a: { b: { c: { d: { e: 'profundo' } } } },
      });
      expect(canonical).not.toContain('profundo');
      expect(canonicalToolInput({ a: { b: { c: { d: null } } } })).toBe(
        '{"a":{"b":{"c":{"d":null}}}}',
      );
    });

    it('serializa escalares de forma estable', () => {
      expect(canonicalToolInput({ z: null, n: 1.5, ok: true })).toBe(
        '{"n":1.5,"ok":true,"z":null}',
      );
    });
  });
});
