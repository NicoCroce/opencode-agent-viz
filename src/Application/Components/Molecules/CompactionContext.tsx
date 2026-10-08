import type { SessionMessageInfo } from '@opencode/client';
import { Container } from '../Layout';
import { EmptyScreenError } from './EmptyScreenError';
import { SectionHeading } from './SectionHeading';
import { Skeleton } from '../ui/skeleton';

interface CompactionContextProps {
  /** Mensajes del contexto resultante (`session.context`). */
  messages: SessionMessageInfo[];
  /** La consulta del contexto falló (Principio VI). */
  isError: boolean;
  /** La consulta del contexto está en curso (Principio VI). */
  isLoading: boolean;
}

/**
 * Texto legible de un mensaje del contexto. Los mensajes sin texto propio
 * (cambios de agente/modelo/ubicación, idle, …) devuelven `''` y se muestran
 * como "sin contenido" (FR-038: nunca se inventa información).
 */
const previewMessage = (message: SessionMessageInfo): string => {
  switch (message.type) {
    case 'user':
      return message.text;
    case 'assistant':
      return message.content
        .flatMap((part) => (part.type === 'text' ? [part.text] : []))
        .join(' ');
    case 'system':
    case 'synthetic':
    case 'skill':
      return message.text;
    case 'shell':
      return message.command;
    default:
      return '';
  }
};

/**
 * Contexto resultante de un episodio de compactación (FR-035).
 *
 * Pieza compartida de `Application`: presentación pura que recibe los datos por
 * props (los pide el hook del dominio dueño, `useSessionContext` en Inspector) y
 * renderiza los estados obligatorios en orden: error → loading → vacío → datos
 * (Principio VI). Así `HistoryEntry` puede mostrar el contexto sin que un
 * componente de `Application` importe el service de un dominio.
 *
 * No usa `SectionFrame`: sus estados no comparten raíz (el error no envuelve, y
 * `data-testid`/el encabezado solo existen con datos), así que forzarlo rompería
 * el contrato observable. Consume `SectionHeading` y `Container`.
 */
export const CompactionContext = ({
  messages,
  isError,
  isLoading,
}: CompactionContextProps) => {
  if (isError) {
    return (
      <EmptyScreenError message="No se pudo cargar el contexto de la compactación." />
    );
  }

  if (isLoading) {
    return (
      <Container space="none" className="gap-1!">
        <Skeleton className="h-4 w-40 rounded-flat" />
        <Skeleton className="h-10 w-full rounded-flat" />
      </Container>
    );
  }

  if (messages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin contexto de compactación.
      </p>
    );
  }

  return (
    <Container
      space="none"
      className="gap-1!"
      data-testid="compaction-context"
    >
      <SectionHeading>Contexto resultante</SectionHeading>
      {messages.map((message, index) => (
        <Container
          key={`${message.id}-${index}`}
          space="none"
          className="gap-0.5! border-l-2 border-border pl-2"
        >
          <span className="font-mono text-[11px] text-muted-foreground">
            {message.type}
          </span>
          <p className="whitespace-pre-wrap break-words text-xs text-foreground">
            {previewMessage(message) || 'sin contenido'}
          </p>
        </Container>
      ))}
    </Container>
  );
};
