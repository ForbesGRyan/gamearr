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

  async updateSetting(key: string, value: string) {
    return this.request(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
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
}

export const api = new ApiClient();
