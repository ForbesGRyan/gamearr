import React from 'react';
import ReactDOM from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { queryClient, PERSIST_MAX_AGE_MS } from './queries/client';
import './index.css';

// Cache-bust key — bumping this invalidates all persisted caches. Use it when
// the serialized shape of a query key or its payload changes in a way that
// old entries would deserialize incorrectly.
const PERSIST_BUSTER = 'v1';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'gamearr_query_cache',
  throttleTime: 1000,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE_MS,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          // Don't persist mutation state or errored queries — they're
          // transient and can mask real failures on restart.
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success',
        },
      }}
    >
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-left" />}
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
