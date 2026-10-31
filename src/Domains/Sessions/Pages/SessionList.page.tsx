import { useNavigate } from 'react-router-dom';
import {
  EmptyScreenError,
  EmptyScreenFilter,
  EmptyState,
  Page,
} from '@app/Application/Components';
import { GraphTruncationBanner } from '@app/Application/Components/Molecules';
import { useDevice } from '@app/Application/Hooks';
import {
  SessionFilterBar,
  SessionList,
  SessionListSkeleton,
  SessionTable,
} from '../Components';
import { useRootSessions, useSessionFilters, useSessionsEyebrow } from '../Hooks';
import { useGetSessionStatus } from '../Sessions.service';
import { sessionDetailPath } from '../Sessions.routes';

/** Título visible de la página del listado. */
const PAGE_TITLE = 'Sesiones';

export const SessionListPage = () => {
  const navigate = useNavigate();
  const { isMobile } = useDevice();
  const { groups, items, truncated, isLoading, isError, error } =
    useRootSessions();
  const statusQuery = useGetSessionStatus();
  const eyebrow = useSessionsEyebrow(items, statusQuery.data);
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

  const openSession = (id: string) => {
    void navigate(sessionDetailPath(id));
  };

  if (isError) return <EmptyScreenError message={error?.message} />;
  // El esqueleto ocupa la misma columna centrada que la página cargada.
  if (isLoading)
    return (
      <Page title={PAGE_TITLE}>
        <SessionListSkeleton framed />
      </Page>
    );
  if (items.length === 0)
    return (
      <EmptyState
        title="Sin sesiones"
        description="No hay ejecuciones de OpenCode todavía. Inicia una para verla aquí."
      />
    );

  return (
    <Page title={PAGE_TITLE} eyebrow={eyebrow}>
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
      ) : isMobile ? (
        // Móvil: tarjetas (las del rail); escritorio: la tabla del diseño.
        <SessionList
          groups={filteredGroups}
          statuses={statusQuery.data}
          selectedId={null}
          onSelect={openSession}
          showCount
        />
      ) : (
        <SessionTable
          groups={filteredGroups}
          statuses={statusQuery.data}
          onSelect={openSession}
          showCount
        />
      )}
    </Page>
  );
};
