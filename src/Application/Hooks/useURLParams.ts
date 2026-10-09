import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Hook para manejar parámetros de URL de forma reactiva.
 * @template TParams - Tipo de los parámetros esperados
 * @param baseURL - URL base opcional para la navegación
 */
export const useURLParams = <TParams extends Record<string, string | number>>(
  baseURL: string = '',
) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Actualiza parámetros (null/undefined/'' elimina la clave).
  const updateParams = useCallback(
    (
      newParams: Partial<
        Record<keyof TParams, string | number | null | undefined>
      >,
    ) => {
      const updatedParams = new URLSearchParams(searchParams);

      Object.entries(newParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          updatedParams.set(key, String(value));
        } else {
          updatedParams.delete(key);
        }
      });

      if (baseURL) {
        void navigate(`${baseURL}?${updatedParams.toString()}`, {
          replace: true,
        });
      } else {
        setSearchParams(updatedParams, { replace: true });
      }
    },
    [baseURL, navigate, searchParams, setSearchParams],
  );

  // Obtiene un parámetro específico.
  const getParam = useCallback(
    (key: keyof TParams): string | undefined =>
      searchParams.get(key as string) || undefined,
    [searchParams],
  );

  return { getParam, updateParams };
};
