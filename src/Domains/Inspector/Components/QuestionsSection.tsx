import {
  Container,
  EmptyScreenError,
  Skeleton,
} from '@app/Application/Components';
import type {
  TChatFormAnswer,
  TPermissionDecision,
} from '@app/Application/Components/Molecules/ChatPendingRequest';
import type { TPermissionEntry, TQuestionEntry } from '../Inspector.entity';
import { PermissionRow } from './PermissionRow';
import { QuestionRow } from './QuestionRow';

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
  /**
   * Modo accionable opt-in (FR-005). Por defecto `false`: la sección conserva
   * el comportamiento de solo lectura. Con `true` cada fila reusa la molecule
   * `ChatPendingRequest` a través de los callbacks de respuesta.
   */
  actionable?: boolean;
  /** Notifica la decisión de un permiso, con el permiso que la originó (FR-005). */
  onReplyPermission?: (
    permission: TPermissionEntry,
    decision: TPermissionDecision,
  ) => void;
  /** Notifica la respuesta de una pregunta, con la pregunta que la originó (FR-005). */
  onReplyForm?: (
    question: TQuestionEntry,
    answer: TChatFormAnswer,
  ) => void;
  /** Mutation en vuelo: bloquea los controles accionables (FR-004). */
  isPending?: boolean;
}

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
 * `useInspectorData` y renderiza error → loading → vacío → datos. Cada fila
 * delega en `PermissionRow`/`QuestionRow`, que en **modo accionable opt-in**
 * (FR-005) reusan la molecule `ChatPendingRequest` sin importar componentes de
 * `Domains/Chat`.
 */
export const QuestionsSection = ({
  permissions,
  questions,
  queuedTurns,
  isError,
  isLoading,
  actionable = false,
  onReplyPermission,
  onReplyForm,
  isPending = false,
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
                  <PermissionRow
                    key={permission.id}
                    permission={permission}
                    actionable={actionable}
                    onReplyPermission={
                      onReplyPermission
                        ? (decision) =>
                            onReplyPermission(permission, decision)
                        : undefined
                    }
                    isPending={isPending}
                  />
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
                  <QuestionRow
                    key={question.id}
                    question={question}
                    actionable={actionable}
                    onReplyForm={
                      onReplyForm
                        ? (answer) => onReplyForm(question, answer)
                        : undefined
                    }
                    isPending={isPending}
                  />
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
