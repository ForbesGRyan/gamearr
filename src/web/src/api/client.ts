const API_BASE = '/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

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
  async getGames() {
    return this.request('/games');
  }

  async getGame(id: number) {
    return this.request(`/games/${id}`);
  }

  async addGame(game: any) {
    return this.request('/games', {
      method: 'POST',
      body: JSON.stringify(game),
    });
  }

  async updateGame(id: number, game: any) {
    return this.request(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(game),
    });
  }

  async deleteGame(id: number) {
    return this.request(`/games/${id}`, {
      method: 'DELETE',
    });
  }

  // Search
  async searchGames(query: string) {
    return this.request(`/search/games?q=${encodeURIComponent(query)}`);
  }

  async searchReleases(gameId: number) {
    return this.request(`/search/releases/${gameId}`, {
      method: 'POST',
    });
  }

  async manualSearchReleases(query: string) {
    return this.request(`/search/releases?q=${encodeURIComponent(query)}`);
  }

  // Downloads
  async getDownloads() {
    return this.request('/downloads');
  }

  async getDownload(hash: string) {
    return this.request(`/downloads/${hash}`);
  }

  async cancelDownload(hash: string, deleteFiles: boolean = false) {
    return this.request(`/downloads/${hash}?deleteFiles=${deleteFiles}`, {
      method: 'DELETE',
    });
  }

  async pauseDownload(hash: string) {
    return this.request(`/downloads/${hash}/pause`, {
      method: 'POST',
    });
  }

  async resumeDownload(hash: string) {
    return this.request(`/downloads/${hash}/resume`, {
      method: 'POST',
    });
  }

  // Grab release
  async grabRelease(gameId: number, release: any) {
    return this.request('/search/grab', {
      method: 'POST',
      body: JSON.stringify({ gameId, release }),
    });
  }

  // System
  async getSystemStatus() {
    return this.request('/system/status');
  }

  // Indexers
  async getIndexers() {
    return this.request('/indexers');
  }

  // Settings
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settings: any) {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getCategories() {
    return this.request('/settings/categories');
  }

  async getSelectedCategories() {
    return this.request('/settings/categories/selected');
  }

  async updateCategories(categories: number[]) {
    return this.request('/settings/categories', {
      method: 'PUT',
      body: JSON.stringify({ categories }),
    });
  }

  // qBittorrent category
  async getQBittorrentCategories() {
    return this.request('/settings/qbittorrent/categories');
  }

  async getQBittorrentCategory() {
    return this.request('/settings/qbittorrent/category');
  }

  async updateQBittorrentCategory(category: string) {
    return this.request('/settings/qbittorrent/category', {
      method: 'PUT',
      body: JSON.stringify({ category }),
    });
  }

  // Individual setting get/set
  async getSetting(key: string) {
    return this.request(`/settings/${key}`);
  }

  async updateSetting(key: string, value: string | boolean | number) {
    return this.request(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  // Connection tests
  async testProwlarrConnection() {
    return this.request<boolean>('/indexers/test');
  }

  async testQbittorrentConnection() {
    return this.request<boolean>('/downloads/test');
  }

  // Library
  async scanLibrary() {
    return this.request('/library/scan', {
      method: 'POST',
    });
  }

  async autoMatchFolder(parsedTitle: string, parsedYear?: number) {
    return this.request('/library/auto-match', {
      method: 'POST',
      body: JSON.stringify({ parsedTitle, parsedYear }),
    });
  }

  async matchLibraryFolder(folderPath: string, folderName: string, igdbGame: any, store?: string | null) {
    return this.request('/library/match', {
      method: 'POST',
      body: JSON.stringify({ folderPath, folderName, igdbGame, store }),
    });
  }

  // Library Health
  async getLibraryDuplicates() {
    return this.request('/library/health/duplicates');
  }

  async getLibraryLooseFiles() {
    return this.request('/library/health/loose-files');
  }

  async organizeLooseFile(filePath: string) {
    return this.request('/library/health/organize-file', {
      method: 'POST',
      body: JSON.stringify({ filePath }),
    });
  }

  // Updates
  async getPendingUpdates() {
    return this.request('/updates');
  }

  async checkAllUpdates() {
    return this.request('/updates/check');
  }

  async getGameUpdates(gameId: number) {
    return this.request(`/updates/games/${gameId}`);
  }

  async checkGameForUpdates(gameId: number) {
    return this.request(`/updates/games/${gameId}/check`, {
      method: 'POST',
    });
  }

  async setUpdatePolicy(gameId: number, policy: 'notify' | 'auto' | 'ignore') {
    return this.request(`/updates/games/${gameId}/policy`, {
      method: 'POST',
      body: JSON.stringify({ policy }),
    });
  }

  async grabUpdate(updateId: number) {
    return this.request(`/updates/${updateId}/grab`, {
      method: 'POST',
    });
  }

  async dismissUpdate(updateId: number) {
    return this.request(`/updates/${updateId}/dismiss`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
