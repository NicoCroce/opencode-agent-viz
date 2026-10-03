import { Route } from 'react-router-dom';
import { SessionListPage } from './Pages';
import { SESSIONS_LIST_ROUTE } from './Sessions.routes';

export const SessionsRouter = [
  <Route
    key="sessions-list"
    path={SESSIONS_LIST_ROUTE}
    element={<SessionListPage />}
  />,
];
