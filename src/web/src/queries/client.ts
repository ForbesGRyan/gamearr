import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './unwrap';

// Persistence maxAge for the localStorage persister (see main.tsx). gcTime
// must be >= this so that inactive-but-persisted queries aren't garbage
// collected from the in-memory cache before hydration gets a chance to use
// them on the next page load.
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: PERSIST_MAX_AGE_MS,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && /unauthorized/i.test(error.message)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
