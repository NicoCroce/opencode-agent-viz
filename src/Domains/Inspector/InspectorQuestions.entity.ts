import type {
  TQuestionEntry,
  TQuestionField,
  TQuestionOption,
  TQuestionState,
} from '@app/Application/Helpers/questionState';

/**
 * Tipos de pregunta y permisos del Inspector (FR-031..FR-033).
 *
 * Los view-models de pregunta (`TQuestionState`, `TQuestionOption`,
 * `TQuestionField`, `TQuestionEntry`) son la fuente única compartida con
 * `History` (`Application/Helpers/questionState`, Familia 6/SH-07); se
 * re-exportan para que el contrato del Inspector siga exponiéndolos sin
 * duplicar la definición.
 */
export type {
  TQuestionEntry,
  TQuestionField,
  TQuestionOption,
  TQuestionState,
};

/** Permiso que una ejecución está esperando (FR-031). */
export interface TPermissionEntry {
  id: string;
  /** Operación afectada. */
  action: string;
  /** Recursos afectados por la operación. */
  resources: string[];
  /** Motivo textual si el servidor lo reporta (FR-038). */
  message: string | null;
}

/** Resultado de `useSessionForms` (preguntas + estados de pantalla). */
export interface TSessionFormsResult {
  questions: TQuestionEntry[];
  isError: boolean;
  isLoading: boolean;
}

/** Resultado de `useSessionPermissions` (permisos + estados de pantalla). */
export interface TSessionPermissionsResult {
  permissions: TPermissionEntry[];
  isError: boolean;
  isLoading: boolean;
}
