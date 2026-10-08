import { useNavigate } from 'react-router-dom';
import {
  EmptyScreenError,
  EmptyScreenFilter,
  EmptyState,
  Page,
} from '@app/Application/Components';
import { SessionFilterBar, SessionList, SessionListSkeleton } from '../Components';
import { useRootSessions, useSessionFilters } from '../Hooks';
import { useGetSessionStatus } from '../Sessions.service';
import { sessionDetailPath } from '../Sessions.routes';

export const SessionListPage = () => {
  const navigate = useNavigate();
  const { groups, items, isLoading, isError, error } = useRootSessions();
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

  if (isError) return <EmptyScreenError message={error?.message} />;
  if (isLoading) return <SessionListSkeleton />;
  if (items.length === 0)
    return (
      <EmptyState
        title="Sin sesiones"
        description="No hay ejecuciones de OpenCode todavía. Inicia una para verla aquí."
      />
    );

  return (
    <Page title="Sesiones de OpenCode">
      <SessionFilterBar
        options={options}
        selectedProjects={validSelected}
        onToggleProject={toggleProject}
        range={range}
        onRangeChange={setRange}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />
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
