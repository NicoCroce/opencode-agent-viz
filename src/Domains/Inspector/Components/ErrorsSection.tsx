import { Container } from '@app/Application/Components';
import {
  DETAIL_LIST_CLASSNAME,
  DETAIL_LIST_ROW_CLASSNAME,
  SectionFrame,
} from '@app/Application/Components/Molecules';

interface ErrorsSectionProps {
  errors: { message: string; at: number }[];
  /** La consulta de errores falló (Principio VI). */
  isError?: boolean;
  /** La consulta de errores está en curso (Principio VI). */
  isLoading?: boolean;
}

/**
 * Apartado **Errores** del detalle. Resuelve los cuatro estados de pantalla vía
 * `SectionFrame` (error → carga → vacío → datos), conservando el encabezado
 * "Errores" y el vacío "Sin errores.".
 */
export const ErrorsSection = ({
  errors,
  isError = false,
  isLoading = false,
}: ErrorsSectionProps) => (
  <SectionFrame
    title="Errores"
    isError={isError}
    isLoading={isLoading}
    isEmpty={errors.length === 0}
    emptyLabel="Sin errores."
  >
    <Container space="none" className={DETAIL_LIST_CLASSNAME}>
      {errors.map((error, index) => (
        <p
          key={`${error.at}-${index}`}
          className={`${DETAIL_LIST_ROW_CLASSNAME} break-words text-xs text-status-error`}
        >
          {error.message}
        </p>
      ))}
    </Container>
  </SectionFrame>
);
