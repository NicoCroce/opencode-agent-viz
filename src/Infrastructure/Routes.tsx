import { Navigate, Route, Routes as ReactRoutes } from 'react-router-dom';
import { SessionsRouter } from '@app/Domains/Sessions';
import { GRAPH_VIEW_ROUTE } from '@app/Domains/Graph';
import { AppShell } from './AppShell';
import { WorkspacePage } from './WorkspacePage';

const Routes = () => {
  return (
    <ReactRoutes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/sessions" replace />} />
        {SessionsRouter}
        <Route path={GRAPH_VIEW_ROUTE} element={<WorkspacePage />} />
      </Route>
    </ReactRoutes>
  );
};

export default Routes;
