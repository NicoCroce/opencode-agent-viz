import type { ReactNode } from 'react';
import { Container } from '@app/Application/Components';

interface LabeledFieldProps {
  /** Etiqueta en mayúsculas del campo (p. ej. "Entrada", "Error", "Resultado"). */
  label: string;
  /** Valor o contenido del campo. */
  children: ReactNode;
}

/**
 * Campo de detalle `etiqueta + valor` (SH-15).
 *
 * Presentación pura: la etiqueta va en mayúsculas atenuadas y el contenido
 * debajo, en columna. Reemplaza al `ToolField` privado de `ToolCallEntry` y es
 * reutilizable por los cuerpos de `HistoryEntry` y las secciones del Inspector.
 * No accede al SDK ni a hooks de datos.
 */
export const LabeledField = ({ label, children }: LabeledFieldProps) => (
  <Container space="small">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {children}
  </Container>
);
