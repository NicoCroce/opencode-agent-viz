import { useQuery } from '@tanstack/react-query';
import { opencodeService } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../queryKeys';

/**
 * Lista todos los proyectos que OpenCode conoce (los que alguna vez se
 * ejecutaron). Se refresca periódicamente para descubrir proyectos nuevos.
 */
export const useGetProjects = () =>
  useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: () => opencodeService.listProjects(),
    staleTime: 1000 * 30,
    refetchInterval: 15000,
  });
