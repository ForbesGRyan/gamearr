/**
 * Shared types for Library components
 */

export interface Game {
  id: number;
  title: string;
  year?: number;
  coverUrl?: string;
  monitored: boolean;
  status: 'wanted' | 'downloading' | 'downloaded';
  platform: string;
  store?: string | null;
  summary?: string | null;
  genres?: string | null;
  totalRating?: number | null;
  developer?: string | null;
  publisher?: string | null;
  gameModes?: string | null;
  similarGames?: string | null;
  updateAvailable?: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
  updatePolicy?: 'notify' | 'auto' | 'ignore';
  libraryId?: number | null;
}

export interface SimilarGame {
  igdbId: number;
  name: string;
  coverUrl?: string;
}

export interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  cleanedTitle: string;
  parsedYear?: number;
  parsedVersion?: string;
  matched: boolean;
  gameId?: number;
  path: string;
  libraryName?: string;
  relativePath?: string;
}

export interface AutoMatchSuggestion {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  platforms?: string[];
  genres?: string[];
  totalRating?: number;
  developer?: string;
  publisher?: string;
  gameModes?: string[];
  similarGames?: Array<{
    igdbId: number;
    name: string;
    coverUrl?: string;
  }>;
}

export interface LooseFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: number;
  libraryName?: string;
}

export interface DuplicateGameInfo {
  id: number;
  title: string;
  year?: number;
  status: string;
  folderPath?: string;
  size?: number;
}

export interface DuplicateGroup {
  games: DuplicateGameInfo[];
  similarity: number;
}

export type ViewMode = 'posters' | 'table' | 'overview';
export type SortColumn = 'title' | 'year' | 'rating' | 'monitored' | 'store' | 'status';
export type SortDirection = 'asc' | 'desc';
export type StatusFilter = 'all' | 'wanted' | 'downloading' | 'downloaded';
export type MonitoredFilter = 'all' | 'monitored' | 'unmonitored';

export interface Filters {
  status: StatusFilter;
  monitored: MonitoredFilter;
  genres: string[];
  gameModes: string[];
  libraryId: number | 'all';
}

export interface SteamGame {
  appId: number;
  name: string;
  headerImageUrl: string;
  playtimeMinutes: number;
  alreadyInLibrary: boolean;
}

export interface SteamImportProgress {
  current: number;
  total: number;
  currentGame: string;
}

export interface GogGame {
  id: number;
  title: string;
  imageUrl: string;
  slug: string;
  alreadyInLibrary: boolean;
}

export interface GogImportProgress {
  current: number;
  total: number;
  currentGame: string;
}

export interface LibraryInfo {
  id: number;
  name: string;
  platform?: string | null;
}
