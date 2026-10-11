import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import {
  Button,
  Checkbox,
  Container,
  Input,
  Label,
} from '@app/Application/Components';
import type {
  TQuestionEntry,
  TQuestionField,
} from '@app/Application/Helpers/questionState';

/** Decisión explícita de un permiso (FR-005). */
export type TPermissionDecision = 'once' | 'always' | 'reject';

/** Valor de un campo de pregunta (mismo dominio que `formAnswerSchema`). */
export type TChatFormValue = string | number | boolean | string[];

/** Respuesta de una pregunta, indexada por `field.key` (FR-005). */
export type TChatFormAnswer = Record<string, TChatFormValue>;

/** Permiso pendiente accionable (subconjunto de `PermissionRequest`). */
export interface TChatPendingPermission {
  id: string;
  /** Operación afectada. */
  action: string;
  /** Recursos afectados por la operación. */
  resources: string[];
  /** Motivo textual si el servidor lo reporta. */
  message?: string | null;
}

interface ChatPendingRequestCommonProps {
  /** Mutation en vuelo: bloquea los controles y anuncia `aria-busy` (FR-004). */
  isPending?: boolean;
  /**
   * Lleva el foco al pendiente al aparecer (foco programático, FR-021). La
   * bandeja lo activa solo para el pendiente nuevo, no para toda la lista.
   */
  autoFocus?: boolean;
  className?: string;
}

export interface ChatPendingPermissionProps
  extends ChatPendingRequestCommonProps {
  kind: 'permission';
  permission: TChatPendingPermission;
  /** Notifica la decisión elegida (`once`/`always`/`reject`, FR-005). */
  onReplyPermission: (decision: TPermissionDecision) => void;
}

export interface ChatPendingQuestionProps
  extends ChatPendingRequestCommonProps {
  kind: 'question';
  question: TQuestionEntry;
  /** Notifica la respuesta indexada por `field.key` (FR-005). */
  onReplyForm: (answer: TChatFormAnswer) => void;
}

export type ChatPendingRequestProps =
  | ChatPendingPermissionProps
  | ChatPendingQuestionProps;

/**
 * Estado inicial de los campos: `false`/`[]`/`''` según el tipo (FR-005).
 */
const initialValues = (fields: TQuestionField[]): TChatFormAnswer => {
  const values: TChatFormAnswer = {};
  for (const field of fields) {
    if (field.type === 'boolean') values[field.key] = false;
    else if (field.type === 'multiselect') values[field.key] = [];
    else values[field.key] = '';
  }
  return values;
};

/** Foco programático opcional al aparecer el pendiente (FR-021). */
const useAutoFocusRef = (
  autoFocus: boolean,
): RefObject<HTMLElement | null> => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return ref;
};

/** Renderiza un permiso pendiente y sus decisiones (FR-005, FR-017). */
const ChatPendingPermission = ({
  permission,
  onReplyPermission,
  isPending = false,
  autoFocus = false,
  className,
}: ChatPendingPermissionProps) => {
  const rootRef = useAutoFocusRef(autoFocus);
  const idPrefix = useId().replace(/:/g, '');
  const resourcesText = permission.resources.join(', ');
  const authorizationId = `${idPrefix}-authorization`;

  return (
    <section
      ref={rootRef}
      role="group"
      aria-label="Permiso pendiente"
      aria-busy={isPending}
      tabIndex={-1}
      className={className}
    >
      <span role="status" className="sr-only">
        Permiso pendiente: {permission.action}
      </span>
      <Container space="small">
        <Container space="none">
          <span className="text-xs font-medium text-foreground">
            Permiso: {permission.action}
          </span>
          {permission.resources.length > 0 ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              Recursos: {resourcesText}
            </span>
          ) : null}
          {permission.message ? (
            <span className="text-[11px] text-muted-foreground">
              {permission.message}
            </span>
          ) : null}
        </Container>

        <Container row justify="end" space="small">
          <Button
            type="button"
            variant="outline"
            isLoading={isPending}
            aria-busy={isPending}
            onClick={() => onReplyPermission('reject')}
          >
            Rechazar
          </Button>
          <Button
            type="button"
            isLoading={isPending}
            aria-busy={isPending}
            onClick={() => onReplyPermission('once')}
          >
            Permitir una vez
          </Button>
          <Button
            type="button"
            isLoading={isPending}
            aria-busy={isPending}
            aria-describedby={authorizationId}
            onClick={() => onReplyPermission('always')}
          >
            Permitir siempre
          </Button>
        </Container>

        <span id={authorizationId} className="sr-only">
          Se autorizará de forma permanente la acción {permission.action}
          {permission.resources.length > 0 ? ` sobre ${resourcesText}` : ''}.
        </span>
      </Container>
    </section>
  );
};

/** Renderiza una pregunta pendiente y su formulario mínimo (FR-005). */
const ChatPendingQuestion = ({
  question,
  onReplyForm,
  isPending = false,
  autoFocus = false,
  className,
}: ChatPendingQuestionProps) => {
  const rootRef = useAutoFocusRef(autoFocus);
  const idPrefix = useId().replace(/:/g, '');
  const [formState, setFormState] = useState(() => ({
    questionId: question.id,
    values: initialValues(question.fields),
  }));

  // Reinicia el formulario al cambiar de pregunta sin `useEffect`: si el
  // `question.id` vigente no es el que originó el estado, se derivan los valores
  // iniciales en el render (patrón "ajustar estado cuando cambian las props").
  const values =
    formState.questionId === question.id
      ? formState.values
      : initialValues(question.fields);

  const setField = (key: string, value: TChatFormValue) =>
    setFormState((prev) => ({
      questionId: question.id,
      values: {
        ...(prev.questionId === question.id
          ? prev.values
          : initialValues(question.fields)),
        [key]: value,
      },
    }));

  const renderField = (field: TQuestionField) => {
    const label = field.title ?? field.key;
    const fieldId = `${idPrefix}-${field.key}`;
    const current = values[field.key];

    switch (field.type) {
      case 'boolean':
        return (
          <Container key={field.key} row align="center" space="small">
            <Checkbox
              id={fieldId}
              checked={current === true}
              onCheckedChange={(checked) =>
                setField(field.key, checked === true)
              }
              aria-label={label}
            />
            <Label htmlFor={fieldId}>{label}</Label>
          </Container>
        );

      case 'multiselect': {
        const selected = Array.isArray(current) ? current : [];
        return (
          <Container key={field.key} space="small">
            <Label id={`${fieldId}-label`}>{label}</Label>
            <Container row space="small" aria-labelledby={`${fieldId}-label`}>
              {field.options.map((option) => {
                const optionId = `${fieldId}-${option.value}`;
                return (
                  <Container
                    key={option.value}
                    row
                    align="center"
                    space="small"
                  >
                    <Checkbox
                      id={optionId}
                      checked={selected.includes(option.value)}
                      onCheckedChange={(checked) =>
                        setField(
                          field.key,
                          checked === true
                            ? [...selected, option.value]
                            : selected.filter(
                                (value) => value !== option.value,
                              ),
                        )
                      }
                      aria-label={option.label}
                    />
                    <Label htmlFor={optionId}>{option.label}</Label>
                  </Container>
                );
              })}
            </Container>
          </Container>
        );
      }

      case 'external':
        return (
          <Container key={field.key} space="none">
            <Label>{label}</Label>
            <span className="text-[11px] text-muted-foreground">
              Se completa en un formulario externo.
            </span>
          </Container>
        );

      case 'number':
      case 'integer':
        return (
          <Container key={field.key} space="small">
            <Label htmlFor={fieldId}>{label}</Label>
            <Input
              id={fieldId}
              type="number"
              step={field.type === 'integer' ? 1 : 'any'}
              value={typeof current === 'string' ? current : ''}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          </Container>
        );

      default:
        // `string` y cualquier tipo desconocido: fallback de texto (W10).
        return (
          <Container key={field.key} space="small">
            <Label htmlFor={fieldId}>{label}</Label>
            <Input
              id={fieldId}
              value={typeof current === 'string' ? current : ''}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          </Container>
        );
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const answer: TChatFormAnswer = {};
    for (const field of question.fields) {
      const value = values[field.key];
      if (field.type === 'boolean') {
        answer[field.key] = value === true;
      } else if (field.type === 'multiselect') {
        answer[field.key] = Array.isArray(value) ? value : [];
      } else if (field.type === 'number' || field.type === 'integer') {
        if (typeof value === 'string' && value.trim() !== '') {
          answer[field.key] = Number(value);
        }
      } else if (field.type === 'external') {
        // Sin entrada local: el valor se completa en el formulario externo.
      } else if (typeof value === 'string' && value.trim() !== '') {
        answer[field.key] = value;
      }
    }
    onReplyForm(answer);
  };

  return (
    <section
      ref={rootRef}
      role="group"
      aria-label="Pregunta pendiente"
      aria-busy={isPending}
      tabIndex={-1}
      className={className}
    >
      <span role="status" className="sr-only">
        Pregunta pendiente: {question.title}
      </span>
      <form onSubmit={handleSubmit}>
        <Container space="small">
          <span className="text-xs font-medium text-foreground">
            {question.title}
          </span>

          {question.fields.map(renderField)}

          <Container row justify="end" space="small">
            <Button type="submit" isLoading={isPending} aria-busy={isPending}>
              Responder
            </Button>
          </Container>
        </Container>
      </form>
    </section>
  );
};

/**
 * Molecule pura y reusable que renderiza **un** pendiente y permite responderlo
 * inline (FR-005, FR-017, FR-023).
 *
 * - **Permiso**: muestra `action`/`resources[]` **antes** de confirmar y ofrece
 *   las decisiones explícitas `once`/`always`/`reject`; para "siempre" la acción
 *   y el recurso autorizados quedan descritos de forma accesible (FR-017).
 * - **Pregunta**: formulario mínimo por tipo de campo (`string`, `number`,
 *   `integer`, `boolean`, `multiselect`, `external`) reusando los view-models de
 *   `Application/Helpers/questionState`; un tipo desconocido cae en un fallback
 *   de texto y **no** rompe (W10).
 * - **Accesible**: `role=status`, `role=group` con nombre, foco programático
 *   (`autoFocus`) y labels asociados a cada control (FR-021).
 *
 * Presentacional: no conoce el SDK ni los servicios; solo emite callbacks.
 */
export const ChatPendingRequest = (props: ChatPendingRequestProps) =>
  props.kind === 'permission' ? (
    <ChatPendingPermission {...props} />
  ) : (
    <ChatPendingQuestion {...props} />
  );
