import { useNavigate } from 'react-router-dom';
import {
  EmptyScreenError,
  EmptyState,
  Page,
} from '@app/Application/Components';
import { SessionList, SessionListSkeleton } from '../Components';
import { useRootSessions } from '../Hooks';
import { useGetSessionStatus } from '../Sessions.service';
import { sessionDetailPath } from '../Sessions.routes';

export const SessionListPage = () => {
  const navigate = useNavigate();
  const { groups, items, isLoading, isError, error } = useRootSessions();
  const statusQuery = useGetSessionStatus();

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
      <SessionList
        groups={groups}
        statuses={statusQuery.data}
        selectedId={null}
        onSelect={(id) => {
          void navigate(sessionDetailPath(id));
        }}
      />
    </Page>
  );
};
