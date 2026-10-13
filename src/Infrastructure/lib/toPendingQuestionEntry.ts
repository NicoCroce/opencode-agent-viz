import type { FormInfo } from '@opencode/client';
import type { TQuestionEntry } from '@app/Application/Helpers/questionState';

/**
 * Proyección `FormInfo` → `TQuestionEntry` para las preguntas del **subárbol**
 * que compone la bandeja (T074, FR-007). La pregunta se trata como pendiente por
 * construcción: la única fuente (`useSessionAttention`) solo produce ítems de
 * pregunta para nodos en `waiting-input`, así que `state` es `'pending'` y no hay
 * respuesta. Los campos/opciones se derivan con la misma regla que
 * `toQuestionEntry` del Inspector, sin importar su `lib` interna (Principio II:
 * nada de deep-imports entre dominios).
 *
 * Función **pura**: no consulta ni muta sus entradas (FR-013).
 */
export const toPendingQuestionEntry = (form: FormInfo): TQuestionEntry => ({
  id: form.id,
  title: form.title,
  fields: form.fields.map((field) => ({
    key: field.key,
    title: field.title ?? null,
    type: field.type,
    options:
      field.type === 'string' || field.type === 'multiselect'
        ? (field.options ?? []).map((option) => ({
            value: option.value,
            label: option.label,
          }))
        : [],
  })),
  state: 'pending',
  answer: null,
});
