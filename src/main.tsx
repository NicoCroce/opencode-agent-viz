import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { queryClient } from './queryClient';
import App from './App';
import { EventStreamProvider } from './Infrastructure/EventStreamProvider';
import { registerEventViewport } from './Application/Helpers/device';
import './index.css';

document.documentElement.classList.add('dark');
registerEventViewport(queryClient);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <EventStreamProvider>
        <App />
      </EventStreamProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
