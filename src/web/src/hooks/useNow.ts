import { useEffect, useState } from 'react';

/**
 * Re-render the calling component on a fixed cadence so relative timestamps
 * ("5s ago", "in 12s") tick smoothly without waiting on data refetches.
 *
 * Returns Date.now() in ms.
 */
export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
