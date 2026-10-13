import type {
  FormDetail,
  FormFields,
  FormInfo,
  PermissionRequest,
} from '@opencode/client';
import type { TAttentionItem } from '@app/Domains/Chat';

/**
 * Builders de fixtures para los specs de Infrastructure (feature 012).
 *
 * Viven junto a los specs (`lib/specs/`) porque son datos de prueba, no de
 * producción: reproducen la forma exacta de los tipos del SDK
 * (`PermissionRequest`, `FormInfo`, `FormDetail`) y del view-model
 * `TAttentionItem` sin redefinirlos (Constitución IV). Cada builder parte de
 * valores estables y deterministas —sin reloj ni azar— y exige la identidad
 * (`id`/`sessionID`) por argumento para que ningún test dependa de ids
 * "mágicos" implícitos. Las colecciones se crean en cada llamada, de modo que
 * mutar el resultado de un fixture no filtra estado entre pruebas.
 */

/** Instante por defecto de `TAttentionItem.at` (determinista). */
export const FIXTURE_AT = 1_000;

/**
 * Campos por defecto de un formulario: un `string` con `options` y un
 * `multiselect`, que son los dos tipos que la proyección `FormInfo →
 * TQuestionEntry` debe mapear (string/multiselect exponen `options`). Devuelve
 * un array nuevo por llamada para no compartir referencias entre fixtures.
 */
export const formFields = (): FormFields => [
  {
    key: 'reason',
    title: 'Motivo',
    type: 'string',
    options: [
      { value: 'ok', label: 'Correcto' },
      { value: 'redo', label: 'Rehacer' },
    ],
  },
  {
    key: 'choice',
    title: 'Opción',
    type: 'multiselect',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
  },
];

/**
 * Builder de `PermissionRequest`. `id` y `sessionID` son obligatorios y
 * explícitos (identidad del pendiente y de su sesión de origen); el resto se
 * sobrescribe por argumento.
 */
export const permissionRequest = (
  overrides: Partial<PermissionRequest> &
    Pick<PermissionRequest, 'id' | 'sessionID'>,
): PermissionRequest => ({
  action: 'bash',
  resources: ['echo hi'],
  ...overrides,
});

/**
 * Builder de `FormInfo` (forma cruda cacheada por el grafo, sin
 * `state`/`answer`). `id` y `sessionID` son obligatorios y explícitos.
 */
export const formInfo = (
  overrides: Partial<FormInfo> & Pick<FormInfo, 'id' | 'sessionID'>,
): FormInfo => ({
  title: '¿Aplicar el cambio?',
  fields: formFields(),
  ...overrides,
});

/**
 * Builder de `FormDetail` (formulario con `state`). Por defecto `pending`; pasa
 * `state` en `overrides` para las variantes `answered`/`cancelled`. `id` y
 * `sessionID` son obligatorios y explícitos.
 */
export const formDetail = (
  overrides: Partial<FormDetail> & Pick<FormDetail, 'id' | 'sessionID'>,
): FormDetail => ({
  title: '¿Aplicar el cambio?',
  fields: formFields(),
  state: { status: 'pending' },
  ...overrides,
});

/**
 * Builder de `TAttentionItem` (fuente única de badge/banner/toast/realce).
 * `id` y `sessionId` son obligatorios y explícitos; por defecto es un permiso
 * sin nodo asociado (`nodeId: null`) en un instante fijo.
 */
export const attentionItem = (
  overrides: Partial<TAttentionItem> & Pick<TAttentionItem, 'id' | 'sessionId'>,
): TAttentionItem => ({
  kind: 'permission',
  nodeId: null,
  title: 'Permiso de bash',
  at: FIXTURE_AT,
  ...overrides,
});
