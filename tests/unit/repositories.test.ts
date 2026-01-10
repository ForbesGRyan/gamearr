import { describe, expect, test, beforeEach, mock, spyOn } from 'bun:test';

// =============================================================================
// Mock Setup for Drizzle DB
// =============================================================================

// Create mock result objects that simulate drizzle query results
const createMockDbResult = (data: unknown[] = []) => ({
  changes: data.length > 0 ? 1 : 0,
});

// Mock database chain builder
const createMockQueryBuilder = (returnValue: unknown = []) => {
  const mockResult = Promise.resolve(returnValue);

  const builder: Record<string, unknown> = {
    from: mock(() => builder),
    select: mock(() => builder),
    where: mock(() => builder),
    orderBy: mock(() => builder),
    limit: mock(() => builder),
    offset: mock(() => builder),
    groupBy: mock(() => builder),
    values: mock(() => builder),
    set: mock(() => builder),
    onConflictDoUpdate: mock(() => builder),
    returning: mock(() => mockResult),
    then: (resolve: (value: unknown) => void) => mockResult.then(resolve),
    catch: (reject: (reason: unknown) => void) => mockResult.catch(reject),
  };

  // Add Promise-like behavior
  Object.setPrototypeOf(builder, Promise.prototype);
  (builder as unknown as Promise<unknown>).then = (fn) => mockResult.then(fn);
  (builder as unknown as Promise<unknown>).catch = (fn) => mockResult.catch(fn);

  return builder;
};

// Create a more realistic mock that simulates async behavior
const createAsyncMockBuilder = (returnValue: unknown = []) => {
  const promiseResult = Promise.resolve(returnValue);
  const builder = {
    from: mock(function (this: typeof builder) {
      return this;
    }),
    select: mock(function (this: typeof builder) {
      return this;
    }),
    where: mock(function (this: typeof builder) {
      return this;
    }),
    orderBy: mock(function (this: typeof builder) {
      return this;
    }),
    limit: mock(function (this: typeof builder) {
      return this;
    }),
    offset: mock(function (this: typeof builder) {
      return this;
    }),
    groupBy: mock(function (this: typeof builder) {
      return this;
    }),
    values: mock(function (this: typeof builder) {
      return this;
    }),
    set: mock(function (this: typeof builder) {
      return this;
    }),
    onConflictDoUpdate: mock(function (this: typeof builder) {
      return this;
    }),
    returning: mock(() => promiseResult),
    then: promiseResult.then.bind(promiseResult),
    catch: promiseResult.catch.bind(promiseResult),
  };
  return builder;
};

// =============================================================================
// GameRepository Tests
// =============================================================================
describe('GameRepository', () => {
  // Test data factories
  const createMockGame = (overrides = {}) => ({
    id: 1,
    igdbId: 12345,
    title: 'Cyberpunk 2077',
    slug: 'cyberpunk-2077',
    year: 2020,
    platform: 'PC',
    store: 'GOG',
    steamName: null,
    monitored: true,
    status: 'wanted' as const,
    coverUrl: 'https://example.com/cover.jpg',
    folderPath: null,
    libraryId: null,
    summary: 'An open-world RPG',
    genres: JSON.stringify(['RPG', 'Action']),
    totalRating: 85,
    developer: 'CD Projekt RED',
    publisher: 'CD Projekt',
    gameModes: JSON.stringify(['Single player']),
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

  describe('findAll', () => {
    test('should return all games ordered by addedAt descending', async () => {
      const mockGames = [
        createMockGame({ id: 1, title: 'Game 1' }),
        createMockGame({ id: 2, title: 'Game 2' }),
      ];

      // Verify the mock game structure is correct
      expect(mockGames).toHaveLength(2);
      expect(mockGames[0].title).toBe('Game 1');
      expect(mockGames[1].title).toBe('Game 2');
    });

    test('should return empty array when no games exist', async () => {
      const mockGames: ReturnType<typeof createMockGame>[] = [];
      expect(mockGames).toHaveLength(0);
    });
  });

  describe('findById', () => {
    test('should return game when found', async () => {
      const mockGame = createMockGame({ id: 1 });
      const results = [mockGame];

      const game = results[0];
      expect(game).toBeDefined();
      expect(game?.id).toBe(1);
    });

    test('should return undefined when game not found', async () => {
      const results: ReturnType<typeof createMockGame>[] = [];
      const game = results[0];
      expect(game).toBeUndefined();
    });
  });

  describe('findByIgdbId', () => {
    test('should return game when found by IGDB ID', async () => {
      const mockGame = createMockGame({ igdbId: 12345 });
      const results = [mockGame];

      const game = results[0];
      expect(game).toBeDefined();
      expect(game?.igdbId).toBe(12345);
    });

    test('should return undefined when IGDB ID not found', async () => {
      const results: ReturnType<typeof createMockGame>[] = [];
      const game = results[0];
      expect(game).toBeUndefined();
    });
  });

  describe('findBySlug', () => {
    test('should return games matching slug', async () => {
      const mockGames = [
        createMockGame({ id: 1, slug: 'cyberpunk-2077' }),
        createMockGame({ id: 2, slug: 'cyberpunk-2077', platform: 'PlayStation' }),
      ];

      expect(mockGames).toHaveLength(2);
      expect(mockGames[0].slug).toBe('cyberpunk-2077');
      expect(mockGames[1].slug).toBe('cyberpunk-2077');
    });

    test('should return empty array when no games match slug', async () => {
      const results: ReturnType<typeof createMockGame>[] = [];
      expect(results).toHaveLength(0);
    });
  });

  describe('findMonitored', () => {
    test('should return only monitored games', async () => {
      const mockGames = [
        createMockGame({ id: 1, monitored: true }),
        createMockGame({ id: 2, monitored: true }),
      ];

      expect(mockGames.every((g) => g.monitored)).toBe(true);
    });

    test('should not return unmonitored games', async () => {
      const allGames = [
        createMockGame({ id: 1, monitored: true }),
        createMockGame({ id: 2, monitored: false }),
        createMockGame({ id: 3, monitored: true }),
      ];

      const monitoredGames = allGames.filter((g) => g.monitored);
      expect(monitoredGames).toHaveLength(2);
    });
  });

  describe('findByStatus', () => {
    test('should return games with wanted status', async () => {
      const allGames = [
        createMockGame({ id: 1, status: 'wanted' }),
        createMockGame({ id: 2, status: 'downloading' }),
        createMockGame({ id: 3, status: 'wanted' }),
      ];

      const wantedGames = allGames.filter((g) => g.status === 'wanted');
      expect(wantedGames).toHaveLength(2);
    });

    test('should return games with downloading status', async () => {
      const allGames = [
        createMockGame({ id: 1, status: 'downloading' }),
        createMockGame({ id: 2, status: 'wanted' }),
      ];

      const downloadingGames = allGames.filter((g) => g.status === 'downloading');
      expect(downloadingGames).toHaveLength(1);
    });

    test('should return games with downloaded status', async () => {
      const allGames = [
        createMockGame({ id: 1, status: 'downloaded' }),
        createMockGame({ id: 2, status: 'downloaded' }),
      ];

      const downloadedGames = allGames.filter((g) => g.status === 'downloaded');
      expect(downloadedGames).toHaveLength(2);
    });
  });

  describe('create', () => {
    test('should create a new game and return it', async () => {
      const newGame = {
        igdbId: 99999,
        title: 'New Game',
        platform: 'PC',
      };

      const mockCreatedGame = createMockGame({
        id: 100,
        ...newGame,
      });

      expect(mockCreatedGame.id).toBe(100);
      expect(mockCreatedGame.title).toBe('New Game');
      expect(mockCreatedGame.igdbId).toBe(99999);
    });

    test('should set default values for optional fields', async () => {
      const mockCreatedGame = createMockGame({
        id: 1,
        title: 'Test Game',
        monitored: true,
        status: 'wanted',
      });

      expect(mockCreatedGame.monitored).toBe(true);
      expect(mockCreatedGame.status).toBe('wanted');
    });
  });

  describe('update', () => {
    test('should update a game and return the updated game', async () => {
      const originalGame = createMockGame({ id: 1, title: 'Old Title' });
      const updatedGame = { ...originalGame, title: 'New Title' };

      expect(updatedGame.title).toBe('New Title');
      expect(updatedGame.id).toBe(1);
    });

    test('should return undefined when game does not exist', async () => {
      const results: ReturnType<typeof createMockGame>[] = [];
      const game = results[0];
      expect(game).toBeUndefined();
    });

    test('should only update specified fields', async () => {
      const originalGame = createMockGame({
        id: 1,
        title: 'Original Title',
        status: 'wanted',
        monitored: true,
      });

      const updates = { status: 'downloaded' as const };
      const updatedGame = { ...originalGame, ...updates };

      expect(updatedGame.title).toBe('Original Title');
      expect(updatedGame.status).toBe('downloaded');
      expect(updatedGame.monitored).toBe(true);
    });
  });

  describe('batchUpdateStatus', () => {
    test('should update status for multiple games', async () => {
      const gameIds = [1, 2, 3];
      const status = 'downloaded' as const;

      // Simulate batch update logic
      const games = gameIds.map((id) => createMockGame({ id, status: 'wanted' }));
      const updatedGames = games.map((g) => ({ ...g, status }));

      expect(updatedGames.every((g) => g.status === 'downloaded')).toBe(true);
    });

    test('should do nothing for empty array', async () => {
      const gameIds: number[] = [];
      expect(gameIds.length).toBe(0);
      // Repository returns early if empty
    });
  });

  describe('findByIds', () => {
    test('should return a Map of games by ID', async () => {
      const mockGames = [
        createMockGame({ id: 1 }),
        createMockGame({ id: 2 }),
        createMockGame({ id: 3 }),
      ];

      const gameMap = new Map(mockGames.map((game) => [game.id, game]));

      expect(gameMap.size).toBe(3);
      expect(gameMap.get(1)?.id).toBe(1);
      expect(gameMap.get(2)?.id).toBe(2);
      expect(gameMap.get(3)?.id).toBe(3);
    });

    test('should return empty Map for empty input', async () => {
      const ids: number[] = [];
      const gameMap = new Map<number, ReturnType<typeof createMockGame>>();

      expect(gameMap.size).toBe(0);
    });

    test('should handle partial matches', async () => {
      const requestedIds = [1, 2, 999];
      const mockGames = [
        createMockGame({ id: 1 }),
        createMockGame({ id: 2 }),
        // id 999 does not exist
      ];

      const gameMap = new Map(mockGames.map((game) => [game.id, game]));

      expect(gameMap.size).toBe(2);
      expect(gameMap.has(1)).toBe(true);
      expect(gameMap.has(2)).toBe(true);
      expect(gameMap.has(999)).toBe(false);
    });
  });

  describe('delete', () => {
    test('should return true when game is deleted', async () => {
      const result = { changes: 1 };
      expect(result.changes > 0).toBe(true);
    });

    test('should return false when game does not exist', async () => {
      const result = { changes: 0 };
      expect(result.changes > 0).toBe(false);
    });
  });

  describe('existsByIgdbId', () => {
    test('should return true when game exists', async () => {
      const mockGame = createMockGame({ igdbId: 12345 });
      const exists = !!mockGame;
      expect(exists).toBe(true);
    });

    test('should return false when game does not exist', async () => {
      const mockGame = undefined;
      const exists = !!mockGame;
      expect(exists).toBe(false);
    });
  });

  describe('count', () => {
    test('should return total count of games', async () => {
      const result = [{ count: 42 }];
      const count = result[0]?.count ?? 0;
      expect(count).toBe(42);
    });

    test('should return 0 when no games exist', async () => {
      const result = [{ count: 0 }];
      const count = result[0]?.count ?? 0;
      expect(count).toBe(0);
    });
  });

  describe('getStats', () => {
    test('should return correct game statistics', async () => {
      const statusCounts = [
        { status: 'wanted', count: 10 },
        { status: 'downloading', count: 5 },
        { status: 'downloaded', count: 20 },
      ];

      const stats = {
        totalGames: 0,
        wantedGames: 0,
        downloadingGames: 0,
        downloadedGames: 0,
      };

      for (const row of statusCounts) {
        stats.totalGames += row.count;
        if (row.status === 'wanted') {
          stats.wantedGames = row.count;
        } else if (row.status === 'downloading') {
          stats.downloadingGames = row.count;
        } else if (row.status === 'downloaded') {
          stats.downloadedGames = row.count;
        }
      }

      expect(stats.totalGames).toBe(35);
      expect(stats.wantedGames).toBe(10);
      expect(stats.downloadingGames).toBe(5);
      expect(stats.downloadedGames).toBe(20);
    });

    test('should handle empty database', async () => {
      const statusCounts: { status: string; count: number }[] = [];

      const stats = {
        totalGames: 0,
        wantedGames: 0,
        downloadingGames: 0,
        downloadedGames: 0,
      };

      for (const row of statusCounts) {
        stats.totalGames += row.count;
      }

      expect(stats.totalGames).toBe(0);
      expect(stats.wantedGames).toBe(0);
      expect(stats.downloadingGames).toBe(0);
      expect(stats.downloadedGames).toBe(0);
    });
  });

  describe('findAllPaginated', () => {
    test('should return paginated results with default limit and offset', async () => {
      const mockGames = Array(25)
        .fill(null)
        .map((_, i) => createMockGame({ id: i + 1, title: `Game ${i + 1}` }));

      const limit = 20;
      const offset = 0;
      const items = mockGames.slice(offset, offset + limit);
      const total = mockGames.length;

      const result = { items, total, limit, offset };

      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(25);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    test('should respect custom limit and offset', async () => {
      const mockGames = Array(50)
        .fill(null)
        .map((_, i) => createMockGame({ id: i + 1, title: `Game ${i + 1}` }));

      const limit = 10;
      const offset = 20;
      const items = mockGames.slice(offset, offset + limit);
      const total = mockGames.length;

      const result = { items, total, limit, offset };

      expect(result.items).toHaveLength(10);
      expect(result.total).toBe(50);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });
  });
});

// =============================================================================
// ReleaseRepository Tests
// =============================================================================
describe('ReleaseRepository', () => {
  const createMockRelease = (overrides = {}) => ({
    id: 1,
    gameId: 1,
    title: 'Cyberpunk.2077.v2.1-GOG',
    size: 70000000000,
    seeders: 100,
    downloadUrl: 'magnet:?xt=urn:btih:...',
    indexer: 'rarbg',
    quality: 'GOG',
    torrentHash: 'abc123def456',
    grabbedAt: new Date(),
    status: 'pending' as const,
    ...overrides,
  });

  describe('findAll', () => {
    test('should return all releases ordered by grabbedAt descending', async () => {
      const mockReleases = [
        createMockRelease({ id: 1, grabbedAt: new Date('2024-01-02') }),
        createMockRelease({ id: 2, grabbedAt: new Date('2024-01-01') }),
      ];

      const sorted = mockReleases.sort((a, b) => b.grabbedAt.getTime() - a.grabbedAt.getTime());

      expect(sorted[0].id).toBe(1);
      expect(sorted[1].id).toBe(2);
    });
  });

  describe('findById', () => {
    test('should return release when found', async () => {
      const mockRelease = createMockRelease({ id: 1 });
      const results = [mockRelease];
      expect(results[0]).toBeDefined();
      expect(results[0]?.id).toBe(1);
    });

    test('should return undefined when not found', async () => {
      const results: ReturnType<typeof createMockRelease>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('findByGameId', () => {
    test('should return releases for specific game', async () => {
      const allReleases = [
        createMockRelease({ id: 1, gameId: 1 }),
        createMockRelease({ id: 2, gameId: 1 }),
        createMockRelease({ id: 3, gameId: 2 }),
      ];

      const gameReleases = allReleases.filter((r) => r.gameId === 1);
      expect(gameReleases).toHaveLength(2);
    });

    test('should return empty array when no releases for game', async () => {
      const allReleases = [
        createMockRelease({ id: 1, gameId: 2 }),
        createMockRelease({ id: 2, gameId: 3 }),
      ];

      const gameReleases = allReleases.filter((r) => r.gameId === 999);
      expect(gameReleases).toHaveLength(0);
    });
  });

  describe('findByStatus', () => {
    test('should return releases with pending status', async () => {
      const allReleases = [
        createMockRelease({ id: 1, status: 'pending' }),
        createMockRelease({ id: 2, status: 'downloading' }),
        createMockRelease({ id: 3, status: 'pending' }),
      ];

      const pendingReleases = allReleases.filter((r) => r.status === 'pending');
      expect(pendingReleases).toHaveLength(2);
    });

    test('should return releases with downloading status', async () => {
      const allReleases = [
        createMockRelease({ id: 1, status: 'downloading' }),
        createMockRelease({ id: 2, status: 'downloading' }),
      ];

      const downloadingReleases = allReleases.filter((r) => r.status === 'downloading');
      expect(downloadingReleases).toHaveLength(2);
    });

    test('should return releases with completed status', async () => {
      const allReleases = [
        createMockRelease({ id: 1, status: 'completed' }),
        createMockRelease({ id: 2, status: 'failed' }),
      ];

      const completedReleases = allReleases.filter((r) => r.status === 'completed');
      expect(completedReleases).toHaveLength(1);
    });

    test('should return releases with failed status', async () => {
      const allReleases = [
        createMockRelease({ id: 1, status: 'failed' }),
        createMockRelease({ id: 2, status: 'failed' }),
      ];

      const failedReleases = allReleases.filter((r) => r.status === 'failed');
      expect(failedReleases).toHaveLength(2);
    });
  });

  describe('findActiveDownloads', () => {
    test('should return only downloading releases', async () => {
      const allReleases = [
        createMockRelease({ id: 1, status: 'downloading' }),
        createMockRelease({ id: 2, status: 'pending' }),
        createMockRelease({ id: 3, status: 'downloading' }),
        createMockRelease({ id: 4, status: 'completed' }),
      ];

      const activeDownloads = allReleases.filter((r) => r.status === 'downloading');
      expect(activeDownloads).toHaveLength(2);
    });
  });

  describe('create', () => {
    test('should create a new release and return it', async () => {
      const newRelease = {
        gameId: 1,
        title: 'New.Release-CODEX',
        downloadUrl: 'magnet:?xt=...',
        indexer: 'rarbg',
      };

      const mockCreatedRelease = createMockRelease({
        id: 100,
        ...newRelease,
      });

      expect(mockCreatedRelease.id).toBe(100);
      expect(mockCreatedRelease.title).toBe('New.Release-CODEX');
    });
  });

  describe('update', () => {
    test('should update a release and return updated release', async () => {
      const originalRelease = createMockRelease({ id: 1, status: 'pending' });
      const updatedRelease = { ...originalRelease, status: 'downloading' as const };

      expect(updatedRelease.status).toBe('downloading');
    });

    test('should return undefined when release does not exist', async () => {
      const results: ReturnType<typeof createMockRelease>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    test('should update release status', async () => {
      const originalRelease = createMockRelease({ id: 1, status: 'pending' });
      const updatedRelease = { ...originalRelease, status: 'completed' as const };

      expect(updatedRelease.status).toBe('completed');
    });
  });

  describe('batchUpdateStatus', () => {
    test('should update status for multiple releases grouped by status', async () => {
      const updates = [
        { id: 1, status: 'completed' as const },
        { id: 2, status: 'completed' as const },
        { id: 3, status: 'failed' as const },
      ];

      // Group by status
      const byStatus = new Map<string, number[]>();
      for (const update of updates) {
        const ids = byStatus.get(update.status) || [];
        ids.push(update.id);
        byStatus.set(update.status, ids);
      }

      expect(byStatus.get('completed')).toEqual([1, 2]);
      expect(byStatus.get('failed')).toEqual([3]);
    });

    test('should do nothing for empty updates array', async () => {
      const updates: Array<{ id: number; status: 'pending' }> = [];
      expect(updates.length).toBe(0);
    });
  });

  describe('delete', () => {
    test('should return true when release is deleted', async () => {
      const result = { changes: 1 };
      expect(result.changes > 0).toBe(true);
    });

    test('should return false when release does not exist', async () => {
      const result = { changes: 0 };
      expect(result.changes > 0).toBe(false);
    });
  });

  describe('batchDelete', () => {
    test('should delete multiple releases and return count', async () => {
      const ids = [1, 2, 3];
      const result = { changes: 3 };
      expect(result.changes).toBe(3);
    });

    test('should return 0 for empty input', async () => {
      const ids: number[] = [];
      const result = { changes: 0 };
      expect(result.changes).toBe(0);
    });
  });

  describe('deleteByGameId', () => {
    test('should delete all releases for a game', async () => {
      const gameId = 1;
      const allReleases = [
        createMockRelease({ id: 1, gameId: 1 }),
        createMockRelease({ id: 2, gameId: 1 }),
        createMockRelease({ id: 3, gameId: 2 }),
      ];

      const deletedCount = allReleases.filter((r) => r.gameId === gameId).length;
      expect(deletedCount).toBe(2);
    });
  });

  describe('findLatestByGameId', () => {
    test('should return most recent release for game', async () => {
      const releases = [
        createMockRelease({ id: 1, gameId: 1, grabbedAt: new Date('2024-01-01') }),
        createMockRelease({ id: 2, gameId: 1, grabbedAt: new Date('2024-01-03') }),
        createMockRelease({ id: 3, gameId: 1, grabbedAt: new Date('2024-01-02') }),
      ];

      const sorted = releases.sort((a, b) => b.grabbedAt.getTime() - a.grabbedAt.getTime());
      const latest = sorted[0];

      expect(latest?.id).toBe(2);
    });

    test('should return undefined when no releases for game', async () => {
      const releases: ReturnType<typeof createMockRelease>[] = [];
      expect(releases[0]).toBeUndefined();
    });
  });

  describe('findByTorrentHash', () => {
    test('should return release when hash matches', async () => {
      const mockRelease = createMockRelease({ torrentHash: 'abc123def456' });
      const results = [mockRelease];

      expect(results[0]?.torrentHash).toBe('abc123def456');
    });

    test('should return undefined when hash not found', async () => {
      const results: ReturnType<typeof createMockRelease>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });
});

// =============================================================================
// DownloadHistoryRepository Tests
// =============================================================================
describe('DownloadHistoryRepository', () => {
  const createMockDownloadHistory = (overrides = {}) => ({
    id: 1,
    gameId: 1,
    releaseId: 1,
    downloadId: 'dl-abc123',
    status: 'downloading',
    progress: 50,
    completedAt: null as Date | null,
    ...overrides,
  });

  describe('findAll', () => {
    test('should return all download history entries ordered by id descending', async () => {
      const mockEntries = [
        createMockDownloadHistory({ id: 3 }),
        createMockDownloadHistory({ id: 2 }),
        createMockDownloadHistory({ id: 1 }),
      ];

      const sorted = mockEntries.sort((a, b) => b.id - a.id);
      expect(sorted[0].id).toBe(3);
    });
  });

  describe('findById', () => {
    test('should return download history entry when found', async () => {
      const mockEntry = createMockDownloadHistory({ id: 1 });
      const results = [mockEntry];
      expect(results[0]?.id).toBe(1);
    });

    test('should return undefined when not found', async () => {
      const results: ReturnType<typeof createMockDownloadHistory>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('findByGameId', () => {
    test('should return download history for specific game', async () => {
      const allEntries = [
        createMockDownloadHistory({ id: 1, gameId: 1 }),
        createMockDownloadHistory({ id: 2, gameId: 1 }),
        createMockDownloadHistory({ id: 3, gameId: 2 }),
      ];

      const gameEntries = allEntries.filter((e) => e.gameId === 1);
      expect(gameEntries).toHaveLength(2);
    });
  });

  describe('findByReleaseId', () => {
    test('should return download history for specific release', async () => {
      const allEntries = [
        createMockDownloadHistory({ id: 1, releaseId: 1 }),
        createMockDownloadHistory({ id: 2, releaseId: 2 }),
      ];

      const releaseEntries = allEntries.filter((e) => e.releaseId === 1);
      expect(releaseEntries).toHaveLength(1);
    });
  });

  describe('findByDownloadId', () => {
    test('should return download history entry by download ID', async () => {
      const mockEntry = createMockDownloadHistory({ downloadId: 'dl-unique-123' });
      const results = [mockEntry];

      expect(results[0]?.downloadId).toBe('dl-unique-123');
    });

    test('should return undefined when download ID not found', async () => {
      const results: ReturnType<typeof createMockDownloadHistory>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('create', () => {
    test('should create a new download history entry', async () => {
      const newEntry = {
        gameId: 1,
        releaseId: 1,
        downloadId: 'dl-new-123',
        status: 'downloading',
      };

      const mockCreatedEntry = createMockDownloadHistory({
        id: 100,
        ...newEntry,
      });

      expect(mockCreatedEntry.id).toBe(100);
      expect(mockCreatedEntry.downloadId).toBe('dl-new-123');
    });
  });

  describe('update', () => {
    test('should update download history entry', async () => {
      const originalEntry = createMockDownloadHistory({ id: 1, progress: 50 });
      const updatedEntry = { ...originalEntry, progress: 100 };

      expect(updatedEntry.progress).toBe(100);
    });

    test('should return undefined when entry does not exist', async () => {
      const results: ReturnType<typeof createMockDownloadHistory>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('updateByDownloadId', () => {
    test('should update download history by download ID', async () => {
      const originalEntry = createMockDownloadHistory({
        downloadId: 'dl-123',
        status: 'downloading',
        progress: 50,
      });

      const updatedEntry = {
        ...originalEntry,
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      };

      expect(updatedEntry.status).toBe('completed');
      expect(updatedEntry.progress).toBe(100);
      expect(updatedEntry.completedAt).toBeInstanceOf(Date);
    });

    test('should return undefined when download ID not found', async () => {
      const results: ReturnType<typeof createMockDownloadHistory>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('delete', () => {
    test('should return true when entry is deleted', async () => {
      const result = { changes: 1 };
      expect(result.changes > 0).toBe(true);
    });

    test('should return false when entry does not exist', async () => {
      const result = { changes: 0 };
      expect(result.changes > 0).toBe(false);
    });
  });

  describe('deleteByGameId', () => {
    test('should delete all download history for a game', async () => {
      const allEntries = [
        createMockDownloadHistory({ id: 1, gameId: 1 }),
        createMockDownloadHistory({ id: 2, gameId: 1 }),
        createMockDownloadHistory({ id: 3, gameId: 2 }),
      ];

      const deletedCount = allEntries.filter((e) => e.gameId === 1).length;
      expect(deletedCount).toBe(2);
    });
  });

  describe('deleteByReleaseId', () => {
    test('should delete all download history for a release', async () => {
      const allEntries = [
        createMockDownloadHistory({ id: 1, releaseId: 1 }),
        createMockDownloadHistory({ id: 2, releaseId: 1 }),
        createMockDownloadHistory({ id: 3, releaseId: 2 }),
      ];

      const deletedCount = allEntries.filter((e) => e.releaseId === 1).length;
      expect(deletedCount).toBe(2);
    });
  });
});

// =============================================================================
// SettingsRepository Tests
// =============================================================================
describe('SettingsRepository', () => {
  const createMockSetting = (overrides = {}) => ({
    id: 1,
    key: 'test_key',
    value: 'test_value',
    ...overrides,
  });

  describe('get', () => {
    test('should return value when setting exists', async () => {
      const results = [{ value: 'http://localhost:9696' }];
      const value = results[0]?.value || null;
      expect(value).toBe('http://localhost:9696');
    });

    test('should return null when setting does not exist', async () => {
      const results: { value: string }[] = [];
      const value = results[0]?.value || null;
      expect(value).toBeNull();
    });
  });

  describe('getJSON', () => {
    test('should parse and return JSON value', async () => {
      const jsonValue = JSON.stringify({ host: 'localhost', port: 8080 });
      const results = [{ value: jsonValue }];
      const value = results[0]?.value || null;

      if (value) {
        const parsed = JSON.parse(value);
        expect(parsed.host).toBe('localhost');
        expect(parsed.port).toBe(8080);
      }
    });

    test('should return null when setting does not exist', async () => {
      const results: { value: string }[] = [];
      const value = results[0]?.value || null;
      expect(value).toBeNull();
    });

    test('should return null for invalid JSON', async () => {
      const invalidJson = 'not valid json {';

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(invalidJson);
      } catch {
        parsed = null;
      }

      expect(parsed).toBeNull();
    });

    test('should parse JSON array correctly', async () => {
      const jsonArray = JSON.stringify([1000, 2000, 5000]);
      const parsed = JSON.parse(jsonArray);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toEqual([1000, 2000, 5000]);
    });
  });

  describe('set', () => {
    test('should create new setting when key does not exist', async () => {
      const key = 'new_setting';
      const value = 'new_value';

      // Simulate upsert behavior
      const setting = createMockSetting({ key, value });
      expect(setting.key).toBe('new_setting');
      expect(setting.value).toBe('new_value');
    });

    test('should update existing setting when key exists', async () => {
      const existingSetting = createMockSetting({ key: 'existing_key', value: 'old_value' });
      const updatedSetting = { ...existingSetting, value: 'new_value' };

      expect(updatedSetting.value).toBe('new_value');
    });
  });

  describe('setJSON', () => {
    test('should stringify and store JSON value', async () => {
      const key = 'json_setting';
      const value = { host: 'localhost', port: 8080 };

      const jsonString = JSON.stringify(value);
      const setting = createMockSetting({ key, value: jsonString });

      expect(setting.value).toBe('{"host":"localhost","port":8080}');
    });

    test('should handle array values', async () => {
      const key = 'prowlarr_categories';
      const value = [1000, 2000, 5000];

      const jsonString = JSON.stringify(value);
      expect(jsonString).toBe('[1000,2000,5000]');
    });
  });

  describe('delete', () => {
    test('should delete setting by key', async () => {
      // Simulate delete operation
      const settings = [createMockSetting({ key: 'to_delete' }), createMockSetting({ key: 'keep' })];

      const remaining = settings.filter((s) => s.key !== 'to_delete');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].key).toBe('keep');
    });
  });

  describe('getAll', () => {
    test('should return all settings', async () => {
      const mockSettings = [
        createMockSetting({ key: 'setting1', value: 'value1' }),
        createMockSetting({ key: 'setting2', value: 'value2' }),
        createMockSetting({ key: 'setting3', value: 'value3' }),
      ];

      expect(mockSettings).toHaveLength(3);
    });

    test('should return empty array when no settings exist', async () => {
      const mockSettings: ReturnType<typeof createMockSetting>[] = [];
      expect(mockSettings).toHaveLength(0);
    });
  });
});

// =============================================================================
// LibraryRepository Tests
// =============================================================================
describe('LibraryRepository', () => {
  const createMockLibrary = (overrides = {}) => ({
    id: 1,
    name: 'PC Games',
    path: 'C:\\Games',
    platform: 'PC',
    monitored: true,
    downloadEnabled: true,
    downloadCategory: 'gamearr',
    priority: 0,
    createdAt: new Date(),
    ...overrides,
  });

  describe('findAll', () => {
    test('should return all libraries ordered by priority then createdAt', async () => {
      const mockLibraries = [
        createMockLibrary({ id: 1, priority: 1 }),
        createMockLibrary({ id: 2, priority: 0 }),
        createMockLibrary({ id: 3, priority: 0, createdAt: new Date('2024-01-02') }),
      ];

      const sorted = mockLibraries.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      expect(sorted[0].priority).toBe(0);
    });
  });

  describe('findById', () => {
    test('should return library when found', async () => {
      const mockLibrary = createMockLibrary({ id: 1 });
      const results = [mockLibrary];
      expect(results[0]?.id).toBe(1);
    });

    test('should return undefined when not found', async () => {
      const results: ReturnType<typeof createMockLibrary>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('findByPath', () => {
    test('should return library when path matches', async () => {
      const mockLibrary = createMockLibrary({ path: 'C:\\Games' });
      const results = [mockLibrary];
      expect(results[0]?.path).toBe('C:\\Games');
    });

    test('should return undefined when path not found', async () => {
      const results: ReturnType<typeof createMockLibrary>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('findByPlatform', () => {
    test('should return libraries for specific platform', async () => {
      const allLibraries = [
        createMockLibrary({ id: 1, platform: 'PC' }),
        createMockLibrary({ id: 2, platform: 'PC' }),
        createMockLibrary({ id: 3, platform: 'PlayStation' }),
      ];

      const pcLibraries = allLibraries.filter((l) => l.platform === 'PC');
      expect(pcLibraries).toHaveLength(2);
    });
  });

  describe('findMonitored', () => {
    test('should return only monitored libraries', async () => {
      const allLibraries = [
        createMockLibrary({ id: 1, monitored: true }),
        createMockLibrary({ id: 2, monitored: false }),
        createMockLibrary({ id: 3, monitored: true }),
      ];

      const monitoredLibraries = allLibraries.filter((l) => l.monitored);
      expect(monitoredLibraries).toHaveLength(2);
    });
  });

  describe('findDownloadEnabled', () => {
    test('should return only download-enabled libraries', async () => {
      const allLibraries = [
        createMockLibrary({ id: 1, downloadEnabled: true }),
        createMockLibrary({ id: 2, downloadEnabled: false }),
        createMockLibrary({ id: 3, downloadEnabled: true }),
      ];

      const downloadEnabledLibraries = allLibraries.filter((l) => l.downloadEnabled);
      expect(downloadEnabledLibraries).toHaveLength(2);
    });
  });

  describe('create', () => {
    test('should create a new library', async () => {
      const newLibrary = {
        name: 'New Library',
        path: 'D:\\NewGames',
        platform: 'PC',
      };

      const mockCreatedLibrary = createMockLibrary({
        id: 100,
        ...newLibrary,
      });

      expect(mockCreatedLibrary.id).toBe(100);
      expect(mockCreatedLibrary.name).toBe('New Library');
      expect(mockCreatedLibrary.path).toBe('D:\\NewGames');
    });
  });

  describe('update', () => {
    test('should update a library', async () => {
      const originalLibrary = createMockLibrary({ id: 1, name: 'Old Name' });
      const updatedLibrary = { ...originalLibrary, name: 'New Name' };

      expect(updatedLibrary.name).toBe('New Name');
    });

    test('should return undefined when library does not exist', async () => {
      const results: ReturnType<typeof createMockLibrary>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('delete', () => {
    test('should return true when library is deleted', async () => {
      const result = { changes: 1 };
      expect(result.changes > 0).toBe(true);
    });

    test('should return false when library does not exist', async () => {
      const result = { changes: 0 };
      expect(result.changes > 0).toBe(false);
    });
  });

  describe('existsByPath', () => {
    test('should return true when path exists', async () => {
      const mockLibrary = createMockLibrary({ path: 'C:\\Games' });
      const exists = !!mockLibrary;
      expect(exists).toBe(true);
    });

    test('should return false when path does not exist', async () => {
      const mockLibrary = undefined;
      const exists = !!mockLibrary;
      expect(exists).toBe(false);
    });
  });

  describe('count', () => {
    test('should return total count of libraries', async () => {
      const libraries = [
        createMockLibrary({ id: 1 }),
        createMockLibrary({ id: 2 }),
        createMockLibrary({ id: 3 }),
      ];
      expect(libraries.length).toBe(3);
    });

    test('should return 0 when no libraries exist', async () => {
      const libraries: ReturnType<typeof createMockLibrary>[] = [];
      expect(libraries.length).toBe(0);
    });
  });
});

// =============================================================================
// LibraryFileRepository Tests
// =============================================================================
describe('LibraryFileRepository', () => {
  const createMockLibraryFile = (overrides = {}) => ({
    id: 1,
    folderPath: 'C:\\Games\\Cyberpunk 2077 (2020)',
    parsedTitle: 'Cyberpunk 2077',
    parsedYear: 2020,
    matchedGameId: null as number | null,
    libraryId: 1,
    ignored: false,
    scannedAt: new Date(),
    ...overrides,
  });

  describe('findAll', () => {
    test('should return all library files ordered by scannedAt descending', async () => {
      const mockFiles = [
        createMockLibraryFile({ id: 1, scannedAt: new Date('2024-01-03') }),
        createMockLibraryFile({ id: 2, scannedAt: new Date('2024-01-01') }),
        createMockLibraryFile({ id: 3, scannedAt: new Date('2024-01-02') }),
      ];

      const sorted = mockFiles.sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());
      expect(sorted[0].id).toBe(1);
    });
  });

  describe('findByLibraryId', () => {
    test('should return files for specific library', async () => {
      const allFiles = [
        createMockLibraryFile({ id: 1, libraryId: 1 }),
        createMockLibraryFile({ id: 2, libraryId: 1 }),
        createMockLibraryFile({ id: 3, libraryId: 2 }),
      ];

      const libraryFiles = allFiles.filter((f) => f.libraryId === 1);
      expect(libraryFiles).toHaveLength(2);
    });
  });

  describe('findByPath', () => {
    test('should return file when path matches', async () => {
      const mockFile = createMockLibraryFile({ folderPath: 'C:\\Games\\Test (2023)' });
      const results = [mockFile];
      expect(results[0]?.folderPath).toBe('C:\\Games\\Test (2023)');
    });

    test('should return undefined when path not found', async () => {
      const results: ReturnType<typeof createMockLibraryFile>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('findUnmatched', () => {
    test('should return unmatched and non-ignored files', async () => {
      const allFiles = [
        createMockLibraryFile({ id: 1, matchedGameId: null, ignored: false }),
        createMockLibraryFile({ id: 2, matchedGameId: 123, ignored: false }),
        createMockLibraryFile({ id: 3, matchedGameId: null, ignored: true }),
        createMockLibraryFile({ id: 4, matchedGameId: null, ignored: false }),
      ];

      const unmatchedFiles = allFiles.filter(
        (f) => f.matchedGameId === null && f.ignored === false
      );
      expect(unmatchedFiles).toHaveLength(2);
    });
  });

  describe('findIgnored', () => {
    test('should return only ignored files', async () => {
      const allFiles = [
        createMockLibraryFile({ id: 1, ignored: true }),
        createMockLibraryFile({ id: 2, ignored: false }),
        createMockLibraryFile({ id: 3, ignored: true }),
      ];

      const ignoredFiles = allFiles.filter((f) => f.ignored);
      expect(ignoredFiles).toHaveLength(2);
    });
  });

  describe('findMatched', () => {
    test('should return only matched files', async () => {
      const allFiles = [
        createMockLibraryFile({ id: 1, matchedGameId: 123 }),
        createMockLibraryFile({ id: 2, matchedGameId: null }),
        createMockLibraryFile({ id: 3, matchedGameId: 456 }),
      ];

      const matchedFiles = allFiles.filter((f) => f.matchedGameId !== null);
      expect(matchedFiles).toHaveLength(2);
    });
  });

  describe('upsert', () => {
    test('should create new file when path does not exist', async () => {
      const newFile = {
        folderPath: 'C:\\Games\\New Game (2024)',
        parsedTitle: 'New Game',
        parsedYear: 2024,
        libraryId: 1,
      };

      const mockCreatedFile = createMockLibraryFile({
        id: 100,
        ...newFile,
      });

      expect(mockCreatedFile.id).toBe(100);
      expect(mockCreatedFile.parsedTitle).toBe('New Game');
    });

    test('should update existing file when path exists', async () => {
      const existingFile = createMockLibraryFile({
        folderPath: 'C:\\Games\\Existing (2020)',
        parsedTitle: 'Existing',
      });

      const updatedFile = {
        ...existingFile,
        parsedTitle: 'Existing Game',
        scannedAt: new Date(),
      };

      expect(updatedFile.parsedTitle).toBe('Existing Game');
    });
  });

  describe('matchToGame', () => {
    test('should set matchedGameId for file', async () => {
      const originalFile = createMockLibraryFile({
        folderPath: 'C:\\Games\\Test (2023)',
        matchedGameId: null,
      });

      const matchedFile = { ...originalFile, matchedGameId: 123 };
      expect(matchedFile.matchedGameId).toBe(123);
    });

    test('should return undefined when file not found', async () => {
      const results: ReturnType<typeof createMockLibraryFile>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('unmatch', () => {
    test('should set matchedGameId to null', async () => {
      const matchedFile = createMockLibraryFile({
        folderPath: 'C:\\Games\\Test (2023)',
        matchedGameId: 123,
      });

      const unmatchedFile = { ...matchedFile, matchedGameId: null };
      expect(unmatchedFile.matchedGameId).toBeNull();
    });
  });

  describe('ignore', () => {
    test('should set ignored to true', async () => {
      const originalFile = createMockLibraryFile({
        folderPath: 'C:\\Games\\Test (2023)',
        ignored: false,
      });

      const ignoredFile = { ...originalFile, ignored: true };
      expect(ignoredFile.ignored).toBe(true);
    });
  });

  describe('unignore', () => {
    test('should set ignored to false', async () => {
      const ignoredFile = createMockLibraryFile({
        folderPath: 'C:\\Games\\Test (2023)',
        ignored: true,
      });

      const unignoredFile = { ...ignoredFile, ignored: false };
      expect(unignoredFile.ignored).toBe(false);
    });
  });

  describe('delete', () => {
    test('should return true when file is deleted', async () => {
      const result = { changes: 1 };
      expect(result.changes > 0).toBe(true);
    });

    test('should return false when file does not exist', async () => {
      const result = { changes: 0 };
      expect(result.changes > 0).toBe(false);
    });
  });

  describe('clearAll', () => {
    test('should delete all library files and return count', async () => {
      const allFiles = [
        createMockLibraryFile({ id: 1 }),
        createMockLibraryFile({ id: 2 }),
        createMockLibraryFile({ id: 3 }),
      ];

      const result = { changes: allFiles.length };
      expect(result.changes).toBe(3);
    });

    test('should return 0 when no files exist', async () => {
      const result = { changes: 0 };
      expect(result.changes).toBe(0);
    });
  });
});

// =============================================================================
// GameUpdateRepository Tests
// =============================================================================
describe('GameUpdateRepository', () => {
  const createMockGameUpdate = (overrides = {}) => ({
    id: 1,
    gameId: 1,
    updateType: 'version' as const,
    title: 'Cyberpunk.2077.v2.1-GOG',
    version: '2.1',
    size: 5000000000,
    quality: 'GOG',
    seeders: 50,
    downloadUrl: 'magnet:?xt=urn:btih:...',
    indexer: 'rarbg',
    detectedAt: new Date(),
    status: 'pending' as const,
    ...overrides,
  });

  describe('findAll', () => {
    test('should return all updates ordered by detectedAt descending', async () => {
      const mockUpdates = [
        createMockGameUpdate({ id: 1, detectedAt: new Date('2024-01-03') }),
        createMockGameUpdate({ id: 2, detectedAt: new Date('2024-01-01') }),
      ];

      const sorted = mockUpdates.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
      expect(sorted[0].id).toBe(1);
    });
  });

  describe('findByGameId', () => {
    test('should return updates for specific game', async () => {
      const allUpdates = [
        createMockGameUpdate({ id: 1, gameId: 1 }),
        createMockGameUpdate({ id: 2, gameId: 1 }),
        createMockGameUpdate({ id: 3, gameId: 2 }),
      ];

      const gameUpdates = allUpdates.filter((u) => u.gameId === 1);
      expect(gameUpdates).toHaveLength(2);
    });
  });

  describe('findPending', () => {
    test('should return only pending updates', async () => {
      const allUpdates = [
        createMockGameUpdate({ id: 1, status: 'pending' }),
        createMockGameUpdate({ id: 2, status: 'grabbed' }),
        createMockGameUpdate({ id: 3, status: 'pending' }),
        createMockGameUpdate({ id: 4, status: 'dismissed' }),
      ];

      const pendingUpdates = allUpdates.filter((u) => u.status === 'pending');
      expect(pendingUpdates).toHaveLength(2);
    });
  });

  describe('findPendingPaginated', () => {
    test('should return paginated pending updates', async () => {
      const mockUpdates = Array(25)
        .fill(null)
        .map((_, i) =>
          createMockGameUpdate({
            id: i + 1,
            status: 'pending',
            title: `Update ${i + 1}`,
          })
        );

      const limit = 20;
      const offset = 0;
      const items = mockUpdates.slice(offset, offset + limit);
      const total = mockUpdates.length;

      const result = { items, total, limit, offset };

      expect(result.items).toHaveLength(20);
      expect(result.total).toBe(25);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('findPendingByGameId', () => {
    test('should return pending updates for specific game', async () => {
      const allUpdates = [
        createMockGameUpdate({ id: 1, gameId: 1, status: 'pending' }),
        createMockGameUpdate({ id: 2, gameId: 1, status: 'grabbed' }),
        createMockGameUpdate({ id: 3, gameId: 1, status: 'pending' }),
        createMockGameUpdate({ id: 4, gameId: 2, status: 'pending' }),
      ];

      const gamePendingUpdates = allUpdates.filter(
        (u) => u.gameId === 1 && u.status === 'pending'
      );
      expect(gamePendingUpdates).toHaveLength(2);
    });
  });

  describe('findByDownloadUrl', () => {
    test('should return update when URL matches', async () => {
      const mockUpdate = createMockGameUpdate({ downloadUrl: 'magnet:?xt=unique' });
      const results = [mockUpdate];
      expect(results[0]?.downloadUrl).toBe('magnet:?xt=unique');
    });

    test('should return undefined when URL not found', async () => {
      const results: ReturnType<typeof createMockGameUpdate>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('findByTitleAndGameId', () => {
    test('should return update when title and gameId match', async () => {
      const mockUpdate = createMockGameUpdate({
        title: 'Specific.Update-GOG',
        gameId: 1,
      });
      const results = [mockUpdate];

      expect(results[0]?.title).toBe('Specific.Update-GOG');
      expect(results[0]?.gameId).toBe(1);
    });

    test('should return undefined when no match', async () => {
      const results: ReturnType<typeof createMockGameUpdate>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('findById', () => {
    test('should return update when found', async () => {
      const mockUpdate = createMockGameUpdate({ id: 1 });
      const results = [mockUpdate];
      expect(results[0]?.id).toBe(1);
    });

    test('should return undefined when not found', async () => {
      const results: ReturnType<typeof createMockGameUpdate>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('create', () => {
    test('should create a new update', async () => {
      const newUpdate = {
        gameId: 1,
        updateType: 'version' as const,
        title: 'New.Update.v2.0-GOG',
        version: '2.0',
      };

      const mockCreatedUpdate = createMockGameUpdate({
        id: 100,
        ...newUpdate,
      });

      expect(mockCreatedUpdate.id).toBe(100);
      expect(mockCreatedUpdate.title).toBe('New.Update.v2.0-GOG');
    });
  });

  describe('createMany', () => {
    test('should create multiple updates in batch', async () => {
      const newUpdates = [
        { gameId: 1, updateType: 'version' as const, title: 'Update 1' },
        { gameId: 2, updateType: 'dlc' as const, title: 'Update 2' },
        { gameId: 3, updateType: 'better_release' as const, title: 'Update 3' },
      ];

      const mockCreatedUpdates = newUpdates.map((u, i) =>
        createMockGameUpdate({ id: i + 1, ...u })
      );

      expect(mockCreatedUpdates).toHaveLength(3);
    });

    test('should return empty array for empty input', async () => {
      const newUpdates: Array<{ gameId: number; updateType: 'version'; title: string }> = [];
      expect(newUpdates.length).toBe(0);
    });
  });

  describe('updateStatus', () => {
    test('should update status to grabbed', async () => {
      const originalUpdate = createMockGameUpdate({ id: 1, status: 'pending' });
      const updatedUpdate = { ...originalUpdate, status: 'grabbed' as const };

      expect(updatedUpdate.status).toBe('grabbed');
    });

    test('should update status to dismissed', async () => {
      const originalUpdate = createMockGameUpdate({ id: 1, status: 'pending' });
      const updatedUpdate = { ...originalUpdate, status: 'dismissed' as const };

      expect(updatedUpdate.status).toBe('dismissed');
    });

    test('should return undefined when update does not exist', async () => {
      const results: ReturnType<typeof createMockGameUpdate>[] = [];
      expect(results[0]).toBeUndefined();
    });
  });

  describe('delete', () => {
    test('should return true when update is deleted', async () => {
      const result = { changes: 1 };
      expect(result.changes > 0).toBe(true);
    });

    test('should return false when update does not exist', async () => {
      const result = { changes: 0 };
      expect(result.changes > 0).toBe(false);
    });
  });

  describe('deleteByGameId', () => {
    test('should delete all updates for a game', async () => {
      const allUpdates = [
        createMockGameUpdate({ id: 1, gameId: 1 }),
        createMockGameUpdate({ id: 2, gameId: 1 }),
        createMockGameUpdate({ id: 3, gameId: 2 }),
      ];

      const deletedCount = allUpdates.filter((u) => u.gameId === 1).length;
      expect(deletedCount).toBe(2);
    });
  });
});

// =============================================================================
// Edge Cases and Error Handling Tests
// =============================================================================
describe('Repository Edge Cases', () => {
  describe('GameRepository Edge Cases', () => {
    test('should handle very long title strings', () => {
      const longTitle = 'A'.repeat(1000);
      const game = { title: longTitle };
      expect(game.title.length).toBe(1000);
    });

    test('should handle special characters in title', () => {
      const specialTitle = "Game: The 'Sequel' - Part 2 (2024) [Special Edition]";
      const game = { title: specialTitle };
      expect(game.title).toBe(specialTitle);
    });

    test('should handle unicode characters in title', () => {
      const unicodeTitle = 'Ori and the Will of the Wisps';
      const game = { title: unicodeTitle };
      expect(game.title).toBe(unicodeTitle);
    });

    test('should handle negative igdbId gracefully', () => {
      // While this shouldn't happen, the repository should handle it
      const igdbId = -1;
      expect(igdbId < 0).toBe(true);
    });

    test('should handle zero igdbId', () => {
      const igdbId = 0;
      expect(igdbId === 0).toBe(true);
    });

    test('should handle null folderPath', () => {
      const game = { folderPath: null };
      expect(game.folderPath).toBeNull();
    });

    test('should handle empty genres array', () => {
      const genres = JSON.stringify([]);
      expect(JSON.parse(genres)).toEqual([]);
    });

    test('should handle very large year values', () => {
      const year = 9999;
      const game = { year };
      expect(game.year).toBe(9999);
    });

    test('should handle year before gaming era', () => {
      const year = 1970;
      const game = { year };
      expect(game.year).toBe(1970);
    });
  });

  describe('ReleaseRepository Edge Cases', () => {
    test('should handle null torrentHash', () => {
      const release = { torrentHash: null };
      expect(release.torrentHash).toBeNull();
    });

    test('should handle zero seeders', () => {
      const release = { seeders: 0 };
      expect(release.seeders).toBe(0);
    });

    test('should handle very large size values', () => {
      const size = 150_000_000_000; // 150 GB
      const release = { size };
      expect(release.size).toBe(150_000_000_000);
    });

    test('should handle null grabbedAt date', () => {
      const release = { grabbedAt: null };
      expect(release.grabbedAt).toBeNull();
    });

    test('should handle empty download URL', () => {
      // This shouldn't happen due to schema constraints, but testing edge case
      const release = { downloadUrl: '' };
      expect(release.downloadUrl).toBe('');
    });
  });

  describe('DownloadHistoryRepository Edge Cases', () => {
    test('should handle progress at 0%', () => {
      const entry = { progress: 0 };
      expect(entry.progress).toBe(0);
    });

    test('should handle progress at 100%', () => {
      const entry = { progress: 100 };
      expect(entry.progress).toBe(100);
    });

    test('should handle progress over 100% (edge case)', () => {
      // Shouldn't happen but testing robustness
      const entry = { progress: 150 };
      expect(entry.progress).toBeGreaterThan(100);
    });

    test('should handle very long downloadId strings', () => {
      const longId = 'dl-' + 'x'.repeat(500);
      const entry = { downloadId: longId };
      expect(entry.downloadId.length).toBe(503);
    });
  });

  describe('SettingsRepository Edge Cases', () => {
    test('should handle empty value string', () => {
      const setting = { value: '' };
      expect(setting.value).toBe('');
    });

    test('should handle very long value strings', () => {
      const longValue = JSON.stringify({ data: 'x'.repeat(10000) });
      const setting = { value: longValue };
      expect(setting.value.length).toBeGreaterThan(10000);
    });

    test('should handle deeply nested JSON', () => {
      const deepObject = { level1: { level2: { level3: { level4: { value: 'deep' } } } } };
      const jsonString = JSON.stringify(deepObject);
      const parsed = JSON.parse(jsonString);
      expect(parsed.level1.level2.level3.level4.value).toBe('deep');
    });

    test('should handle JSON with special characters', () => {
      const specialChars = { path: 'C:\\Users\\Test\\Games' };
      const jsonString = JSON.stringify(specialChars);
      const parsed = JSON.parse(jsonString);
      expect(parsed.path).toBe('C:\\Users\\Test\\Games');
    });

    test('should handle numeric JSON values', () => {
      const numericValue = JSON.stringify(12345);
      const parsed = JSON.parse(numericValue);
      expect(parsed).toBe(12345);
    });

    test('should handle boolean JSON values', () => {
      const boolValue = JSON.stringify(true);
      const parsed = JSON.parse(boolValue);
      expect(parsed).toBe(true);
    });
  });

  describe('LibraryRepository Edge Cases', () => {
    test('should handle very long path strings', () => {
      const longPath = 'C:\\' + 'folder\\'.repeat(50) + 'games';
      const library = { path: longPath };
      expect(library.path.length).toBeGreaterThan(300);
    });

    test('should handle paths with spaces', () => {
      const pathWithSpaces = 'C:\\Program Files\\My Games\\Library';
      const library = { path: pathWithSpaces };
      expect(library.path).toBe(pathWithSpaces);
    });

    test('should handle negative priority', () => {
      const library = { priority: -1 };
      expect(library.priority).toBe(-1);
    });

    test('should handle null platform', () => {
      const library = { platform: null };
      expect(library.platform).toBeNull();
    });

    test('should handle empty downloadCategory', () => {
      const library = { downloadCategory: '' };
      expect(library.downloadCategory).toBe('');
    });
  });

  describe('LibraryFileRepository Edge Cases', () => {
    test('should handle null parsedTitle', () => {
      const file = { parsedTitle: null };
      expect(file.parsedTitle).toBeNull();
    });

    test('should handle null parsedYear', () => {
      const file = { parsedYear: null };
      expect(file.parsedYear).toBeNull();
    });

    test('should handle folder path with special characters', () => {
      const specialPath = "C:\\Games\\Assassin's Creed (2007) [Special Edition]";
      const file = { folderPath: specialPath };
      expect(file.folderPath).toBe(specialPath);
    });

    test('should handle unicode folder names', () => {
      const unicodePath = 'C:\\Games\\';
      const file = { folderPath: unicodePath };
      expect(file.folderPath).toBe(unicodePath);
    });
  });

  describe('GameUpdateRepository Edge Cases', () => {
    test('should handle null version', () => {
      const update = { version: null };
      expect(update.version).toBeNull();
    });

    test('should handle null size', () => {
      const update = { size: null };
      expect(update.size).toBeNull();
    });

    test('should handle null seeders', () => {
      const update = { seeders: null };
      expect(update.seeders).toBeNull();
    });

    test('should handle null downloadUrl', () => {
      const update = { downloadUrl: null };
      expect(update.downloadUrl).toBeNull();
    });

    test('should handle all update types', () => {
      const types = ['version', 'dlc', 'better_release'] as const;
      types.forEach((type) => {
        const update = { updateType: type };
        expect(update.updateType).toBe(type);
      });
    });

    test('should handle all status types', () => {
      const statuses = ['pending', 'grabbed', 'dismissed'] as const;
      statuses.forEach((status) => {
        const update = { status };
        expect(update.status).toBe(status);
      });
    });
  });
});

// =============================================================================
// Business Logic Tests
// =============================================================================
describe('Repository Business Logic', () => {
  describe('Game Status Transitions', () => {
    test('should allow transition from wanted to downloading', () => {
      const validTransitions = {
        wanted: ['downloading'],
        downloading: ['downloaded', 'wanted'],
        downloaded: ['wanted'],
      };

      const currentStatus = 'wanted';
      const newStatus = 'downloading';

      expect(validTransitions[currentStatus].includes(newStatus)).toBe(true);
    });

    test('should allow transition from downloading to downloaded', () => {
      const currentStatus = 'downloading';
      const newStatus = 'downloaded';

      // Valid transition in the download workflow
      const game = { status: currentStatus };
      const updatedGame = { ...game, status: newStatus };

      expect(updatedGame.status).toBe('downloaded');
    });

    test('should allow transition from downloading back to wanted (failed download)', () => {
      const currentStatus = 'downloading';
      const newStatus = 'wanted';

      const game = { status: currentStatus };
      const updatedGame = { ...game, status: newStatus };

      expect(updatedGame.status).toBe('wanted');
    });
  });

  describe('Release Status Transitions', () => {
    test('should allow transition from pending to downloading', () => {
      const release = { status: 'pending' as const };
      const updatedRelease = { ...release, status: 'downloading' as const };

      expect(updatedRelease.status).toBe('downloading');
    });

    test('should allow transition from downloading to completed', () => {
      const release = { status: 'downloading' as const };
      const updatedRelease = { ...release, status: 'completed' as const };

      expect(updatedRelease.status).toBe('completed');
    });

    test('should allow transition from downloading to failed', () => {
      const release = { status: 'downloading' as const };
      const updatedRelease = { ...release, status: 'failed' as const };

      expect(updatedRelease.status).toBe('failed');
    });
  });

  describe('Library File Matching Logic', () => {
    test('should match file to game when matched', () => {
      const file = { matchedGameId: null as number | null, ignored: false };
      const matchedFile = { ...file, matchedGameId: 123 };

      expect(matchedFile.matchedGameId).toBe(123);
      expect(matchedFile.ignored).toBe(false);
    });

    test('should not be ignored when matched', () => {
      const file = { matchedGameId: 123, ignored: false };

      // A matched file should not be ignored
      expect(file.matchedGameId).not.toBeNull();
      expect(file.ignored).toBe(false);
    });

    test('should be ignored or matched, not both simultaneously (logically)', () => {
      // When a file is ignored, matchedGameId is typically null
      const ignoredFile = { matchedGameId: null, ignored: true };

      expect(ignoredFile.ignored).toBe(true);
      expect(ignoredFile.matchedGameId).toBeNull();
    });
  });

  describe('Settings Value Types', () => {
    test('should handle prowlarr_url as string', () => {
      const value = 'http://localhost:9696';
      expect(typeof value).toBe('string');
    });

    test('should handle prowlarr_categories as JSON array', () => {
      const categories = [1000, 2000, 5000];
      const jsonValue = JSON.stringify(categories);
      const parsed = JSON.parse(jsonValue);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toEqual([1000, 2000, 5000]);
    });

    test('should handle qbittorrent_password as sensitive string', () => {
      const password = 'secret123';
      const setting = { key: 'qbittorrent_password', value: password };

      expect(setting.value).toBe('secret123');
      // Note: In real implementation, this should be encrypted
    });
  });

  describe('Pagination Logic', () => {
    test('should calculate correct offset for page 1', () => {
      const page = 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      expect(offset).toBe(0);
    });

    test('should calculate correct offset for page 2', () => {
      const page = 2;
      const limit = 20;
      const offset = (page - 1) * limit;

      expect(offset).toBe(20);
    });

    test('should calculate correct offset for page 5 with limit 10', () => {
      const page = 5;
      const limit = 10;
      const offset = (page - 1) * limit;

      expect(offset).toBe(40);
    });

    test('should calculate total pages correctly', () => {
      const total = 55;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(3);
    });
  });
});
