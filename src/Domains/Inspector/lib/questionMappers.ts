import type {
  FormAnswer,
  FormDetail,
  FormField,
  FormValue,
  PermissionRequest,
} from '@opencode/client';
import type {
  TPermissionEntry,
  TQuestionEntry,
  TQuestionOption,
} from '../Inspector.entity';

/** Opciones ofrecidas por un campo (solo `string`/`multiselect`, FR-032). */
export const fieldOptions = (field: FormField): TQuestionOption[] => {
  if (field.type !== 'string' && field.type !== 'multiselect') return [];
  return (field.options ?? []).map((option) => ({
    value: option.value,
    label: option.label,
  }));
};

export const formatFormValue = (value: FormValue): string =>
  Array.isArray(value) ? value.join(', ') : String(value);

/** Respuesta de un formulario como texto legible (`campo: valor`). */
export const formatAnswer = (answer: FormAnswer): string =>
  Object.entries(answer)
    .map(([key, value]) => `${key}: ${formatFormValue(value)}`)
    .join(', ');

/** `FormDetail` -> view-model, resolviendo `state`/`answer` (FR-032/FR-033). */
export const toQuestionEntry = (form: FormDetail): TQuestionEntry => ({
  id: form.id,
  title: form.title,
  fields: form.fields.map((field) => ({
    key: field.key,
    title: field.title ?? null,
    type: field.type,
    options: fieldOptions(field),
  })),
  state: form.state.status,
  answer:
    form.state.status === 'answered' ? formatAnswer(form.state.answer) : null,
});

/** `PermissionRequest` -> view-model (FR-031). */
export const toPermissionEntry = (
  request: PermissionRequest,
): TPermissionEntry => ({
  id: request.id,
  action: request.action,
  resources: request.resources,
  message: request.message ?? null,
});
