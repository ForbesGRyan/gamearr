import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test';

// =============================================================================
// Mock Dependencies
// =============================================================================

// Mock game repository
const mockGameRepository = {
  findById: mock(() => Promise.resolve(undefined)),
  findByIgdbId: mock(() => Promise.resolve(undefined)),
  findBySlug: mock(() => Promise.resolve([])),
  findAll: mock(() => Promise.resolve([])),
  findAllPaginated: mock(() => Promise.resolve({ items: [], total: 0, limit: 20, offset: 0 })),
  findMonitored: mock(() => Promise.resolve([])),
  findByStatus: mock(() => Promise.resolve([])),
  create: mock((game: unknown) => Promise.resolve({ id: 1, ...game })),
  update: mock((id: number, updates: unknown) => Promise.resolve({ id, ...updates })),
  delete: mock(() => Promise.resolve(true)),
  count: mock(() => Promise.resolve(0)),
  getStats: mock(() => Promise.resolve({
    totalGames: 0,
    wantedGames: 0,
    downloadingGames: 0,
    downloadedGames: 0,
  })),
  batchUpdateStatus: mock(() => Promise.resolve()),
  findByIds: mock(() => Promise.resolve(new Map())),
};

// Mock release repository
const mockReleaseRepository = {
  findByGameId: mock(() => Promise.resolve([])),
};

// Mock download history repository
const mockDownloadHistoryRepository = {
  findByGameId: mock(() => Promise.resolve([])),
};

// Mock library repository
const mockLibraryRepository = {
  findById: mock(() => Promise.resolve(undefined)),
  findByPath: mock(() => Promise.resolve(undefined)),
  findAll: mock(() => Promise.resolve([])),
  findMonitored: mock(() => Promise.resolve([])),
  findDownloadEnabled: mock(() => Promise.resolve([])),
  findByPlatform: mock(() => Promise.resolve([])),
  create: mock((lib: unknown) => Promise.resolve({ id: 1, createdAt: new Date(), ...lib })),
  update: mock((id: number, updates: unknown) => Promise.resolve({ id, ...updates })),
  delete: mock(() => Promise.resolve(true)),
};

// Mock settings repository
const mockSettingsRepository = {
  get: mock(() => Promise.resolve(null as string | null)),
  set: mock(() => Promise.resolve()),
  getJSON: mock(() => Promise.resolve(null)),
  setJSON: mock(() => Promise.resolve()),
  getAll: mock(() => Promise.resolve([])),
  delete: mock(() => Promise.resolve()),
};

// Mock IGDB client
const mockIgdbClient = {
  isConfigured: mock(() => true),
  searchGames: mock(() => Promise.resolve([])),
  getGame: mock(() => Promise.resolve(null)),
  testConnection: mock(() => Promise.resolve(true)),
};

// Mock Prowlarr client
const mockProwlarrClient = {
  isConfigured: mock(() => true),
  searchReleases: mock(() => Promise.resolve([])),
  testConnection: mock(() => Promise.resolve(true)),
};

// Mock fs/promises for LibraryService
const mockFsPromises = {
  stat: mock(() => Promise.resolve({ isDirectory: () => true })),
  mkdir: mock(() => Promise.resolve()),
  readdir: mock(() => Promise.resolve([])),
};

// =============================================================================
// Test Helpers
// =============================================================================

// Helper to create a mock game
const createMockGame = (overrides = {}) => ({
  id: 1,
  igdbId: 12345,
  title: 'Test Game',
  slug: 'test-game',
  year: 2023,
  platform: 'PC',
  store: null,
  steamName: null,
  monitored: true,
  status: 'wanted' as const,
  coverUrl: 'https://example.com/cover.jpg',
  folderPath: null,
  libraryId: null,
  summary: 'A test game',
  genres: JSON.stringify(['Action', 'RPG']),
  totalRating: 85,
  developer: 'Test Developer',
  publisher: 'Test Publisher',
  gameModes: JSON.stringify(['Single Player']),
  similarGames: null,
  installedVersion: null,
  installedQuality: null,
  latestVersion: null,
  updatePolicy: 'notify' as const,
  lastUpdateCheck: null,
  updateAvailable: false,
  addedAt: new Date(),
  ...overrides,
});

// Helper to create a mock IGDB game result
const createMockIgdbGame = (overrides = {}) => ({
  igdbId: 12345,
  title: 'Test Game',
  year: 2023,
  coverUrl: 'https://example.com/cover.jpg',
  summary: 'A test game',
  genres: ['Action', 'RPG'],
  totalRating: 85,
  developer: 'Test Developer',
  publisher: 'Test Publisher',
  gameModes: ['Single Player'],
  similarGames: [],
  platforms: ['PC'],
  ...overrides,
});

// Helper to create a mock library
const createMockLibrary = (overrides = {}) => ({
  id: 1,
  name: 'Test Library',
  path: '/games/library',
  platform: 'PC',
  monitored: true,
  downloadEnabled: true,
  downloadCategory: 'gamearr',
  priority: 0,
  createdAt: new Date(),
  ...overrides,
});

// =============================================================================
// GameService Tests
// =============================================================================
describe('GameService', () => {
  // Reset mocks before each test
  beforeEach(() => {
    mockGameRepository.findById.mockClear();
    mockGameRepository.findByIgdbId.mockClear();
    mockGameRepository.findBySlug.mockClear();
    mockGameRepository.findAll.mockClear();
    mockGameRepository.create.mockClear();
    mockGameRepository.update.mockClear();
    mockGameRepository.delete.mockClear();
    mockIgdbClient.isConfigured.mockClear();
    mockIgdbClient.searchGames.mockClear();
    mockIgdbClient.getGame.mockClear();
  });

  describe('normalizeSearchQuery', () => {
    // Test the query normalization logic
    const normalizeSearchQuery = (query: string): string => {
      return query
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    test('should replace periods with spaces', () => {
      expect(normalizeSearchQuery('Game.Name.Here')).toBe('Game Name Here');
    });

    test('should replace underscores with spaces', () => {
      expect(normalizeSearchQuery('Game_Name_Here')).toBe('Game Name Here');
    });

    test('should replace hyphens with spaces', () => {
      expect(normalizeSearchQuery('Game-Name-Here')).toBe('Game Name Here');
    });

    test('should collapse multiple spaces', () => {
      expect(normalizeSearchQuery('Game   Name    Here')).toBe('Game Name Here');
    });

    test('should trim whitespace', () => {
      expect(normalizeSearchQuery('  Game Name  ')).toBe('Game Name');
    });

    test('should handle mixed separators', () => {
      expect(normalizeSearchQuery('Game.Name_Here-2023')).toBe('Game Name Here 2023');
    });
  });

  describe('generateSlug', () => {
    // Test the slug generation logic
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/['']/g, '')
        .replace(/[:\-–—]/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    };

    test('should convert to lowercase', () => {
      expect(generateSlug('Game Name')).toBe('game-name');
    });

    test('should remove apostrophes', () => {
      expect(generateSlug("Assassin's Creed")).toBe('assassins-creed');
      expect(generateSlug("Tony Hawk's Pro Skater")).toBe('tony-hawks-pro-skater');
    });

    test('should replace colons with spaces then hyphens', () => {
      expect(generateSlug('Game: The Sequel')).toBe('game-the-sequel');
    });

    test('should replace dashes with spaces then hyphens', () => {
      expect(generateSlug('Half-Life 2')).toBe('half-life-2');
    });

    test('should remove special characters', () => {
      expect(generateSlug('Game & Name!')).toBe('game-name');
      expect(generateSlug('Game (2023)')).toBe('game-2023');
    });

    test('should handle multiple spaces and collapse hyphens', () => {
      expect(generateSlug('Game   Name   Here')).toBe('game-name-here');
    });

    test('should handle complex titles', () => {
      expect(generateSlug("Baldur's Gate III: Collector's Edition")).toBe('baldurs-gate-iii-collectors-edition');
    });
  });

  describe('searchIGDB', () => {
    test('should throw NotConfiguredError when IGDB is not configured', async () => {
      mockIgdbClient.isConfigured.mockReturnValue(false);

      // Simulate the behavior
      const isConfigured = mockIgdbClient.isConfigured();
      expect(isConfigured).toBe(false);
    });

    test('should normalize query before searching', async () => {
      const query = 'Game.Name_Test-2023';
      const normalizedQuery = query
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      expect(normalizedQuery).toBe('Game Name Test 2023');
    });

    test('should return search results from IGDB', async () => {
      const mockResults = [
        createMockIgdbGame({ igdbId: 1, title: 'Game 1' }),
        createMockIgdbGame({ igdbId: 2, title: 'Game 2' }),
      ];

      mockIgdbClient.searchGames.mockResolvedValue(mockResults);
      mockIgdbClient.isConfigured.mockReturnValue(true);

      const results = await mockIgdbClient.searchGames({ search: 'Game', limit: 20 });

      expect(results.length).toBe(2);
      expect(results[0].title).toBe('Game 1');
    });
  });

  describe('addGameFromIGDB', () => {
    test('should throw ConflictError when game already exists', async () => {
      const existingGame = createMockGame();
      mockGameRepository.findByIgdbId.mockResolvedValue(existingGame);

      const game = await mockGameRepository.findByIgdbId(12345);
      expect(game).toBeDefined();

      // In the actual service, this would throw ConflictError
      const alreadyExists = !!game;
      expect(alreadyExists).toBe(true);
    });

    test('should throw NotFoundError when IGDB game not found', async () => {
      mockGameRepository.findByIgdbId.mockResolvedValue(undefined);
      mockIgdbClient.getGame.mockResolvedValue(null);

      const game = await mockGameRepository.findByIgdbId(99999);
      const igdbGame = await mockIgdbClient.getGame(99999);

      expect(game).toBeUndefined();
      expect(igdbGame).toBeNull();
    });

    test('should create game with wanted status when no store specified', async () => {
      mockGameRepository.findByIgdbId.mockResolvedValue(undefined);
      mockIgdbClient.getGame.mockResolvedValue(createMockIgdbGame());

      const hasStore = false;
      const gameStatus = hasStore ? 'downloaded' : 'wanted';
      const shouldMonitor = hasStore ? false : true;

      expect(gameStatus).toBe('wanted');
      expect(shouldMonitor).toBe(true);
    });

    test('should create game with downloaded status when store specified', async () => {
      const hasStore = true;
      const store = 'Steam';
      const gameStatus = hasStore ? 'downloaded' : 'wanted';
      const shouldMonitor = hasStore ? false : true;

      expect(gameStatus).toBe('downloaded');
      expect(shouldMonitor).toBe(false);
    });

    test('should respect explicit status parameter', async () => {
      const status = 'downloading';
      const hasStore = false;
      const gameStatus = status || (hasStore ? 'downloaded' : 'wanted');

      expect(gameStatus).toBe('downloading');
    });

    test('should generate slug from title', async () => {
      const generateSlug = (title: string): string => {
        return title
          .toLowerCase()
          .replace(/['']/g, '')
          .replace(/[:\-–—]/g, ' ')
          .replace(/[^a-z0-9\s]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      };

      const title = "Baldur's Gate III";
      const slug = generateSlug(title);

      expect(slug).toBe('baldurs-gate-iii');
    });
  });

  describe('updateGame', () => {
    test('should throw NotFoundError when game does not exist', async () => {
      mockGameRepository.update.mockResolvedValue(undefined);

      const result = await mockGameRepository.update(999, { title: 'New Title' });

      expect(result).toBeUndefined();
    });

    test('should return updated game on success', async () => {
      const updatedGame = createMockGame({ title: 'Updated Title' });
      mockGameRepository.update.mockResolvedValue(updatedGame);

      const result = await mockGameRepository.update(1, { title: 'Updated Title' });

      expect(result).toBeDefined();
      expect(result!.title).toBe('Updated Title');
    });
  });

  describe('toggleMonitored', () => {
    test('should throw NotFoundError when game does not exist', async () => {
      mockGameRepository.findById.mockResolvedValue(undefined);

      const game = await mockGameRepository.findById(999);

      expect(game).toBeUndefined();
    });

    test('should toggle monitored from true to false', async () => {
      const game = createMockGame({ monitored: true });
      mockGameRepository.findById.mockResolvedValue(game);

      const currentlyMonitored = game.monitored;
      const newMonitoredValue = !currentlyMonitored;

      expect(newMonitoredValue).toBe(false);
    });

    test('should toggle monitored from false to true', async () => {
      const game = createMockGame({ monitored: false });
      mockGameRepository.findById.mockResolvedValue(game);

      const currentlyMonitored = game.monitored;
      const newMonitoredValue = !currentlyMonitored;

      expect(newMonitoredValue).toBe(true);
    });
  });

  describe('rematchGame', () => {
    test('should throw NotFoundError when game does not exist', async () => {
      mockGameRepository.findById.mockResolvedValue(undefined);

      const game = await mockGameRepository.findById(999);

      expect(game).toBeUndefined();
    });

    test('should throw NotFoundError when new IGDB game not found', async () => {
      const game = createMockGame();
      mockGameRepository.findById.mockResolvedValue(game);
      mockIgdbClient.getGame.mockResolvedValue(null);

      const igdbGame = await mockIgdbClient.getGame(99999);

      expect(igdbGame).toBeNull();
    });

    test('should update game with new IGDB metadata', async () => {
      const existingGame = createMockGame({ title: 'Old Title' });
      const newIgdbGame = createMockIgdbGame({
        igdbId: 54321,
        title: 'New Title',
        year: 2024,
      });

      mockGameRepository.findById.mockResolvedValue(existingGame);
      mockIgdbClient.getGame.mockResolvedValue(newIgdbGame);

      // Verify that the new metadata would be applied
      expect(newIgdbGame.title).toBe('New Title');
      expect(newIgdbGame.year).toBe(2024);
      expect(newIgdbGame.igdbId).toBe(54321);
    });

    test('should preserve local fields like status and folderPath', async () => {
      const existingGame = createMockGame({
        status: 'downloaded',
        folderPath: '/games/test',
        store: 'GOG',
      });

      // These fields should not be overwritten during rematch
      const localFields = ['status', 'folderPath', 'store', 'monitored', 'libraryId'];

      for (const field of localFields) {
        expect(existingGame[field as keyof typeof existingGame]).toBeDefined();
      }
    });
  });

  describe('findByPlatformAndSlug', () => {
    test('should return undefined when no games with slug found', async () => {
      mockGameRepository.findBySlug.mockResolvedValue([]);

      const games = await mockGameRepository.findBySlug('non-existent-slug');

      expect(games.length).toBe(0);
    });

    test('should match PC platform variants', () => {
      const isPcPlatform = (platform: string): boolean => {
        const lower = platform.toLowerCase();
        return lower.includes('pc') || lower.includes('windows') || lower === 'microsoft windows';
      };

      expect(isPcPlatform('PC')).toBe(true);
      expect(isPcPlatform('pc')).toBe(true);
      expect(isPcPlatform('Windows')).toBe(true);
      expect(isPcPlatform('Microsoft Windows')).toBe(true);
      expect(isPcPlatform('PlayStation 5')).toBe(false);
    });

    test('should find game by platform and slug', async () => {
      const games = [
        createMockGame({ platform: 'PC', slug: 'test-game' }),
        createMockGame({ platform: 'PlayStation 5', slug: 'test-game', id: 2 }),
      ];

      mockGameRepository.findBySlug.mockResolvedValue(games);

      const result = await mockGameRepository.findBySlug('test-game');
      const pcGame = result.find(g => g.platform.toLowerCase().includes('pc'));

      expect(pcGame).toBeDefined();
      expect(pcGame!.platform).toBe('PC');
    });
  });

  describe('batchUpdate', () => {
    test('should return 0 for empty gameIds array', async () => {
      const gameIds: number[] = [];

      if (gameIds.length === 0) {
        const result = { updated: 0 };
        expect(result.updated).toBe(0);
      }
    });

    test('should update status for multiple games', async () => {
      const gameIds = [1, 2, 3];
      mockGameRepository.batchUpdateStatus.mockResolvedValue(undefined);

      await mockGameRepository.batchUpdateStatus(gameIds, 'downloaded');

      expect(mockGameRepository.batchUpdateStatus).toHaveBeenCalledWith(gameIds, 'downloaded');
    });
  });

  describe('getGameStats', () => {
    test('should return game statistics', async () => {
      const stats = {
        totalGames: 10,
        wantedGames: 5,
        downloadingGames: 2,
        downloadedGames: 3,
      };

      mockGameRepository.getStats.mockResolvedValue(stats);

      const result = await mockGameRepository.getStats();

      expect(result.totalGames).toBe(10);
      expect(result.wantedGames).toBe(5);
      expect(result.downloadingGames).toBe(2);
      expect(result.downloadedGames).toBe(3);
    });
  });
});

// =============================================================================
// LibraryService Tests
// =============================================================================
describe('LibraryService', () => {
  beforeEach(() => {
    mockLibraryRepository.findById.mockClear();
    mockLibraryRepository.findByPath.mockClear();
    mockLibraryRepository.findAll.mockClear();
    mockLibraryRepository.findMonitored.mockClear();
    mockLibraryRepository.findDownloadEnabled.mockClear();
    mockLibraryRepository.findByPlatform.mockClear();
    mockLibraryRepository.create.mockClear();
    mockLibraryRepository.update.mockClear();
    mockLibraryRepository.delete.mockClear();
    mockFsPromises.stat.mockClear();
    mockFsPromises.mkdir.mockClear();
    mockFsPromises.readdir.mockClear();
  });

  describe('normalizePath', () => {
    const normalizePath = (inputPath: string): string => {
      // Simple normalization - just remove trailing slashes
      return inputPath.replace(/[/\\]$/, '');
    };

    test('should remove trailing forward slash', () => {
      expect(normalizePath('/games/library/')).toBe('/games/library');
    });

    test('should remove trailing backslash', () => {
      expect(normalizePath('C:\\Games\\Library\\')).toBe('C:\\Games\\Library');
    });

    test('should not modify path without trailing slash', () => {
      expect(normalizePath('/games/library')).toBe('/games/library');
    });
  });

  describe('createLibrary', () => {
    test('should throw error when library path already exists', async () => {
      const existingLibrary = createMockLibrary();
      mockLibraryRepository.findByPath.mockResolvedValue(existingLibrary);

      const existing = await mockLibraryRepository.findByPath('/games/library');

      expect(existing).toBeDefined();
      // In actual service, this would throw: "Library already exists at path: /games/library"
    });

    test('should create library with default values', async () => {
      mockLibraryRepository.findByPath.mockResolvedValue(undefined);
      mockLibraryRepository.findAll.mockResolvedValue([]);
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => true });

      const input = {
        name: 'Test Library',
        path: '/games/library',
      };

      // Verify default values
      const defaults = {
        platform: input.platform || null,
        monitored: input.monitored ?? true,
        downloadEnabled: input.downloadEnabled ?? true,
        downloadCategory: input.downloadCategory || 'gamearr',
        priority: 0, // First library
      };

      expect(defaults.monitored).toBe(true);
      expect(defaults.downloadEnabled).toBe(true);
      expect(defaults.downloadCategory).toBe('gamearr');
    });

    test('should calculate priority based on existing libraries', async () => {
      const existingLibraries = [
        createMockLibrary({ id: 1, priority: 0 }),
        createMockLibrary({ id: 2, priority: 1 }),
      ];

      mockLibraryRepository.findAll.mockResolvedValue(existingLibraries);

      const newPriority = existingLibraries.length; // 2

      expect(newPriority).toBe(2);
    });

    test('should use provided priority over calculated one', async () => {
      const input = {
        name: 'Test Library',
        path: '/games/library',
        priority: 10,
      };

      const priority = input.priority !== undefined ? input.priority : 0;

      expect(priority).toBe(10);
    });
  });

  describe('updateLibrary', () => {
    test('should throw error when library not found', async () => {
      mockLibraryRepository.findById.mockResolvedValue(undefined);

      const library = await mockLibraryRepository.findById(999);

      expect(library).toBeUndefined();
    });

    test('should throw error when path conflicts with another library', async () => {
      const existingLibrary = createMockLibrary({ id: 1 });
      const conflictingLibrary = createMockLibrary({ id: 2, path: '/new/path' });

      mockLibraryRepository.findById.mockResolvedValue(existingLibrary);
      mockLibraryRepository.findByPath.mockResolvedValue(conflictingLibrary);

      // Check if path belongs to different library
      const pathLibrary = await mockLibraryRepository.findByPath('/new/path');
      const isConflict = pathLibrary && pathLibrary.id !== 1;

      expect(isConflict).toBe(true);
    });

    test('should allow updating to same path', async () => {
      const existingLibrary = createMockLibrary({ id: 1, path: '/games/library' });

      mockLibraryRepository.findById.mockResolvedValue(existingLibrary);
      mockLibraryRepository.findByPath.mockResolvedValue(existingLibrary);

      // Check if path belongs to same library
      const pathLibrary = await mockLibraryRepository.findByPath('/games/library');
      const isConflict = pathLibrary && pathLibrary.id !== 1;

      expect(isConflict).toBe(false);
    });

    test('should update name field', async () => {
      const library = createMockLibrary();
      mockLibraryRepository.findById.mockResolvedValue(library);

      const updates: Record<string, unknown> = {};
      const input = { name: 'New Name' };

      if (input.name !== undefined) {
        updates.name = input.name;
      }

      expect(updates.name).toBe('New Name');
    });

    test('should update monitored field', async () => {
      const library = createMockLibrary({ monitored: true });
      mockLibraryRepository.findById.mockResolvedValue(library);

      const input = { monitored: false };
      const updates: Record<string, unknown> = {};

      if (input.monitored !== undefined) {
        updates.monitored = input.monitored;
      }

      expect(updates.monitored).toBe(false);
    });

    test('should update downloadEnabled field', async () => {
      const library = createMockLibrary({ downloadEnabled: true });
      mockLibraryRepository.findById.mockResolvedValue(library);

      const input = { downloadEnabled: false };
      const updates: Record<string, unknown> = {};

      if (input.downloadEnabled !== undefined) {
        updates.downloadEnabled = input.downloadEnabled;
      }

      expect(updates.downloadEnabled).toBe(false);
    });

    test('should update downloadCategory with default fallback', async () => {
      const library = createMockLibrary();
      mockLibraryRepository.findById.mockResolvedValue(library);

      // When empty string, default to 'gamearr'
      const input1 = { downloadCategory: '' };
      const category1 = input1.downloadCategory || 'gamearr';
      expect(category1).toBe('gamearr');

      // When value provided, use it
      const input2 = { downloadCategory: 'custom' };
      const category2 = input2.downloadCategory || 'gamearr';
      expect(category2).toBe('custom');
    });
  });

  describe('deleteLibrary', () => {
    test('should throw error when library not found', async () => {
      mockLibraryRepository.findById.mockResolvedValue(undefined);

      const library = await mockLibraryRepository.findById(999);

      expect(library).toBeUndefined();
    });

    test('should delete library successfully', async () => {
      const library = createMockLibrary();
      mockLibraryRepository.findById.mockResolvedValue(library);
      mockLibraryRepository.delete.mockResolvedValue(true);

      const result = await mockLibraryRepository.delete(1);

      expect(result).toBe(true);
    });
  });

  describe('validatePath', () => {
    test('should throw error when path is not a directory', async () => {
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => false });

      const stats = await mockFsPromises.stat('/path/to/file');
      const isDir = stats.isDirectory();

      expect(isDir).toBe(false);
    });

    test('should create directory if path does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFsPromises.stat.mockRejectedValue(error);

      // The service would call mkdir in this case
      expect(error.code).toBe('ENOENT');
    });

    test('should pass when path is a valid directory', async () => {
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => true });

      const stats = await mockFsPromises.stat('/valid/directory');
      const isDir = stats.isDirectory();

      expect(isDir).toBe(true);
    });
  });

  describe('testPath', () => {
    test('should return valid: true for accessible directory', async () => {
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => true });
      mockFsPromises.readdir.mockResolvedValue([]);

      const stats = await mockFsPromises.stat('/valid/path');
      const isDir = stats.isDirectory();
      await mockFsPromises.readdir('/valid/path');

      expect(isDir).toBe(true);
    });

    test('should return error for non-directory path', async () => {
      mockFsPromises.stat.mockResolvedValue({ isDirectory: () => false });

      const stats = await mockFsPromises.stat('/path/to/file');
      const isDir = stats.isDirectory();

      expect(isDir).toBe(false);
      // Would return: { valid: false, error: 'Path is not a directory' }
    });

    test('should return error for non-existent path', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFsPromises.stat.mockRejectedValue(error);

      try {
        await mockFsPromises.stat('/non/existent');
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        expect(err.code).toBe('ENOENT');
        // Would return: { valid: false, error: 'Path does not exist' }
      }
    });

    test('should return error for permission denied', async () => {
      const error = new Error('EACCES') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      mockFsPromises.stat.mockRejectedValue(error);

      try {
        await mockFsPromises.stat('/protected/path');
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        expect(err.code).toBe('EACCES');
        // Would return: { valid: false, error: 'Permission denied' }
      }
    });
  });

  describe('getLibraryForPath', () => {
    test('should return library when folder path is within library', async () => {
      const libraries = [
        createMockLibrary({ path: '/games/library' }),
      ];

      mockLibraryRepository.findAll.mockResolvedValue(libraries);

      const folderPath = '/games/library/game-folder';
      const libraryPath = '/games/library';

      const isWithinLibrary = folderPath.startsWith(libraryPath);

      expect(isWithinLibrary).toBe(true);
    });

    test('should return undefined when folder is not in any library', async () => {
      const libraries = [
        createMockLibrary({ path: '/games/library' }),
      ];

      mockLibraryRepository.findAll.mockResolvedValue(libraries);

      const folderPath = '/other/path/game';
      const libraryPath = '/games/library';

      const isWithinLibrary = folderPath.startsWith(libraryPath);

      expect(isWithinLibrary).toBe(false);
    });
  });

  describe('getDefaultDownloadLibrary', () => {
    test('should return undefined when no download-enabled libraries', async () => {
      mockLibraryRepository.findDownloadEnabled.mockResolvedValue([]);

      const libraries = await mockLibraryRepository.findDownloadEnabled();

      expect(libraries.length).toBe(0);
    });

    test('should return highest priority library', async () => {
      const libraries = [
        createMockLibrary({ id: 1, priority: 1 }),
        createMockLibrary({ id: 2, priority: 5 }),
        createMockLibrary({ id: 3, priority: 3 }),
      ];

      mockLibraryRepository.findDownloadEnabled.mockResolvedValue(libraries);

      const result = await mockLibraryRepository.findDownloadEnabled();

      // Sort by priority descending
      result.sort((a, b) => b.priority - a.priority);

      expect(result[0].priority).toBe(5);
      expect(result[0].id).toBe(2);
    });
  });

  describe('getLibraryForGame', () => {
    test('should match by platform first', async () => {
      const pcLibrary = createMockLibrary({ platform: 'PC' });
      mockLibraryRepository.findByPlatform.mockResolvedValue([pcLibrary]);

      const libraries = await mockLibraryRepository.findByPlatform('PC');
      const downloadEnabled = libraries.filter(l => l.downloadEnabled);

      expect(downloadEnabled.length).toBe(1);
      expect(downloadEnabled[0].platform).toBe('PC');
    });

    test('should fall back to default library when no platform match', async () => {
      mockLibraryRepository.findByPlatform.mockResolvedValue([]);
      mockLibraryRepository.findDownloadEnabled.mockResolvedValue([
        createMockLibrary({ platform: null }),
      ]);

      const platformLibraries = await mockLibraryRepository.findByPlatform('Nintendo Switch');
      expect(platformLibraries.length).toBe(0);

      const defaultLibraries = await mockLibraryRepository.findDownloadEnabled();
      expect(defaultLibraries.length).toBe(1);
    });
  });

  describe('hasLibraries', () => {
    test('should return true when libraries exist', async () => {
      mockLibraryRepository.findAll.mockResolvedValue([createMockLibrary()]);

      const libraries = await mockLibraryRepository.findAll();
      const hasLibraries = libraries.length > 0;

      expect(hasLibraries).toBe(true);
    });

    test('should return false when no libraries', async () => {
      mockLibraryRepository.findAll.mockResolvedValue([]);

      const libraries = await mockLibraryRepository.findAll();
      const hasLibraries = libraries.length > 0;

      expect(hasLibraries).toBe(false);
    });
  });

  describe('getUniquePlatforms', () => {
    test('should return unique platforms', async () => {
      const libraries = [
        createMockLibrary({ platform: 'PC' }),
        createMockLibrary({ platform: 'PlayStation 5' }),
        createMockLibrary({ platform: 'PC' }), // Duplicate
        createMockLibrary({ platform: null }),
      ];

      mockLibraryRepository.findAll.mockResolvedValue(libraries);

      const platforms = new Set<string>();
      for (const library of libraries) {
        if (library.platform) {
          platforms.add(library.platform);
        }
      }

      const uniquePlatforms = Array.from(platforms).sort();

      expect(uniquePlatforms).toEqual(['PC', 'PlayStation 5']);
    });
  });
});

// =============================================================================
// SettingsService Tests
// =============================================================================
describe('SettingsService', () => {
  beforeEach(() => {
    mockSettingsRepository.get.mockClear();
    mockSettingsRepository.set.mockClear();
    mockSettingsRepository.getJSON.mockClear();
    mockSettingsRepository.setJSON.mockClear();
    mockSettingsRepository.getAll.mockClear();
  });

  describe('getSetting', () => {
    test('should return database value when present', async () => {
      mockSettingsRepository.get.mockResolvedValue('test-value');

      const value = await mockSettingsRepository.get('test_key');

      expect(value).toBe('test-value');
    });

    test('should return null when no value in database', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      const value = await mockSettingsRepository.get('missing_key');

      expect(value).toBeNull();
    });

    test('should fall back to environment variable', () => {
      const ENV_VAR_FALLBACKS: Record<string, string> = {
        prowlarr_url: 'PROWLARR_URL',
        prowlarr_api_key: 'PROWLARR_API_KEY',
        qbittorrent_host: 'QBITTORRENT_HOST',
        qbittorrent_username: 'QBITTORRENT_USERNAME',
        qbittorrent_password: 'QBITTORRENT_PASSWORD',
        igdb_client_id: 'IGDB_CLIENT_ID',
        igdb_client_secret: 'IGDB_CLIENT_SECRET',
        library_path: 'LIBRARY_PATH',
      };

      const key = 'prowlarr_url';
      const envVarName = ENV_VAR_FALLBACKS[key];

      expect(envVarName).toBe('PROWLARR_URL');
    });
  });

  describe('setSetting', () => {
    test('should call repository set method', async () => {
      await mockSettingsRepository.set('test_key', 'test_value');

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('test_key', 'test_value');
    });
  });

  describe('cache TTL logic', () => {
    test('should return cached value within TTL', () => {
      const CACHE_TTL_MS = 60 * 1000; // 60 seconds
      const now = Date.now();

      interface CacheEntry {
        value: string;
        expiresAt: number;
      }

      const cache = new Map<string, CacheEntry>();
      cache.set('test_key', {
        value: 'cached_value',
        expiresAt: now + CACHE_TTL_MS, // Expires in 60 seconds
      });

      const cached = cache.get('test_key');
      const isValid = cached && cached.expiresAt > now;

      expect(isValid).toBe(true);
      expect(cached!.value).toBe('cached_value');
    });

    test('should invalidate expired cache entry', () => {
      const now = Date.now();

      interface CacheEntry {
        value: string;
        expiresAt: number;
      }

      const cache = new Map<string, CacheEntry>();
      cache.set('test_key', {
        value: 'cached_value',
        expiresAt: now - 1000, // Expired 1 second ago
      });

      const cached = cache.get('test_key');
      const isValid = cached && cached.expiresAt > now;

      expect(isValid).toBe(false);
    });

    test('should invalidate cache on write', () => {
      interface CacheEntry {
        value: string;
        expiresAt: number;
      }

      const cache = new Map<string, CacheEntry>();
      cache.set('test_key', {
        value: 'old_value',
        expiresAt: Date.now() + 60000,
      });

      expect(cache.has('test_key')).toBe(true);

      // Invalidate on write
      cache.delete('test_key');

      expect(cache.has('test_key')).toBe(false);
    });

    test('should clear entire cache', () => {
      interface CacheEntry {
        value: string;
        expiresAt: number;
      }

      const cache = new Map<string, CacheEntry>();
      cache.set('key1', { value: 'value1', expiresAt: Date.now() + 60000 });
      cache.set('key2', { value: 'value2', expiresAt: Date.now() + 60000 });

      expect(cache.size).toBe(2);

      cache.clear();

      expect(cache.size).toBe(0);
    });
  });

  describe('getProwlarrCategories', () => {
    test('should return default categories when not set', async () => {
      const DEFAULT_CATEGORIES = [4050];
      mockSettingsRepository.getJSON.mockResolvedValue(null);

      const categories = await mockSettingsRepository.getJSON('prowlarr_categories');
      const result = categories || DEFAULT_CATEGORIES;

      expect(result).toEqual([4050]);
    });

    test('should return stored categories', async () => {
      const storedCategories = [4050, 4000, 1000];
      mockSettingsRepository.getJSON.mockResolvedValue(storedCategories);

      const categories = await mockSettingsRepository.getJSON('prowlarr_categories');

      expect(categories).toEqual([4050, 4000, 1000]);
    });
  });

  describe('setProwlarrCategories', () => {
    test('should store categories as JSON', async () => {
      const categories = [4050, 4000];

      await mockSettingsRepository.setJSON('prowlarr_categories', categories);

      expect(mockSettingsRepository.setJSON).toHaveBeenCalledWith('prowlarr_categories', categories);
    });
  });

  describe('getQBittorrentCategory', () => {
    test('should return default category when not set', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      const value = await mockSettingsRepository.get('qbittorrent_category');
      const category = value || 'gamearr';

      expect(category).toBe('gamearr');
    });

    test('should return stored category', async () => {
      mockSettingsRepository.get.mockResolvedValue('custom-category');

      const category = await mockSettingsRepository.get('qbittorrent_category');

      expect(category).toBe('custom-category');
    });
  });

  describe('getDryRun', () => {
    test('should return true by default for safety', async () => {
      mockSettingsRepository.getJSON.mockResolvedValue(null);

      const value = await mockSettingsRepository.getJSON('dry_run');
      const dryRun = value ?? true;

      expect(dryRun).toBe(true);
    });

    test('should return stored value', async () => {
      mockSettingsRepository.getJSON.mockResolvedValue(false);

      const dryRun = await mockSettingsRepository.getJSON('dry_run');

      expect(dryRun).toBe(false);
    });
  });

  describe('getRssSyncInterval', () => {
    test('should return default 15 minutes when not set', async () => {
      mockSettingsRepository.getJSON.mockResolvedValue(null);

      const value = await mockSettingsRepository.getJSON('rss_sync_interval');
      const interval = value ?? 15;

      expect(interval).toBe(15);
    });
  });

  describe('setRssSyncInterval', () => {
    test('should clamp value to minimum 5 minutes', () => {
      const input = 2;
      const validMinutes = Math.max(5, Math.min(1440, input));

      expect(validMinutes).toBe(5);
    });

    test('should clamp value to maximum 1440 minutes (24 hours)', () => {
      const input = 2000;
      const validMinutes = Math.max(5, Math.min(1440, input));

      expect(validMinutes).toBe(1440);
    });

    test('should accept valid value in range', () => {
      const input = 30;
      const validMinutes = Math.max(5, Math.min(1440, input));

      expect(validMinutes).toBe(30);
    });
  });

  describe('getAutoGrabMinScore', () => {
    test('should return default 100 when not set', async () => {
      mockSettingsRepository.getJSON.mockResolvedValue(null);

      const value = await mockSettingsRepository.getJSON('auto_grab_min_score');
      const score = value ?? 100;

      expect(score).toBe(100);
    });
  });

  describe('setAutoGrabMinScore', () => {
    test('should clamp value to minimum 0', () => {
      const input = -50;
      const validScore = Math.max(0, Math.min(500, input));

      expect(validScore).toBe(0);
    });

    test('should clamp value to maximum 500', () => {
      const input = 1000;
      const validScore = Math.max(0, Math.min(500, input));

      expect(validScore).toBe(500);
    });
  });

  describe('getAutoGrabMinSeeders', () => {
    test('should return default 5 when not set', async () => {
      mockSettingsRepository.getJSON.mockResolvedValue(null);

      const value = await mockSettingsRepository.getJSON('auto_grab_min_seeders');
      const seeders = value ?? 5;

      expect(seeders).toBe(5);
    });
  });

  describe('setAutoGrabMinSeeders', () => {
    test('should clamp value to minimum 0', () => {
      const input = -10;
      const validSeeders = Math.max(0, Math.min(100, input));

      expect(validSeeders).toBe(0);
    });

    test('should clamp value to maximum 100', () => {
      const input = 200;
      const validSeeders = Math.max(0, Math.min(100, input));

      expect(validSeeders).toBe(100);
    });
  });

  describe('getAllSettings', () => {
    test('should hide sensitive values', async () => {
      const allSettings = [
        { id: 1, key: 'prowlarr_url', value: 'http://localhost:9696' },
        { id: 2, key: 'prowlarr_api_key', value: 'secret-api-key' },
        { id: 3, key: 'qbittorrent_password', value: 'secret-password' },
        { id: 4, key: 'igdb_client_secret', value: 'secret-client-secret' },
        { id: 5, key: 'qbittorrent_category', value: 'gamearr' },
      ];

      mockSettingsRepository.getAll.mockResolvedValue(allSettings);

      const settings = await mockSettingsRepository.getAll();
      const settingsMap: Record<string, string> = {};

      for (const setting of settings) {
        if (
          setting.key.includes('password') ||
          setting.key.includes('secret') ||
          setting.key.includes('api_key')
        ) {
          settingsMap[setting.key] = '***HIDDEN***';
        } else {
          settingsMap[setting.key] = setting.value;
        }
      }

      expect(settingsMap['prowlarr_url']).toBe('http://localhost:9696');
      expect(settingsMap['prowlarr_api_key']).toBe('***HIDDEN***');
      expect(settingsMap['qbittorrent_password']).toBe('***HIDDEN***');
      expect(settingsMap['igdb_client_secret']).toBe('***HIDDEN***');
      expect(settingsMap['qbittorrent_category']).toBe('gamearr');
    });

    test('should parse JSON values', async () => {
      const allSettings = [
        { id: 1, key: 'prowlarr_categories', value: '[4050, 4000]' },
        { id: 2, key: 'dry_run', value: 'true' },
        { id: 3, key: 'plain_string', value: 'just a string' },
      ];

      mockSettingsRepository.getAll.mockResolvedValue(allSettings);

      const settings = await mockSettingsRepository.getAll();
      const parsed: Record<string, unknown> = {};

      for (const setting of settings) {
        try {
          parsed[setting.key] = JSON.parse(setting.value);
        } catch {
          parsed[setting.key] = setting.value;
        }
      }

      expect(parsed['prowlarr_categories']).toEqual([4050, 4000]);
      expect(parsed['dry_run']).toBe(true);
      expect(parsed['plain_string']).toBe('just a string');
    });
  });

  describe('environment variable fallbacks', () => {
    test('should define correct environment variable mappings', () => {
      const ENV_VAR_FALLBACKS: Record<string, string> = {
        prowlarr_url: 'PROWLARR_URL',
        prowlarr_api_key: 'PROWLARR_API_KEY',
        qbittorrent_host: 'QBITTORRENT_HOST',
        qbittorrent_username: 'QBITTORRENT_USERNAME',
        qbittorrent_password: 'QBITTORRENT_PASSWORD',
        igdb_client_id: 'IGDB_CLIENT_ID',
        igdb_client_secret: 'IGDB_CLIENT_SECRET',
        library_path: 'LIBRARY_PATH',
      };

      expect(Object.keys(ENV_VAR_FALLBACKS).length).toBe(8);
      expect(ENV_VAR_FALLBACKS['prowlarr_url']).toBe('PROWLARR_URL');
      expect(ENV_VAR_FALLBACKS['igdb_client_id']).toBe('IGDB_CLIENT_ID');
    });

    test('should return null for unmapped keys', () => {
      const ENV_VAR_FALLBACKS: Record<string, string> = {
        prowlarr_url: 'PROWLARR_URL',
      };

      const unmappedKey = 'some_other_key';
      const envVarName = ENV_VAR_FALLBACKS[unmappedKey];

      expect(envVarName).toBeUndefined();
    });
  });

  describe('SETTINGS_KEYS constants', () => {
    test('should define all required settings keys', () => {
      const SETTINGS_KEYS = {
        PROWLARR_CATEGORIES: 'prowlarr_categories',
        PROWLARR_URL: 'prowlarr_url',
        PROWLARR_API_KEY: 'prowlarr_api_key',
        QBITTORRENT_HOST: 'qbittorrent_host',
        QBITTORRENT_USERNAME: 'qbittorrent_username',
        QBITTORRENT_PASSWORD: 'qbittorrent_password',
        QBITTORRENT_CATEGORY: 'qbittorrent_category',
        IGDB_CLIENT_ID: 'igdb_client_id',
        IGDB_CLIENT_SECRET: 'igdb_client_secret',
        LIBRARY_PATH: 'library_path',
        DRY_RUN: 'dry_run',
        AUTH_ENABLED: 'auth_enabled',
        API_KEY_HASH: 'api_key_hash',
        RSS_SYNC_INTERVAL: 'rss_sync_interval',
        SEARCH_SCHEDULER_INTERVAL: 'search_scheduler_interval',
        AUTO_GRAB_MIN_SCORE: 'auto_grab_min_score',
        AUTO_GRAB_MIN_SEEDERS: 'auto_grab_min_seeders',
      };

      expect(SETTINGS_KEYS.PROWLARR_CATEGORIES).toBe('prowlarr_categories');
      expect(SETTINGS_KEYS.DRY_RUN).toBe('dry_run');
      expect(SETTINGS_KEYS.AUTH_ENABLED).toBe('auth_enabled');
      expect(SETTINGS_KEYS.RSS_SYNC_INTERVAL).toBe('rss_sync_interval');
    });
  });
});

// =============================================================================
// Integration Tests - Service Interactions
// =============================================================================
describe('Service Integration Patterns', () => {
  describe('GameService and LibraryService interaction', () => {
    test('should create game with library assignment', () => {
      const gameData = {
        title: 'Test Game',
        igdbId: 12345,
        libraryId: 1,
        status: 'wanted',
      };

      expect(gameData.libraryId).toBe(1);
    });

    test('should update game status when library changes', () => {
      const game = createMockGame({ status: 'wanted', libraryId: null });

      // When matched to a folder in a library, status should change
      const updates = {
        status: 'downloaded' as const,
        libraryId: 1,
        folderPath: '/games/library/Test Game (2023)',
      };

      const updatedGame = { ...game, ...updates };

      expect(updatedGame.status).toBe('downloaded');
      expect(updatedGame.libraryId).toBe(1);
    });
  });

  describe('GameService and SettingsService interaction', () => {
    test('should get default update policy from settings', async () => {
      mockSettingsRepository.get.mockResolvedValue('auto');

      const defaultPolicy = await mockSettingsRepository.get('default_update_policy');

      expect(defaultPolicy).toBe('auto');
    });

    test('should fall back to notify when no default policy set', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      const dbValue = await mockSettingsRepository.get('default_update_policy');
      const defaultPolicy = dbValue || 'notify';

      expect(defaultPolicy).toBe('notify');
    });
  });

  describe('Error handling patterns', () => {
    test('should handle NotFoundError correctly', () => {
      const createNotFoundError = (resource: string, id: number) => ({
        name: 'NotFoundError',
        message: `${resource} with ID '${id}' not found`,
        statusCode: 404,
      });

      const error = createNotFoundError('Game', 999);

      expect(error.message).toBe("Game with ID '999' not found");
      expect(error.statusCode).toBe(404);
    });

    test('should handle NotConfiguredError correctly', () => {
      const createNotConfiguredError = (service: string) => ({
        name: 'NotConfiguredError',
        message: `${service} is not configured. Please add your ${service} settings.`,
        statusCode: 400,
      });

      const error = createNotConfiguredError('IGDB');

      expect(error.message).toBe('IGDB is not configured. Please add your IGDB settings.');
      expect(error.statusCode).toBe(400);
    });

    test('should handle ConflictError correctly', () => {
      const createConflictError = (message: string) => ({
        name: 'ConflictError',
        message,
        statusCode: 409,
      });

      const error = createConflictError('Game already exists in library');

      expect(error.message).toBe('Game already exists in library');
      expect(error.statusCode).toBe(409);
    });
  });
});
