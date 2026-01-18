import type {
  SteamImportProgressEvent,
  SteamImportCompleteEvent,
  GogImportProgressEvent,
  GogImportCompleteEvent,
} from '../../../shared/types';

const API_BASE = '/api/v1';

// Auth token storage key
const AUTH_TOKEN_KEY = 'gamearr_auth_token';

// Event for auth state changes
export type AuthEventType = 'login' | 'logout' | 'unauthorized';
type AuthEventListener = (event: AuthEventType) => void;
const authEventListeners: Set<AuthEventListener> = new Set();

export function onAuthEvent(listener: AuthEventListener): () => void {
  authEventListeners.add(listener);
  return () => authEventListeners.delete(listener);
}

export function emitAuthEvent(event: AuthEventType) {
  authEventListeners.forEach((listener) => listener(event));
}

// Auth token management
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  emitAuthEvent('logout');
}

// Handle 401 unauthorized responses
function handleUnauthorized(): void {
  clearAuthToken();
  emitAuthEvent('unauthorized');
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Request interfaces for API methods
export interface AddGameRequest {
  igdbId: number;
  title?: string;
  year?: number;
  platform?: string;
  coverUrl?: string;
  status?: 'wanted' | 'downloading' | 'downloaded';
  monitored?: boolean;
  summary?: string;
  genres?: string;
  totalRating?: number;
  developer?: string;
  publisher?: string;
  gameModes?: string;
  libraryId?: number;
  store?: string | null;
  importSource?: {
    type: 'download';
    torrentName: string;
    torrentHash: string;
  };
}

export interface UpdateGameRequest {
  title?: string;
  year?: number;
  platform?: string;
  status?: 'wanted' | 'downloading' | 'downloaded';
  monitored?: boolean;
  folderPath?: string;
  installedVersion?: string;
  updatePolicy?: 'notify' | 'auto' | 'ignore';
  store?: string | null;
  libraryId?: number | null;
}

export interface ReleaseData {
  title: string;
  size?: number;
  seeders?: number;
  downloadUrl: string;
  indexer: string;
  quality?: string;
}

export interface SettingsUpdate {
  prowlarr_url?: string;
  prowlarr_api_key?: string;
  qbittorrent_host?: string;
  qbittorrent_username?: string;
  qbittorrent_password?: string;
  igdb_client_id?: string;
  igdb_client_secret?: string;
  library_path?: string;
  steam_api_key?: string;
  steam_id?: string;
  dry_run?: boolean;
}

export interface IGDBGame {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  genres?: string[];
  totalRating?: number;
  developer?: string;
  publisher?: string;
  gameModes?: string[];
}

// Store info for games (from junction table)
export interface GameStoreInfo {
  name: string;
  slug: string;
  storeGameId?: string | null;
}

// Folder info for games (from game_folders table)
export interface GameFolder {
  id: number;
  folderPath: string;
  version?: string | null;
  quality?: string | null;
  isPrimary: boolean;
  addedAt: string;
}

// Response data types
export interface Game {
  id: number;
  title: string;
  year?: number;
  igdbId?: number;
  coverUrl?: string;
  monitored: boolean;
  status: 'wanted' | 'downloading' | 'downloaded';
  platform: string;
  store?: string | null; // Legacy field, kept for backwards compatibility
  stores: GameStoreInfo[]; // New stores array from junction table
  folders: GameFolder[]; // Game folder paths (base game, updates, DLC)
  steamName?: string | null;
  folderPath?: string | null; // Legacy field, use folders array instead
  libraryId?: number | null;
  updateAvailable?: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
  installedQuality?: string | null;
  updatePolicy?: 'notify' | 'auto' | 'ignore';
  summary?: string;
  genres?: string;
  totalRating?: number;
  developer?: string;
  publisher?: string;
  gameModes?: string;
  similarGames?: string;
  addedAt?: string;
}

export interface Download {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  state: string;
  savePath: string;
  addedOn: string;
  gameId?: number | null;
}

export interface Release {
  guid: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  downloadUrl: string;
  publishedAt: string;
  quality?: string;
  score?: number;
  matchConfidence?: 'high' | 'medium' | 'low';
  categories?: number[];
}

export interface SearchResult {
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
  existingGameId?: number | null;
}

export interface SystemStatus {
  version: string;
  uptime: number;
  database: boolean;
  prowlarr: boolean;
  qbittorrent: boolean;
}

export interface SetupStatus {
  isComplete: boolean;
  steps: {
    library: { configured: boolean; required: boolean };
    igdb: { configured: boolean; required: boolean };
    prowlarr: { configured: boolean; required: boolean };
    qbittorrent: { configured: boolean; required: boolean };
  };
}

export interface Indexer {
  id: number;
  name: string;
  enable: boolean;
  protocol: 'torrent' | 'usenet';
  privacy: 'public' | 'private' | 'semiPrivate';
  capabilities?: {
    categories?: Array<{
      id: number;
      name: string;
    }>;
  };
}

export interface Settings {
  prowlarr_url?: string;
  prowlarr_api_key?: string;
  qbittorrent_host?: string;
  qbittorrent_username?: string;
  qbittorrent_password?: string;
  igdb_client_id?: string;
  igdb_client_secret?: string;
  library_path?: string;
  steam_api_key?: string;
  steam_id?: string;
  dry_run?: boolean;
}

export interface Category {
  id: number;
  name: string;
  subCategories?: Category[];
}

export interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  parsedYear?: number;
  matched: boolean;
  gameId?: number;
  path: string;
}

export interface GameUpdate {
  id: number;
  gameId: number;
  updateType: 'version' | 'dlc' | 'better_release';
  title: string;
  version?: string;
  size?: number;
  quality?: string;
  seeders?: number;
  downloadUrl?: string;
  indexer?: string;
  detectedAt: string;
  status: 'pending' | 'grabbed' | 'dismissed';
}

// Integration types (HLTB, ProtonDB)
export type ProtonDBTier = 'native' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked' | 'pending';

export interface HLTBDisplayData {
  hltbId: string | null;
  main: number | null; // Hours
  mainExtra: number | null; // Hours
  completionist: number | null; // Hours
  mainFormatted: string;
  mainExtraFormatted: string;
  completionistFormatted: string;
  lastSync: Date | null;
}

export interface ProtonDBDisplayData {
  tier: ProtonDBTier | null;
  tierLabel: string;
  tierColor: string;
  tierDescription: string;
  score: number | null;
  isPlayable: boolean;
  lastSync: Date | null;
}

export interface GameIntegrationData {
  hltb: HLTBDisplayData;
  protonDb: ProtonDBDisplayData;
}

export interface GrabbedRelease {
  id: number;
  gameId: number;
  title: string;
  size?: number;
  seeders?: number;
  downloadUrl: string;
  indexer: string;
  quality?: string;
  torrentHash?: string;
  grabbedAt?: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
}

export interface DownloadHistoryEntry {
  id: number;
  gameId: number;
  releaseId: number;
  downloadId: string;
  status: string;
  progress: number;
  completedAt?: string;
}

export type GameEventType =
  | 'imported_steam'
  | 'imported_gog'
  | 'imported_manual'
  | 'imported_download'
  | 'igdb_rematch'
  | 'folder_matched'
  | 'status_changed';

export interface GameEvent {
  id: number;
  gameId: number;
  eventType: GameEventType;
  data?: string; // JSON string with event-specific data
  createdAt: string;
}

export interface SteamImportEventData {
  steamAppId: number;
  steamName: string;
  matchedTitle: string;
  igdbId: number;
}

export interface DownloadImportEventData {
  torrentName: string;
  torrentHash: string;
  matchedTitle: string;
  igdbId: number;
}

export interface GogImportEventData {
  gogId: number;
  gogTitle: string;
  matchedTitle: string;
  igdbId: number;
}

export interface IgdbRematchEventData {
  previousIgdbId: number;
  previousTitle: string;
  previousCoverUrl?: string;
  newIgdbId: number;
  newTitle: string;
  newCoverUrl?: string;
}

export interface FolderMatchedEventData {
  folderPath: string;
  folderName: string;
  matchedTitle: string;
  igdbId: number;
}

export interface PopularityType {
  id: number;
  name: string;
}

export interface SteamGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  headerImageUrl: string;
  alreadyInLibrary: boolean;
}

export interface GogGame {
  id: number;
  title: string;
  imageUrl: string;
  slug: string;
  alreadyInLibrary: boolean;
}

export interface LibraryDuplicate {
  igdbId: number;
  title: string;
  games: Game[];
}

export interface LooseFile {
  path: string;
  name: string;
  size: number;
}

export interface LogFile {
  name: string;
  size: number;
  sizeFormatted: string;
  modified: number;
  viewable: boolean;
}

export interface LogFileContent {
  content: string;
  totalLines: number;
}

export interface AppUpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  lastChecked: string | null;
  isDismissed: boolean;
}

export interface AppUpdateSettings {
  enabled: boolean;
  schedule: 'daily' | 'weekly' | 'monthly';
  repo: string;
}

// Auth types
export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: string;
  lastLoginAt: string | null;
  hasApiKey?: boolean;
}

export interface AuthStatus {
  authEnabled: boolean;
  hasUsers: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
  message?: string;
}

export interface RegisterResponse {
  user: AuthUser;
  token: string;
  expiresAt: string;
  message: string;
}

export interface Library {
  id: number;
  name: string;
  path: string;
  platform?: string | null;
  monitored: boolean;
  downloadEnabled: boolean;
  downloadCategory?: string | null;
  priority: number;
  createdAt: Date;
}

export interface CreateLibraryRequest {
  name: string;
  path: string;
  platform?: string;
  monitored?: boolean;
  downloadEnabled?: boolean;
  downloadCategory?: string;
  priority?: number;
}

export interface UpdateLibraryRequest {
  name?: string;
  path?: string;
  platform?: string | null;
  monitored?: boolean;
  downloadEnabled?: boolean;
  downloadCategory?: string | null;
  priority?: number;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      // Include auth token if available
      const authToken = getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options?.headers,
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers,
        ...options,
      });

      // Handle 401 Unauthorized - clear auth token and notify listeners
      if (response.status === 401) {
        handleUnauthorized();
        return {
          success: false,
          error: 'Unauthorized - please log in again',
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Games
  async getGames(): Promise<ApiResponse<Game[]>> {
    return this.request<Game[]>('/games');
  }

  async getGame(id: number): Promise<ApiResponse<Game>> {
    return this.request<Game>(`/games/${id}`);
  }

  async addGame(game: AddGameRequest): Promise<ApiResponse<Game>> {
    return this.request<Game>('/games', {
      method: 'POST',
      body: JSON.stringify(game),
    });
  }

  async updateGame(id: number, game: UpdateGameRequest): Promise<ApiResponse<Game>> {
    return this.request<Game>(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(game),
    });
  }

  async deleteGame(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/games/${id}`, {
      method: 'DELETE',
    });
  }

  // Batch operations
  async batchUpdateGames(
    gameIds: number[],
    updates: { monitored?: boolean; status?: 'wanted' | 'downloading' | 'downloaded' }
  ): Promise<ApiResponse<{ updated: number }>> {
    return this.request<{ updated: number }>('/games/batch', {
      method: 'PUT',
      body: JSON.stringify({ gameIds, updates }),
    });
  }

  async batchDeleteGames(gameIds: number[]): Promise<ApiResponse<{ deleted: number }>> {
    return this.request<{ deleted: number }>('/games/batch', {
      method: 'DELETE',
      body: JSON.stringify({ gameIds }),
    });
  }

  async rematchGame(id: number, igdbId: number): Promise<ApiResponse<Game>> {
    return this.request<Game>(`/games/${id}/rematch`, {
      method: 'PATCH',
      body: JSON.stringify({ igdbId }),
    });
  }

  async updateGameStores(id: number, stores: string[]): Promise<ApiResponse<Game>> {
    return this.request<Game>(`/games/${id}/stores`, {
      method: 'PUT',
      body: JSON.stringify({ stores }),
    });
  }

  // Game Folders
  async getGameFolders(gameId: number): Promise<ApiResponse<GameFolder[]>> {
    return this.request<GameFolder[]>(`/games/${gameId}/folders`);
  }

  async addGameFolder(
    gameId: number,
    folder: { folderPath: string; version?: string; quality?: string; isPrimary?: boolean }
  ): Promise<ApiResponse<GameFolder>> {
    return this.request<GameFolder>(`/games/${gameId}/folders`, {
      method: 'POST',
      body: JSON.stringify(folder),
    });
  }

  async updateGameFolder(
    gameId: number,
    folderId: number,
    updates: { version?: string; quality?: string }
  ): Promise<ApiResponse<GameFolder>> {
    return this.request<GameFolder>(`/games/${gameId}/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteGameFolder(gameId: number, folderId: number): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request<{ deleted: boolean }>(`/games/${gameId}/folders/${folderId}`, {
      method: 'DELETE',
    });
  }

  async setFolderAsPrimary(gameId: number, folderId: number): Promise<ApiResponse<GameFolder>> {
    return this.request<GameFolder>(`/games/${gameId}/folders/${folderId}/primary`, {
      method: 'POST',
    });
  }

  async getGameBySlug(platform: string, slug: string): Promise<ApiResponse<Game>> {
    return this.request<Game>(`/games/lookup/${encodeURIComponent(platform)}/${encodeURIComponent(slug)}`);
  }

  async getGameReleases(gameId: number): Promise<ApiResponse<GrabbedRelease[]>> {
    return this.request<GrabbedRelease[]>(`/games/${gameId}/releases`);
  }

  async getGameHistory(gameId: number): Promise<ApiResponse<DownloadHistoryEntry[]>> {
    return this.request<DownloadHistoryEntry[]>(`/games/${gameId}/history`);
  }

  async getGameEvents(gameId: number): Promise<ApiResponse<GameEvent[]>> {
    return this.request<GameEvent[]>(`/games/${gameId}/events`);
  }

  // Game Integrations (HLTB, ProtonDB)
  async getGameIntegrations(gameId: number): Promise<ApiResponse<GameIntegrationData>> {
    return this.request<GameIntegrationData>(`/games/${gameId}/integrations`);
  }

  async syncGameIntegrations(gameId: number): Promise<ApiResponse<GameIntegrationData>> {
    return this.request<GameIntegrationData>(`/games/${gameId}/integrations/sync`, {
      method: 'POST',
    });
  }

  async syncGameHLTB(gameId: number): Promise<ApiResponse<HLTBDisplayData>> {
    return this.request<HLTBDisplayData>(`/games/${gameId}/hltb/sync`, {
      method: 'POST',
    });
  }

  async syncGameProtonDB(gameId: number): Promise<ApiResponse<ProtonDBDisplayData>> {
    return this.request<ProtonDBDisplayData>(`/games/${gameId}/protondb/sync`, {
      method: 'POST',
    });
  }

  async batchSyncHLTB(gameIds: number[]): Promise<ApiResponse<{ synced: number; failed: number }>> {
    return this.request<{ synced: number; failed: number }>('/games/batch/hltb/sync', {
      method: 'POST',
      body: JSON.stringify({ gameIds }),
    });
  }

  async batchSyncProtonDB(gameIds: number[]): Promise<ApiResponse<{ synced: number; skipped: number; failed: number }>> {
    return this.request<{ synced: number; skipped: number; failed: number }>('/games/batch/protondb/sync', {
      method: 'POST',
      body: JSON.stringify({ gameIds }),
    });
  }

  // Search
  async searchGames(query: string): Promise<ApiResponse<SearchResult[]>> {
    return this.request<SearchResult[]>(`/search/games?q=${encodeURIComponent(query)}`);
  }

  async searchReleases(gameId: number): Promise<ApiResponse<Release[]>> {
    return this.request<Release[]>(`/search/releases/${gameId}`);
  }

  async manualSearchReleases(query: string): Promise<ApiResponse<Release[]>> {
    return this.request<Release[]>(`/search/releases?q=${encodeURIComponent(query)}`);
  }

  // Downloads
  async getDownloads(includeCompleted: boolean = false): Promise<ApiResponse<Download[]>> {
    const params = includeCompleted ? '?includeCompleted=true' : '';
    return this.request<Download[]>(`/downloads${params}`);
  }

  async getDownload(hash: string): Promise<ApiResponse<Download>> {
    return this.request<Download>(`/downloads/${hash}`);
  }

  async cancelDownload(hash: string, deleteFiles: boolean = false): Promise<ApiResponse<void>> {
    return this.request<void>(`/downloads/${hash}?deleteFiles=${deleteFiles}`, {
      method: 'DELETE',
    });
  }

  async pauseDownload(hash: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/downloads/${hash}/pause`, {
      method: 'POST',
    });
  }

  async resumeDownload(hash: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/downloads/${hash}/resume`, {
      method: 'POST',
    });
  }

  async pauseAllDownloads(): Promise<ApiResponse<void>> {
    return this.request<void>('/downloads/pause-all', {
      method: 'POST',
    });
  }

  async resumeAllDownloads(): Promise<ApiResponse<void>> {
    return this.request<void>('/downloads/resume-all', {
      method: 'POST',
    });
  }

  // Grab release
  async grabRelease(gameId: number, release: ReleaseData): Promise<ApiResponse<{ hash: string }>> {
    return this.request<{ hash: string }>('/search/grab', {
      method: 'POST',
      body: JSON.stringify({ gameId, release }),
    });
  }

  // System
  async getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
    return this.request<SystemStatus>('/system/status');
  }

  async getSetupStatus(): Promise<ApiResponse<SetupStatus>> {
    return this.request<SetupStatus>('/system/setup-status');
  }

  async skipSetup(): Promise<ApiResponse<void>> {
    return this.request<void>('/system/skip-setup', { method: 'POST' });
  }

  // Indexers
  async getIndexers(): Promise<ApiResponse<Indexer[]>> {
    return this.request<Indexer[]>('/indexers');
  }

  // Settings
  async getSettings(): Promise<ApiResponse<Settings>> {
    return this.request<Settings>('/settings');
  }

  async updateSettings(settings: SettingsUpdate): Promise<ApiResponse<void>> {
    return this.request<void>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getCategories(): Promise<ApiResponse<Category[]>> {
    return this.request<Category[]>('/settings/categories');
  }

  async getSelectedCategories(): Promise<ApiResponse<number[]>> {
    return this.request<number[]>('/settings/categories/selected');
  }

  async updateCategories(categories: number[]): Promise<ApiResponse<void>> {
    return this.request<void>('/settings/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    });
  }

  // qBittorrent category
  async getQBittorrentCategories(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/settings/qbittorrent/categories');
  }

  async getQBittorrentCategory(): Promise<ApiResponse<string>> {
    return this.request<string>('/settings/qbittorrent/category');
  }

  async updateQBittorrentCategory(category: string): Promise<ApiResponse<void>> {
    return this.request<void>('/settings/qbittorrent/category', {
      method: 'PUT',
      body: JSON.stringify({ category }),
    });
  }

  // Individual setting get/set
  async getSetting<T = string>(key: string): Promise<ApiResponse<T>> {
    return this.request<T>(`/settings/${key}`);
  }

  async updateSetting(key: string, value: string | boolean | number): Promise<ApiResponse<void>> {
    return this.request<void>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  // Connection tests
  async testProwlarrConnection(): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('/indexers/test');
  }

  async testQbittorrentConnection(): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('/downloads/test');
  }

  async testSteamConnection(): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('/steam/test');
  }

  async testDiscordConnection(): Promise<ApiResponse<boolean>> {
    return this.request<boolean>('/notifications/test/discord');
  }

  // Steam Integration
  async getSteamOwnedGames(): Promise<ApiResponse<SteamGame[]>> {
    return this.request<SteamGame[]>('/steam/owned-games');
  }

  async importSteamGames(appIds: number[]): Promise<ApiResponse<{ imported: number; skipped: number }>> {
    return this.request<{ imported: number; skipped: number }>('/steam/import', {
      method: 'POST',
      body: JSON.stringify({ appIds }),
    });
  }

  /**
   * Import Steam games with SSE progress streaming
   * @param appIds - Array of Steam app IDs to import
   * @param onProgress - Callback for progress updates (current game being processed)
   * @param onComplete - Callback when import completes
   * @param onError - Callback for errors
   */
  async importSteamGamesStream(
    appIds: number[],
    onProgress: (data: Omit<SteamImportProgressEvent, 'type'>) => void,
    onComplete: (data: Omit<SteamImportCompleteEvent, 'type'>) => void,
    onError: (message: string) => void
  ): Promise<void> {
    try {
      // Include auth token if available
      const authToken = getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE}/steam/import-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ appIds }),
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        handleUnauthorized();
        onError('Unauthorized - please log in again');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Import failed');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response stream');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                onProgress(data);
              } else if (data.type === 'complete') {
                onComplete(data);
              } else if (data.type === 'error') {
                onError(data.message);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // GOG Integration
  async getGogAuthUrl(): Promise<ApiResponse<{ url: string }>> {
    return this.request<{ url: string }>('/gog/auth/url');
  }

  async exchangeGogCode(code: string): Promise<ApiResponse<{ username?: string }>> {
    return this.request<{ username?: string }>('/gog/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async testGogConnection(): Promise<ApiResponse<{ connected: boolean; username?: string }>> {
    return this.request<{ connected: boolean; username?: string }>('/gog/test');
  }

  async getGogOwnedGames(): Promise<ApiResponse<GogGame[]>> {
    return this.request<GogGame[]>('/gog/owned-games');
  }

  async importGogGames(gameIds: number[]): Promise<ApiResponse<{ imported: number; skipped: number }>> {
    return this.request<{ imported: number; skipped: number }>('/gog/import', {
      method: 'POST',
      body: JSON.stringify({ gameIds }),
    });
  }

  /**
   * Import GOG games with SSE progress streaming
   * @param gameIds - Array of GOG game IDs to import
   * @param onProgress - Callback for progress updates (current game being processed)
   * @param onComplete - Callback when import completes
   * @param onError - Callback for errors
   */
  async importGogGamesStream(
    gameIds: number[],
    onProgress: (data: Omit<GogImportProgressEvent, 'type'>) => void,
    onComplete: (data: Omit<GogImportCompleteEvent, 'type'>) => void,
    onError: (message: string) => void
  ): Promise<void> {
    try {
      const authToken = getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_BASE}/gog/import-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ gameIds }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        onError('Unauthorized - please log in again');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        onError(data.error || 'Import failed');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response stream');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                onProgress(data);
              } else if (data.type === 'complete') {
                onComplete(data);
              } else if (data.type === 'error') {
                onError(data.message);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Library
  async getLibraryScanCount(): Promise<ApiResponse<{ count: number }>> {
    return this.request<{ count: number }>('/library/scan/count');
  }

  async getLibraryHealthCount(): Promise<ApiResponse<{ count: number; duplicatesCount: number; looseFilesCount: number }>> {
    return this.request<{ count: number; duplicatesCount: number; looseFilesCount: number }>('/library/health/count');
  }

  async scanLibrary(): Promise<ApiResponse<LibraryFolder[]>> {
    return this.request<LibraryFolder[]>('/library/scan', {
      method: 'POST',
    });
  }

  async autoMatchFolder(parsedTitle: string, parsedYear?: number): Promise<ApiResponse<SearchResult | null>> {
    return this.request<SearchResult | null>('/library/auto-match', {
      method: 'POST',
      body: JSON.stringify({ parsedTitle, parsedYear }),
    });
  }

  async matchLibraryFolder(folderPath: string, folderName: string, igdbGame: IGDBGame, store?: string | null, libraryId?: number | null): Promise<ApiResponse<Game>> {
    return this.request<Game>('/library/match', {
      method: 'POST',
      body: JSON.stringify({ folderPath, folderName, igdbGame, store, libraryId }),
    });
  }

  // Library Health
  async getLibraryDuplicates(): Promise<ApiResponse<LibraryDuplicate[]>> {
    return this.request<LibraryDuplicate[]>('/library/health/duplicates');
  }

  async getLibraryLooseFiles(): Promise<ApiResponse<LooseFile[]>> {
    return this.request<LooseFile[]>('/library/health/loose-files');
  }

  async organizeLooseFile(filePath: string, folderName: string): Promise<ApiResponse<void>> {
    return this.request<void>('/library/health/organize-file', {
      method: 'POST',
      body: JSON.stringify({ filePath, folderName }),
    });
  }

  // Updates
  async getPendingUpdates(): Promise<ApiResponse<GameUpdate[]>> {
    return this.request<GameUpdate[]>('/updates');
  }

  async checkAllUpdates(): Promise<ApiResponse<{ checked: number; updatesFound: number }>> {
    return this.request<{ checked: number; updatesFound: number }>('/updates/check');
  }

  async getGameUpdates(gameId: number): Promise<ApiResponse<GameUpdate[]>> {
    return this.request<GameUpdate[]>(`/updates/games/${gameId}`);
  }

  async checkGameForUpdates(gameId: number): Promise<ApiResponse<GameUpdate[]>> {
    return this.request<GameUpdate[]>(`/updates/games/${gameId}/check`, {
      method: 'POST',
    });
  }

  async setUpdatePolicy(gameId: number, policy: 'notify' | 'auto' | 'ignore'): Promise<ApiResponse<void>> {
    return this.request<void>(`/updates/games/${gameId}/policy`, {
      method: 'PUT',
      body: JSON.stringify({ policy }),
    });
  }

  async grabUpdate(updateId: number): Promise<ApiResponse<{ hash: string }>> {
    return this.request<{ hash: string }>(`/updates/${updateId}/grab`, {
      method: 'POST',
    });
  }

  async dismissUpdate(updateId: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/updates/${updateId}/dismiss`, {
      method: 'POST',
    });
  }

  // Discover
  async getPopularityTypes(): Promise<ApiResponse<PopularityType[]>> {
    return this.request<PopularityType[]>('/discover/popularity-types');
  }

  async getPopularGames(type: number, limit: number = 20): Promise<ApiResponse<SearchResult[]>> {
    return this.request<SearchResult[]>(`/discover/popular?type=${type}&limit=${limit}`);
  }

  // Indexer Torrents
  async getTopTorrents(query?: string, limit?: number, maxAgeDays?: number): Promise<ApiResponse<Release[]>> {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (limit) params.set('limit', limit.toString());
    if (maxAgeDays) params.set('maxAge', maxAgeDays.toString());
    const queryString = params.toString();
    return this.request<Release[]>(`/indexers/torrents${queryString ? '?' + queryString : ''}`);
  }

  // Libraries
  async getLibraries(): Promise<ApiResponse<Library[]>> {
    return this.request<Library[]>('/libraries');
  }

  async getLibrary(id: number): Promise<ApiResponse<Library>> {
    return this.request<Library>(`/libraries/${id}`);
  }

  async createLibrary(library: CreateLibraryRequest): Promise<ApiResponse<Library>> {
    return this.request<Library>('/libraries', {
      method: 'POST',
      body: JSON.stringify(library),
    });
  }

  async updateLibrary(id: number, library: UpdateLibraryRequest): Promise<ApiResponse<Library>> {
    return this.request<Library>(`/libraries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(library),
    });
  }

  async deleteLibrary(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/libraries/${id}`, {
      method: 'DELETE',
    });
  }

  async testLibraryPath(path: string): Promise<ApiResponse<{ valid: boolean; error?: string }>> {
    return this.request<{ valid: boolean; error?: string }>('/libraries/test-path', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  }

  async getLibraryPlatforms(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/libraries/platforms');
  }

  // System
  async openFolder(path: string): Promise<ApiResponse<{ path: string }>> {
    return this.request<{ path: string }>('/system/open-folder', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  }

  // Logs
  async getLogFiles(): Promise<ApiResponse<{ files: LogFile[] }>> {
    return this.request<{ files: LogFile[] }>('/system/logs');
  }

  async getLogFileContent(filename: string): Promise<ApiResponse<LogFileContent>> {
    return this.request<LogFileContent>(`/system/logs/${encodeURIComponent(filename)}`);
  }

  async downloadLogFile(filename: string): Promise<void> {
    const authToken = getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}/system/logs/${encodeURIComponent(filename)}/download`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Application Updates
  async getAppUpdateStatus(): Promise<ApiResponse<AppUpdateStatus>> {
    return this.request<AppUpdateStatus>('/system/update/status');
  }

  async checkForAppUpdates(): Promise<ApiResponse<{ currentVersion: string; latestVersion: string | null; updateAvailable: boolean }>> {
    return this.request<{ currentVersion: string; latestVersion: string | null; updateAvailable: boolean }>('/system/update/check', {
      method: 'POST',
    });
  }

  async dismissAppUpdate(): Promise<ApiResponse<void>> {
    return this.request<void>('/system/update/dismiss', {
      method: 'POST',
    });
  }

  async getAppUpdateSettings(): Promise<ApiResponse<AppUpdateSettings>> {
    return this.request<AppUpdateSettings>('/system/update/settings');
  }

  async updateAppUpdateSettings(settings: Partial<AppUpdateSettings>): Promise<ApiResponse<void>> {
    return this.request<void>('/system/update/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Auth methods
  async getAuthStatus(): Promise<ApiResponse<AuthStatus>> {
    return this.request<AuthStatus>('/auth/status');
  }

  async login(username: string, password: string, rememberMe: boolean = false): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>('/auth/logout', {
      method: 'POST',
    });
  }

  async register(username: string, password: string): Promise<ApiResponse<RegisterResponse>> {
    return this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<AuthUser>> {
    return this.request<AuthUser>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async generateApiKey(): Promise<ApiResponse<{ apiKey: string; message: string }>> {
    return this.request<{ apiKey: string; message: string }>('/auth/api-key', {
      method: 'POST',
    });
  }

  async revokeApiKey(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/auth/api-key', {
      method: 'DELETE',
    });
  }

  // Admin user management
  async getUsers(): Promise<ApiResponse<AuthUser[]>> {
    return this.request<AuthUser[]>('/auth/users');
  }

  async createUser(username: string, password: string, role: 'admin' | 'user' | 'viewer' = 'user'): Promise<ApiResponse<AuthUser>> {
    return this.request<AuthUser>('/auth/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  }

  async deleteUser(id: number): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/auth/users/${id}`, {
      method: 'DELETE',
    });
  }

  async resetUserPassword(id: number, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/auth/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async disableAuth(): Promise<ApiResponse<{ authEnabled: boolean; message: string }>> {
    return this.request<{ authEnabled: boolean; message: string }>('/auth/disable', {
      method: 'POST',
    });
  }

  async enableAuth(): Promise<ApiResponse<{ authEnabled: boolean; message: string }>> {
    return this.request<{ authEnabled: boolean; message: string }>('/auth/enable', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
