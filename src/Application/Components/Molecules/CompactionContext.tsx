import type { SessionMessageInfo } from '@opencode/client';
import { EmptyScreenError } from './EmptyScreenError';
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
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-40 rounded-flat" />
        <Skeleton className="h-10 w-full rounded-flat" />
      </div>
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
    <div className="flex flex-col gap-1" data-testid="compaction-context">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Contexto resultante
      </span>
      {messages.map((message, index) => (
        <div
          key={`${message.id}-${index}`}
          className="flex flex-col gap-0.5 border-l-2 border-border pl-2"
        >
          <span className="font-mono text-[11px] text-muted-foreground">
            {message.type}
          </span>
          <p className="whitespace-pre-wrap break-words text-xs text-foreground">
            {previewMessage(message) || 'sin contenido'}
          </p>
        </div>
      ))}
    </div>
  );
};
