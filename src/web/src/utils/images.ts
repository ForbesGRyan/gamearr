/**
 * Get the cover image URL for a game
 * Uses the local image cache proxy to avoid repeated IGDB CDN requests
 *
 * @param gameId - The game's database ID
 * @param coverUrl - The original cover URL (used as cache buster when IGDB match changes)
 * @returns The proxy URL for the cover image, or undefined if no cover
 */
export function getCoverUrl(gameId: number | undefined, coverUrl: string | null | undefined): string | undefined {
  if (!gameId || !coverUrl) {
    return undefined;
  }
  // Use a hash of the coverUrl as cache buster so browser re-fetches when IGDB match changes
  const hash = simpleHash(coverUrl);
  return `/api/v1/images/cover/${gameId}?v=${hash}`;
}

/**
 * Simple hash function for cache busting
 * Creates a short numeric hash from a string
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
