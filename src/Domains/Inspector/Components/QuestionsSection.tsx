import {
  Container,
  EmptyScreenError,
  Skeleton,
} from '@app/Application/Components';
import type { TPermissionEntry, TQuestionEntry } from '../Inspector.entity';

interface QuestionsSectionProps {
  /** Permisos que la sesión está esperando (FR-031). */
  permissions: TPermissionEntry[];
  /** Preguntas dirigidas al usuario (FR-032/FR-033). */
  questions: TQuestionEntry[];
  /** Turnos pendientes en cola (FR-034). */
  queuedTurns: number;
  /** Alguna de las consultas falló (Principio VI). */
  isError: boolean;
  /** Alguna de las consultas está en curso (Principio VI). */
  isLoading: boolean;
}

/** Estado de la pregunta en lenguaje natural (FR-033). */
const STATE_LABEL: Record<TQuestionEntry['state'], string> = {
  pending: 'pendiente',
  answered: 'respondida',
  cancelled: 'cancelada',
};

const STATE_COLOR: Record<TQuestionEntry['state'], string> = {
  pending: 'text-status-running',
  answered: 'text-status-done',
  cancelled: 'text-muted-foreground',
};

/**
 * Permisos, preguntas y cola de una ejecución (FR-031..FR-034).
 *
 * - **Permisos**: `action` (operación) y `resources[]` (recursos afectados).
 * - **Preguntas**: `title`, los campos con sus opciones y la respuesta cuando
 *   existe; `pending`/`cancelled` se etiquetan como tales y nunca como
 *   `answered` (FR-033).
 * - **Cola**: número de turnos con `delivery === 'queue'` (FR-034).
 *
 * Presentación pura: recibe los datos y los estados de pantalla desde
 * `useInspectorData` y renderiza error → loading → vacío → datos.
 */
export const QuestionsSection = ({
  permissions,
  questions,
  queuedTurns,
  isError,
  isLoading,
}: QuestionsSectionProps) => {
  const isEmpty =
    permissions.length === 0 && questions.length === 0 && queuedTurns === 0;

  return (
    <Container space="small">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Preguntas y permisos
      </span>

      {isError ? <EmptyScreenError /> : null}

      {!isError && isLoading ? (
        <Container space="small">
          <Skeleton className="h-4 w-full rounded-flat" />
          <Skeleton className="h-4 w-4/5 rounded-flat" />
        </Container>
      ) : null}

      {!isError && !isLoading && isEmpty ? (
        <p className="text-xs text-muted-foreground">Sin permisos ni preguntas</p>
      ) : null}

      {!isError && !isLoading && !isEmpty ? (
        <Container space="small">
          {permissions.length > 0 ? (
            <Container space="small">
              <span className="text-[11px] font-medium text-muted-foreground">
                Permisos
              </span>
              <Container space="none">
                {permissions.map((permission) => (
                  <Container
                    key={permission.id}
                    space="none"
                    className="border-b border-border py-1 last:border-b-0"
                  >
                    <span className="font-mono text-xs text-foreground">
                      {permission.action}
                    </span>
                    {permission.resources.length > 0 ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {permission.resources.join(', ')}
                      </span>
                    ) : null}
                    {permission.message ? (
                      <span className="text-[11px] text-muted-foreground">
                        {permission.message}
                      </span>
                    ) : null}
                  </Container>
                ))}
              </Container>
            </Container>
          ) : null}

          {questions.length > 0 ? (
            <Container space="small">
              <span className="text-[11px] font-medium text-muted-foreground">
                Preguntas
              </span>
              <Container space="none">
                {questions.map((question) => (
                  <Container
                    key={question.id}
                    space="small"
                    className="border-b border-border py-1 last:border-b-0"
                  >
                    <Container
                      row
                      space="small"
                      align="center"
                      justify="between"
                    >
                      <span className="min-w-0 text-xs text-foreground">
                        {question.title}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[11px] ${STATE_COLOR[question.state]}`}
                      >
                        {STATE_LABEL[question.state]}
                      </span>
                    </Container>
                    {question.fields.map((field) => (
                      <span
                        key={field.key}
                        className="text-[11px] text-muted-foreground"
                      >
                        {field.title ?? field.key}
                        {field.options.length > 0
                          ? ` · ${field.options
                              .map((option) => option.label)
                              .join(', ')}`
                          : null}
                      </span>
                    ))}
                    {question.state === 'answered' && question.answer ? (
                      <span className="text-[11px] text-status-done">
                        Respuesta: {question.answer}
                      </span>
                    ) : null}
                  </Container>
                ))}
              </Container>
            </Container>
          ) : null}

          <span className="text-[11px] text-muted-foreground">
            Turnos en cola: {queuedTurns}
          </span>
        </Container>
      ) : null}
    </Container>
  );
};
