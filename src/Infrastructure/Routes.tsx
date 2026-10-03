import { Route, Routes as ReactRoutes } from 'react-router-dom';

const Routes = () => {
  return (
    <ReactRoutes>
      <Route path="/" element={<div>Welcome to OpenCode Agent Viz</div>} />
    </ReactRoutes>
  );
};

export default Routes;
