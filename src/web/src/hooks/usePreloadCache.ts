import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

// Types for cached data
interface PopularityType {
  id: number;
  name: string;
  popularity_source: number;
}

interface TorrentRelease {
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  leechers: number;
  publishedAt: string;
  downloadUrl?: string;
  infoUrl?: string;
  quality?: string;
}

interface PreloadCache {
  popularityTypes: PopularityType[] | null;
  popularGames: Record<number, unknown[]>; // keyed by popularity type ID
  topTorrents: TorrentRelease[] | null;
  timestamps: {
    popularityTypes: number | null;
    popularGames: Record<number, number>;
    topTorrents: number | null;
  };
}

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Global cache instance
const cache: PreloadCache = {
  popularityTypes: null,
  popularGames: {},
  topTorrents: null,
  timestamps: {
    popularityTypes: null,
    popularGames: {},
    topTorrents: null,
  },
};

// Loading state to prevent duplicate requests
const loadingState = {
  popularityTypes: false,
  popularGames: new Set<number>(),
  topTorrents: false,
};

// Check if cache entry is still valid
function isCacheValid(timestamp: number | null): boolean {
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_TTL;
}

// Preload functions
async function preloadPopularityTypes(): Promise<PopularityType[] | null> {
  if (loadingState.popularityTypes) return cache.popularityTypes;
  if (isCacheValid(cache.timestamps.popularityTypes)) return cache.popularityTypes;

  loadingState.popularityTypes = true;
  try {
    const response = await api.getPopularityTypes();
    if (response.success && response.data) {
      cache.popularityTypes = response.data as PopularityType[];
      cache.timestamps.popularityTypes = Date.now();
    }
  } catch (err) {
    console.warn('Preload popularityTypes failed:', err);
  } finally {
    loadingState.popularityTypes = false;
  }
  return cache.popularityTypes;
}

async function preloadPopularGames(typeId: number): Promise<unknown[] | null> {
  if (loadingState.popularGames.has(typeId)) return cache.popularGames[typeId] || null;
  if (isCacheValid(cache.timestamps.popularGames[typeId])) return cache.popularGames[typeId];

  loadingState.popularGames.add(typeId);
  try {
    const response = await api.getPopularGames(typeId, 50);
    if (response.success && response.data) {
      cache.popularGames[typeId] = response.data;
      cache.timestamps.popularGames[typeId] = Date.now();
    }
  } catch (err) {
    console.warn(`Preload popularGames (type ${typeId}) failed:`, err);
  } finally {
    loadingState.popularGames.delete(typeId);
  }
  return cache.popularGames[typeId] || null;
}

async function preloadTopTorrents(): Promise<TorrentRelease[] | null> {
  if (loadingState.topTorrents) return cache.topTorrents;
  if (isCacheValid(cache.timestamps.topTorrents)) return cache.topTorrents;

  loadingState.topTorrents = true;
  try {
    const response = await api.getTopTorrents('game', 50, 30);
    if (response.success && response.data) {
      cache.topTorrents = response.data as TorrentRelease[];
      cache.timestamps.topTorrents = Date.now();
    }
  } catch (err) {
    console.warn('Preload topTorrents failed:', err);
  } finally {
    loadingState.topTorrents = false;
  }
  return cache.topTorrents;
}

// Start background preloading
export function startBackgroundPreload(): void {
  // Small delay to let the main page load first
  setTimeout(async () => {
    // Load popularity types first (needed for games)
    const types = await preloadPopularityTypes();

    // Then preload default popular games (type 2 = IGDB Visits)
    await preloadPopularGames(2);

    // Preload top torrents in parallel
    preloadTopTorrents();

    // Optionally preload other popularity types if we have them
    if (types && types.length > 0) {
      // Preload first 3 popularity types in background
      for (const type of types.slice(0, 3)) {
        if (type.id !== 2) {
          preloadPopularGames(type.id);
        }
      }
    }
  }, 1000); // 1 second delay after app mount
}

// Hook to get cached data
export function usePreloadedData() {
  const [popularityTypes, setPopularityTypes] = useState<PopularityType[] | null>(cache.popularityTypes);
  const [isLoadingTypes, setIsLoadingTypes] = useState(!cache.popularityTypes);

  const getPopularityTypes = useCallback(async () => {
    // Return cached data if valid
    if (isCacheValid(cache.timestamps.popularityTypes) && cache.popularityTypes) {
      setPopularityTypes(cache.popularityTypes);
      setIsLoadingTypes(false);
      return cache.popularityTypes;
    }

    // Otherwise load fresh
    setIsLoadingTypes(true);
    const data = await preloadPopularityTypes();
    setPopularityTypes(data);
    setIsLoadingTypes(false);
    return data;
  }, []);

  const getPopularGames = useCallback(async (typeId: number) => {
    // Return cached data if valid
    if (isCacheValid(cache.timestamps.popularGames[typeId]) && cache.popularGames[typeId]) {
      return cache.popularGames[typeId];
    }

    // Otherwise load fresh
    return await preloadPopularGames(typeId);
  }, []);

  const getTopTorrents = useCallback(async () => {
    // Return cached data if valid
    if (isCacheValid(cache.timestamps.topTorrents) && cache.topTorrents) {
      return cache.topTorrents;
    }

    // Otherwise load fresh
    return await preloadTopTorrents();
  }, []);

  // Check cache on mount
  useEffect(() => {
    if (cache.popularityTypes) {
      setPopularityTypes(cache.popularityTypes);
      setIsLoadingTypes(false);
    }
  }, []);

  return {
    popularityTypes,
    isLoadingTypes,
    getPopularityTypes,
    getPopularGames,
    getTopTorrents,
    // Expose cache check for components
    hasCachedPopularGames: (typeId: number) => isCacheValid(cache.timestamps.popularGames[typeId]),
    hasCachedTorrents: () => isCacheValid(cache.timestamps.topTorrents),
    getCachedPopularGames: (typeId: number) => cache.popularGames[typeId] || null,
    getCachedTorrents: () => cache.topTorrents,
  };
}

// Invalidate cache (useful after adding games to library)
export function invalidatePopularGamesCache(): void {
  cache.popularGames = {};
  cache.timestamps.popularGames = {};
}
