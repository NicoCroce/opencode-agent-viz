import { useNavigate } from 'react-router-dom';
import {
  EmptyScreenError,
  EmptyScreenFilter,
  EmptyState,
  Page,
} from '@app/Application/Components';
import { GraphTruncationBanner } from '@app/Application/Components/Molecules';
import {
  SessionFilterBar,
  SessionList,
  SessionListSkeleton,
} from '../Components';
import { useRootSessions, useSessionFilters } from '../Hooks';
import { useGetSessionStatus } from '../Sessions.service';
import { sessionDetailPath } from '../Sessions.routes';

const PAGE_TITLE = 'Sesiones de OpenCode';
const PAGE_DESCRIPTION =
  'Ejecuciones multiagente en vivo, agrupadas por proyecto';

export const SessionListPage = () => {
  const navigate = useNavigate();
  const { groups, items, truncated, isLoading, isError, error } =
    useRootSessions();
  const statusQuery = useGetSessionStatus();
  // Única suscripción a los datos: los `groups` ya calculados alimentan al hook
  // de filtros, que solo deriva estado de vista (nunca vuelve a consultar).
  const {
    options,
    validSelected,
    range,
    hasActiveFilters,
    filteredGroups,
    isEmptyResult,
    toggleProject,
    setRange,
    clearFilters,
  } = useSessionFilters(groups);

  if (isError)
    return (
      <Page title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <EmptyScreenError message={error?.message} />
      </Page>
    );

  if (isLoading)
    return (
      <Page title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <SessionListSkeleton />
      </Page>
    );

  if (items.length === 0)
    return (
      <Page title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
        <EmptyState
          title="Sin sesiones"
          description="No hay ejecuciones de OpenCode todavía. Inicia una para verla aquí."
        />
      </Page>
    );

  return (
    <Page title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
      <SessionFilterBar
        options={options}
        selectedProjects={validSelected}
        onToggleProject={toggleProject}
        range={range}
        onRangeChange={setRange}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />
      {/* Aviso de corte del listado (R5): informativo y no bloqueante, entre la
          barra de filtros y el listado. */}
      {truncated ? <GraphTruncationBanner /> : null}
      {isEmptyResult && hasActiveFilters ? (
        <EmptyScreenFilter
          onClick={clearFilters}
          actionLabel="Limpiar filtros"
        />
      ) : (
        <SessionList
          groups={filteredGroups}
          statuses={statusQuery.data}
          selectedId={null}
          onSelect={(id) => {
            void navigate(sessionDetailPath(id));
          }}
          showCount
        />
      )}
    </Page>
  );
};
