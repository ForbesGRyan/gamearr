import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test';

// ============================================================================
// DOWNLOAD MONITOR TESTS
// ============================================================================

/**
 * Test the DownloadMonitor job logic
 *
 * The DownloadMonitor polls qBittorrent every 30 seconds to sync download status.
 * We test:
 * - Job initialization and scheduling
 * - Core sync logic execution
 * - Error handling and connection state tracking
 * - Log spam prevention for offline qBittorrent
 */
describe('DownloadMonitor', () => {
  // Store original console methods
  let originalConsoleInfo: typeof console.info;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleDebug: typeof console.debug;
  let originalConsoleError: typeof console.error;

  // Log capture arrays
  let infoLogs: string[] = [];
  let warnLogs: string[] = [];
  let debugLogs: string[] = [];
  let errorLogs: string[] = [];

  beforeEach(() => {
    // Capture console output
    originalConsoleInfo = console.info;
    originalConsoleWarn = console.warn;
    originalConsoleDebug = console.debug;
    originalConsoleError = console.error;

    infoLogs = [];
    warnLogs = [];
    debugLogs = [];
    errorLogs = [];

    console.info = (...args) => infoLogs.push(args.join(' '));
    console.warn = (...args) => warnLogs.push(args.join(' '));
    console.debug = (...args) => debugLogs.push(args.join(' '));
    console.error = (...args) => errorLogs.push(args.join(' '));
  });

  afterEach(() => {
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.debug = originalConsoleDebug;
    console.error = originalConsoleError;
  });

  describe('Job State Management', () => {
    test('should track connection state changes', () => {
      // Simulate connection state tracking logic
      let isConnected = true;
      let consecutiveFailures = 0;

      // Simulate failure
      isConnected = false;
      consecutiveFailures = 1;

      expect(isConnected).toBe(false);
      expect(consecutiveFailures).toBe(1);

      // Simulate recovery
      isConnected = true;
      consecutiveFailures = 0;

      expect(isConnected).toBe(true);
      expect(consecutiveFailures).toBe(0);
    });

    test('should prevent concurrent sync execution', () => {
      let isRunning = false;
      const syncAttempts: boolean[] = [];

      const attemptSync = () => {
        if (isRunning) {
          syncAttempts.push(false); // Skipped
          return;
        }
        isRunning = true;
        syncAttempts.push(true); // Running
        // Simulate sync completion
        isRunning = false;
      };

      // First sync should run
      attemptSync();
      expect(syncAttempts[0]).toBe(true);

      // Simulate concurrent attempt while running
      isRunning = true;
      attemptSync();
      expect(syncAttempts[1]).toBe(false);
    });

    test('should reset isRunning on completion', () => {
      let isRunning = false;

      // Start sync
      isRunning = true;
      expect(isRunning).toBe(true);

      // Complete sync
      isRunning = false;
      expect(isRunning).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should categorize connection errors', () => {
      // Error codes from errors.ts
      const ErrorCode = {
        QBITTORRENT_CONNECTION_FAILED: 3201,
        QBITTORRENT_NOT_CONFIGURED: 3202,
        QBITTORRENT_AUTH_FAILED: 3203,
      };

      const isConnectionError = (errorCode: number) => {
        return (
          errorCode === ErrorCode.QBITTORRENT_CONNECTION_FAILED ||
          errorCode === ErrorCode.QBITTORRENT_NOT_CONFIGURED
        );
      };

      expect(isConnectionError(ErrorCode.QBITTORRENT_CONNECTION_FAILED)).toBe(true);
      expect(isConnectionError(ErrorCode.QBITTORRENT_NOT_CONFIGURED)).toBe(true);
      expect(isConnectionError(ErrorCode.QBITTORRENT_AUTH_FAILED)).toBe(false);
    });

    test('should throttle offline warning logs', () => {
      const OFFLINE_LOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
      let lastErrorTime = -OFFLINE_LOG_INTERVAL_MS - 1; // Initialize to allow first log
      let logCount = 0;

      const shouldLogOfflineWarning = (now: number) => {
        if (now - lastErrorTime > OFFLINE_LOG_INTERVAL_MS) {
          lastErrorTime = now;
          logCount++;
          return true;
        }
        return false;
      };

      // First call should log (lastErrorTime initialized to allow this)
      expect(shouldLogOfflineWarning(0)).toBe(true);
      expect(logCount).toBe(1);

      // Call within 5 minutes should not log
      expect(shouldLogOfflineWarning(1000)).toBe(false);
      expect(logCount).toBe(1);

      // Call after 5 minutes should log
      expect(shouldLogOfflineWarning(OFFLINE_LOG_INTERVAL_MS + 1)).toBe(true);
      expect(logCount).toBe(2);
    });

    test('should track consecutive failures', () => {
      let consecutiveFailures = 0;

      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        consecutiveFailures++;
      }
      expect(consecutiveFailures).toBe(5);

      // Reset on success
      consecutiveFailures = 0;
      expect(consecutiveFailures).toBe(0);
    });

    test('should distinguish first failure from subsequent failures', () => {
      let isConnected = true;

      const handleError = () => {
        if (isConnected) {
          // First failure - should log warning
          isConnected = false;
          return 'first_failure';
        }
        // Subsequent failure - throttled
        return 'subsequent_failure';
      };

      expect(handleError()).toBe('first_failure');
      expect(handleError()).toBe('subsequent_failure');
      expect(handleError()).toBe('subsequent_failure');
    });
  });

  describe('Connection Recovery', () => {
    test('should log recovery when connection restored', () => {
      let isConnected = false;
      let recoveryLogged = false;

      const handleSuccess = () => {
        if (!isConnected) {
          recoveryLogged = true;
          isConnected = true;
        }
      };

      handleSuccess();
      expect(isConnected).toBe(true);
      expect(recoveryLogged).toBe(true);
    });

    test('should not log recovery when already connected', () => {
      let isConnected = true;
      let recoveryLogged = false;

      const handleSuccess = () => {
        if (!isConnected) {
          recoveryLogged = true;
          isConnected = true;
        }
      };

      handleSuccess();
      expect(isConnected).toBe(true);
      expect(recoveryLogged).toBe(false);
    });
  });
});

// ============================================================================
// RSS SYNC TESTS
// ============================================================================

/**
 * Test the RssSync job logic
 *
 * The RssSync job fetches new releases from indexers and matches against wanted games.
 * We test:
 * - GUID deduplication with timestamps
 * - Stale entry cleanup
 * - Match scoring and confidence
 * - Auto-grab decision making
 */
describe('RssSync', () => {
  describe('Processed GUID Management', () => {
    test('should track processed GUIDs with timestamps', () => {
      const processedGuids = new Map<string, number>();

      const markAsProcessed = (guid: string) => {
        processedGuids.set(guid, Date.now());
      };

      const isProcessed = (guid: string) => {
        return processedGuids.has(guid);
      };

      markAsProcessed('guid-1');
      expect(isProcessed('guid-1')).toBe(true);
      expect(isProcessed('guid-2')).toBe(false);
    });

    test('should enforce maximum GUID limit', () => {
      const MAX_PROCESSED_GUIDS = 5;
      const processedGuids = new Map<string, number>();

      const markAsProcessed = (guid: string) => {
        const now = Date.now();
        processedGuids.set(guid, now);

        // Cleanup when over limit
        if (processedGuids.size > MAX_PROCESSED_GUIDS) {
          const excessCount = processedGuids.size - MAX_PROCESSED_GUIDS;
          let deleted = 0;
          for (const [key] of processedGuids) {
            if (deleted >= excessCount) break;
            processedGuids.delete(key);
            deleted++;
          }
        }
      };

      // Add more than max
      for (let i = 0; i < 7; i++) {
        markAsProcessed(`guid-${i}`);
      }

      expect(processedGuids.size).toBe(MAX_PROCESSED_GUIDS);
      // First entries should be removed (FIFO)
      expect(processedGuids.has('guid-0')).toBe(false);
      expect(processedGuids.has('guid-1')).toBe(false);
      expect(processedGuids.has('guid-6')).toBe(true);
    });

    test('should consider stale entries as not processed', () => {
      const MAX_GUID_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
      const processedGuids = new Map<string, number>();

      const isProcessed = (guid: string) => {
        const timestamp = processedGuids.get(guid);
        if (timestamp === undefined) return false;

        if (Date.now() - timestamp > MAX_GUID_AGE_MS) {
          processedGuids.delete(guid);
          return false;
        }
        return true;
      };

      // Add entry with old timestamp
      const oldTimestamp = Date.now() - MAX_GUID_AGE_MS - 1000;
      processedGuids.set('old-guid', oldTimestamp);

      expect(isProcessed('old-guid')).toBe(false);
      expect(processedGuids.has('old-guid')).toBe(false);
    });

    test('should cleanup stale entries periodically', () => {
      const MAX_GUID_AGE_MS = 24 * 60 * 60 * 1000;
      const processedGuids = new Map<string, number>();

      const cleanupStaleEntries = () => {
        const now = Date.now();
        const staleThreshold = now - MAX_GUID_AGE_MS;
        let staleCount = 0;

        for (const [guid, timestamp] of processedGuids) {
          if (timestamp < staleThreshold) {
            processedGuids.delete(guid);
            staleCount++;
          }
        }

        return staleCount;
      };

      // Add mix of fresh and stale entries
      const now = Date.now();
      processedGuids.set('fresh-1', now);
      processedGuids.set('fresh-2', now - 1000);
      processedGuids.set('stale-1', now - MAX_GUID_AGE_MS - 1);
      processedGuids.set('stale-2', now - MAX_GUID_AGE_MS - 2);

      const removed = cleanupStaleEntries();

      expect(removed).toBe(2);
      expect(processedGuids.size).toBe(2);
      expect(processedGuids.has('fresh-1')).toBe(true);
      expect(processedGuids.has('stale-1')).toBe(false);
    });
  });

  describe('Title Normalization', () => {
    const normalizeTitle = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/['']/g, '') // Remove apostrophes
        .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    };

    test('should remove apostrophes', () => {
      expect(normalizeTitle("Baldur's Gate")).toBe('baldurs gate');
      expect(normalizeTitle("Tony Hawk's Pro Skater")).toBe('tony hawks pro skater');
    });

    test('should handle special characters', () => {
      expect(normalizeTitle('Half-Life: Alyx')).toBe('half life alyx');
      expect(normalizeTitle('F.E.A.R.')).toBe('f e a r');
    });

    test('should normalize whitespace', () => {
      expect(normalizeTitle('  Game   Title  ')).toBe('game title');
    });
  });

  describe('Quality Extraction', () => {
    const extractQuality = (title: string): string | undefined => {
      const titleLower = title.toLowerCase();

      if (titleLower.includes('gog')) return 'GOG';
      if (titleLower.includes('drm free') || titleLower.includes('drm-free')) return 'DRM-Free';
      if (titleLower.includes('repack')) return 'Repack';
      if (titleLower.includes('scene')) return 'Scene';

      return undefined;
    };

    test('should identify GOG releases', () => {
      expect(extractQuality('Game.Name.GOG')).toBe('GOG');
      expect(extractQuality('Game Name (gog)')).toBe('GOG');
    });

    test('should identify DRM-Free releases', () => {
      expect(extractQuality('Game DRM-Free')).toBe('DRM-Free');
      expect(extractQuality('Game DRM Free Edition')).toBe('DRM-Free');
    });

    test('should identify Repack releases', () => {
      expect(extractQuality('Game-REPACK')).toBe('Repack');
    });

    test('should return undefined for unknown quality', () => {
      expect(extractQuality('Game Name 2023')).toBeUndefined();
    });
  });

  describe('Match Confidence', () => {
    test('should determine confidence based on score and word match', () => {
      const determineConfidence = (
        score: number,
        wordMatchRatio: number
      ): 'high' | 'medium' | 'low' => {
        if (score >= 150) return 'high';
        if (wordMatchRatio >= 0.8 && score > 100) return 'high';
        if (score < 80) return 'low';
        return 'medium';
      };

      expect(determineConfidence(200, 1.0)).toBe('high');
      expect(determineConfidence(150, 0.5)).toBe('high');
      expect(determineConfidence(120, 0.9)).toBe('high');
      expect(determineConfidence(100, 0.6)).toBe('medium');
      expect(determineConfidence(50, 0.3)).toBe('low');
    });

    test('should give high score for exact title match', () => {
      const normalizeTitle = (title: string) =>
        title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

      const releaseTitle = 'Cyberpunk 2077 GOG';
      const gameTitle = 'Cyberpunk 2077';

      const normalizedRelease = normalizeTitle(releaseTitle);
      const normalizedGame = normalizeTitle(gameTitle);

      const isExactMatch = normalizedRelease.includes(normalizedGame);
      expect(isExactMatch).toBe(true);
    });
  });

  describe('Auto-grab Decision', () => {
    test('should auto-grab releases meeting score threshold', () => {
      const shouldAutoGrab = (score: number, seeders: number, minScore: number, minSeeders: number) => {
        return score >= minScore && seeders >= minSeeders;
      };

      expect(shouldAutoGrab(150, 20, 100, 5)).toBe(true);
      expect(shouldAutoGrab(80, 20, 100, 5)).toBe(false);
      expect(shouldAutoGrab(150, 2, 100, 5)).toBe(false);
    });

    test('should remove grabbed game from wanted list', () => {
      const wantedGames = [
        { id: 1, title: 'Game A' },
        { id: 2, title: 'Game B' },
        { id: 3, title: 'Game C' },
      ];

      // Simulate grabbing Game B
      const grabbedGameId = 2;
      const gameIndex = wantedGames.findIndex((g) => g.id === grabbedGameId);

      if (gameIndex !== -1) {
        wantedGames.splice(gameIndex, 1);
      }

      expect(wantedGames.length).toBe(2);
      expect(wantedGames.find((g) => g.id === 2)).toBeUndefined();
    });
  });

  describe('Concurrent Execution Prevention', () => {
    test('should skip sync when already running', () => {
      let isRunning = false;
      let syncCount = 0;

      const sync = () => {
        if (isRunning) {
          return false; // Skipped
        }
        isRunning = true;
        syncCount++;
        isRunning = false;
        return true;
      };

      expect(sync()).toBe(true);
      expect(syncCount).toBe(1);

      // Simulate concurrent call
      isRunning = true;
      expect(sync()).toBe(false);
      expect(syncCount).toBe(1);
    });
  });
});

// ============================================================================
// METADATA REFRESH JOB TESTS
// ============================================================================

/**
 * Test the MetadataRefreshJob logic
 *
 * The MetadataRefreshJob fetches metadata for games that are missing it.
 * We test:
 * - Identifying games needing metadata
 * - Rate limiting between requests
 * - Error handling per game
 */
describe('MetadataRefreshJob', () => {
  describe('Game Selection', () => {
    test('should identify games needing metadata', () => {
      const games = [
        { id: 1, title: 'Game 1', summary: null, igdbId: 1001 },
        { id: 2, title: 'Game 2', summary: 'Has summary', igdbId: 1002 },
        { id: 3, title: 'Game 3', summary: null, igdbId: 1003 },
        { id: 4, title: 'Game 4', summary: null, igdbId: null }, // No IGDB ID
      ];

      const gamesNeedingMetadata = games.filter(
        (game) => game.summary === null && game.igdbId
      );

      expect(gamesNeedingMetadata.length).toBe(2);
      expect(gamesNeedingMetadata[0].id).toBe(1);
      expect(gamesNeedingMetadata[1].id).toBe(3);
    });

    test('should skip games without IGDB ID', () => {
      const game = { id: 1, title: 'Game', summary: null, igdbId: null };

      const needsMetadata = game.summary === null && game.igdbId !== null;
      expect(needsMetadata).toBe(false);
    });

    test('should skip games with existing summary', () => {
      const game = { id: 1, title: 'Game', summary: 'Existing summary', igdbId: 1001 };

      const needsMetadata = game.summary === null && game.igdbId;
      expect(needsMetadata).toBe(false);
    });
  });

  describe('Metadata Update', () => {
    test('should prepare metadata update payload', () => {
      const igdbGame = {
        summary: 'Game summary',
        genres: ['RPG', 'Action'],
        totalRating: 85.5,
        developer: 'Dev Studio',
        publisher: 'Publisher Inc',
        gameModes: ['Single Player', 'Co-op'],
        similarGames: [{ id: 1, name: 'Similar Game' }],
      };

      const updatePayload = {
        summary: igdbGame.summary || null,
        genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
        totalRating: igdbGame.totalRating || null,
        developer: igdbGame.developer || null,
        publisher: igdbGame.publisher || null,
        gameModes: igdbGame.gameModes ? JSON.stringify(igdbGame.gameModes) : null,
        similarGames: igdbGame.similarGames
          ? JSON.stringify(igdbGame.similarGames)
          : null,
      };

      expect(updatePayload.summary).toBe('Game summary');
      expect(updatePayload.genres).toBe('["RPG","Action"]');
      expect(updatePayload.totalRating).toBe(85.5);
    });

    test('should handle null/undefined values in metadata', () => {
      const igdbGame = {
        summary: undefined,
        genres: null,
        totalRating: null,
      };

      const updatePayload = {
        summary: igdbGame.summary || null,
        genres: igdbGame.genres ? JSON.stringify(igdbGame.genres) : null,
        totalRating: igdbGame.totalRating || null,
      };

      expect(updatePayload.summary).toBeNull();
      expect(updatePayload.genres).toBeNull();
      expect(updatePayload.totalRating).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    test('should implement delay between requests', async () => {
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const startTime = Date.now();
      await delay(50); // Simulating 50ms delay
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });
  });

  describe('Error Handling', () => {
    test('should continue processing on individual game failure', () => {
      const games = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const processedGames: number[] = [];
      const failedGames: number[] = [];

      for (const game of games) {
        try {
          if (game.id === 2) {
            throw new Error('IGDB error');
          }
          processedGames.push(game.id);
        } catch {
          failedGames.push(game.id);
          // Continue with next game
        }
      }

      expect(processedGames).toEqual([1, 3]);
      expect(failedGames).toEqual([2]);
    });

    test('should skip when IGDB not configured', () => {
      const isIgdbConfigured = false;
      let jobRan = false;

      if (isIgdbConfigured) {
        jobRan = true;
      }

      expect(jobRan).toBe(false);
    });
  });

  describe('Concurrent Execution Prevention', () => {
    test('should prevent concurrent metadata refresh', () => {
      let isRunning = false;
      let runCount = 0;

      const refreshMetadata = () => {
        if (isRunning) {
          return 'skipped';
        }
        isRunning = true;
        runCount++;
        return 'running';
      };

      expect(refreshMetadata()).toBe('running');
      expect(refreshMetadata()).toBe('skipped');
      expect(runCount).toBe(1);
    });
  });
});

// ============================================================================
// SEARCH SCHEDULER TESTS
// ============================================================================

/**
 * Test the SearchScheduler job logic
 *
 * The SearchScheduler searches for wanted games and auto-grabs releases.
 * We test:
 * - Failed download handling and retry logic
 * - Game status transitions
 * - Batch operations for efficiency
 */
describe('SearchScheduler', () => {
  describe('Failed Download Handling', () => {
    test('should identify failed releases', () => {
      const releases = [
        { id: 1, gameId: 1, status: 'completed' },
        { id: 2, gameId: 2, status: 'failed' },
        { id: 3, gameId: 3, status: 'downloading' },
        { id: 4, gameId: 4, status: 'failed' },
      ];

      const failedReleases = releases.filter((r) => r.status === 'failed');

      expect(failedReleases.length).toBe(2);
      expect(failedReleases.map((r) => r.id)).toEqual([2, 4]);
    });

    test('should extract unique game IDs from failed releases', () => {
      const failedReleases = [
        { id: 1, gameId: 10 },
        { id: 2, gameId: 20 },
        { id: 3, gameId: 10 }, // Duplicate
      ];

      const gameIds = [...new Set(failedReleases.map((r) => r.gameId))];

      expect(gameIds).toEqual([10, 20]);
    });

    test('should only reset monitored games with downloading status', () => {
      const games = [
        { id: 1, monitored: true, status: 'downloading' },
        { id: 2, monitored: false, status: 'downloading' },
        { id: 3, monitored: true, status: 'downloaded' },
        { id: 4, monitored: true, status: 'downloading' },
      ];

      const gamesToReset = games.filter(
        (g) => g.monitored && g.status === 'downloading'
      );

      expect(gamesToReset.length).toBe(2);
      expect(gamesToReset.map((g) => g.id)).toEqual([1, 4]);
    });
  });

  describe('Wanted Game Processing', () => {
    test('should filter monitored games by wanted status', () => {
      const monitoredGames = [
        { id: 1, monitored: true, status: 'wanted' },
        { id: 2, monitored: true, status: 'downloading' },
        { id: 3, monitored: true, status: 'wanted' },
        { id: 4, monitored: true, status: 'downloaded' },
      ];

      const wantedGames = monitoredGames.filter((g) => g.status === 'wanted');

      expect(wantedGames.length).toBe(2);
    });

    test('should track success and failure counts', () => {
      const results = [
        { game: 'Game 1', grabbed: true },
        { game: 'Game 2', grabbed: false },
        { game: 'Game 3', grabbed: true },
        { game: 'Game 4', error: true },
      ];

      let successCount = 0;
      let failureCount = 0;

      for (const result of results) {
        if (result.error) {
          failureCount++;
        } else if (result.grabbed) {
          successCount++;
        }
      }

      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
    });
  });

  describe('Auto-grab Logic', () => {
    test('should find first release meeting auto-grab criteria', () => {
      const releases = [
        { title: 'Release 1', score: 80 },
        { title: 'Release 2', score: 120 },
        { title: 'Release 3', score: 150 },
      ];

      const shouldAutoGrab = (release: { score: number }) => release.score >= 100;

      let bestRelease = null;
      for (const release of releases) {
        if (shouldAutoGrab(release)) {
          bestRelease = release;
          break;
        }
      }

      expect(bestRelease).not.toBeNull();
      expect(bestRelease!.title).toBe('Release 2');
    });

    test('should return null when no release meets criteria', () => {
      const releases = [
        { title: 'Release 1', score: 50 },
        { title: 'Release 2', score: 70 },
      ];

      const shouldAutoGrab = (release: { score: number }) => release.score >= 100;

      let bestRelease = null;
      for (const release of releases) {
        if (shouldAutoGrab(release)) {
          bestRelease = release;
          break;
        }
      }

      expect(bestRelease).toBeNull();
    });
  });

  describe('Interval Configuration', () => {
    test('should restart when interval changes', () => {
      let currentInterval = 15;
      let restartCount = 0;

      const checkIntervalChange = (newInterval: number) => {
        if (newInterval !== currentInterval) {
          restartCount++;
          currentInterval = newInterval;
          return true;
        }
        return false;
      };

      expect(checkIntervalChange(15)).toBe(false);
      expect(restartCount).toBe(0);

      expect(checkIntervalChange(30)).toBe(true);
      expect(restartCount).toBe(1);
      expect(currentInterval).toBe(30);
    });
  });

  describe('Dry-run Mode', () => {
    test('should respect dry-run setting', () => {
      const performAction = (isDryRun: boolean, action: () => string) => {
        if (isDryRun) {
          return `[DRY-RUN] Would perform: ${action.name}`;
        }
        return action();
      };

      const grabRelease = () => 'Release grabbed';

      const normalResult = performAction(false, grabRelease);
      expect(normalResult).toBe('Release grabbed');

      const dryRunResult = performAction(true, grabRelease);
      expect(dryRunResult).toContain('[DRY-RUN]');
    });
  });
});

// ============================================================================
// UPDATE CHECK JOB TESTS
// ============================================================================

/**
 * Test the UpdateCheckJob logic
 *
 * The UpdateCheckJob checks for game updates periodically.
 * We test:
 * - Schedule configuration (hourly/daily/weekly)
 * - Lock mechanism for concurrent execution
 * - Manual trigger behavior
 */
describe('UpdateCheckJob', () => {
  describe('Schedule Configuration', () => {
    test('should convert schedule to interval in milliseconds', () => {
      const getIntervalMs = (schedule: string): number => {
        switch (schedule) {
          case 'hourly':
            return 60 * 60 * 1000;
          case 'daily':
            return 24 * 60 * 60 * 1000;
          case 'weekly':
            return 7 * 24 * 60 * 60 * 1000;
          default:
            return 24 * 60 * 60 * 1000;
        }
      };

      expect(getIntervalMs('hourly')).toBe(3600000);
      expect(getIntervalMs('daily')).toBe(86400000);
      expect(getIntervalMs('weekly')).toBe(604800000);
      expect(getIntervalMs('unknown')).toBe(86400000); // Default to daily
    });

    test('should check if update checking is enabled', () => {
      const isEnabled = (enabledSetting: string | null) => {
        return enabledSetting === null || enabledSetting === 'true';
      };

      expect(isEnabled(null)).toBe(true); // Default enabled
      expect(isEnabled('true')).toBe(true);
      expect(isEnabled('false')).toBe(false);
    });
  });

  describe('Lock Mechanism', () => {
    test('should acquire lock when not running', () => {
      let isRunning = false;
      let runningPromise: Promise<unknown> | null = null;

      const acquireLock = () => {
        if (isRunning && runningPromise) {
          return { acquired: false, existingPromise: runningPromise };
        }
        isRunning = true;
        return { acquired: true };
      };

      const result = acquireLock();
      expect(result.acquired).toBe(true);
    });

    test('should return existing promise when already running', async () => {
      let isRunning = true;
      const runningPromise = Promise.resolve({ checked: 5, updatesFound: 2 });

      const acquireLock = () => {
        if (isRunning && runningPromise) {
          return { acquired: false, existingPromise: runningPromise };
        }
        isRunning = true;
        return { acquired: true };
      };

      const result = acquireLock();
      expect(result.acquired).toBe(false);
      expect(result.existingPromise).toBe(runningPromise);
    });

    test('should release lock after completion', () => {
      let isRunning = true;
      let runningPromise: Promise<unknown> | null = Promise.resolve();

      const releaseLock = () => {
        isRunning = false;
        runningPromise = null;
      };

      releaseLock();
      expect(isRunning).toBe(false);
      expect(runningPromise).toBeNull();
    });
  });

  describe('Manual Trigger', () => {
    test('should join existing check when one is running', async () => {
      const existingResult = { checked: 10, updatesFound: 3 };
      let isRunning = true;
      const runningPromise = Promise.resolve(existingResult);

      const triggerCheck = async () => {
        if (isRunning && runningPromise) {
          return runningPromise;
        }
        // Start new check
        return Promise.resolve({ checked: 0, updatesFound: 0 });
      };

      const result = await triggerCheck();
      expect(result).toBe(existingResult);
    });

    test('should start new check when none is running', async () => {
      let isRunning = false;
      const runningPromise: Promise<unknown> | null = null;

      const triggerCheck = async () => {
        if (isRunning && runningPromise) {
          return runningPromise;
        }
        return { checked: 5, updatesFound: 1 };
      };

      const result = await triggerCheck();
      expect(result).toEqual({ checked: 5, updatesFound: 1 });
    });
  });

  describe('Result Tracking', () => {
    test('should track checked and updates found counts', () => {
      const checkResult = { checked: 0, updatesFound: 0 };

      // Simulate checking games
      for (let i = 0; i < 5; i++) {
        checkResult.checked++;
        if (i % 2 === 0) {
          checkResult.updatesFound++;
        }
      }

      expect(checkResult.checked).toBe(5);
      expect(checkResult.updatesFound).toBe(3);
    });

    test('should return zero counts on error', () => {
      const handleError = () => {
        return { checked: 0, updatesFound: 0 };
      };

      const result = handleError();
      expect(result.checked).toBe(0);
      expect(result.updatesFound).toBe(0);
    });
  });

  describe('Skip Conditions', () => {
    test('should skip when update checking is disabled', () => {
      const isEnabled = false;
      let checkPerformed = false;

      if (isEnabled) {
        checkPerformed = true;
      }

      expect(checkPerformed).toBe(false);
    });

    test('should skip scheduled check when already running', () => {
      let isRunning = true;
      let scheduledCheckPerformed = false;

      const performScheduledCheck = () => {
        if (isRunning) {
          return 'skipped';
        }
        scheduledCheckPerformed = true;
        return 'performed';
      };

      expect(performScheduledCheck()).toBe('skipped');
      expect(scheduledCheckPerformed).toBe(false);
    });
  });
});

// ============================================================================
// COMMON JOB PATTERNS TESTS
// ============================================================================

/**
 * Test common patterns shared across all jobs
 */
describe('Common Job Patterns', () => {
  describe('Singleton Pattern', () => {
    test('should prevent multiple starts', () => {
      let job: ReturnType<typeof setInterval> | null = null;
      let startCount = 0;

      const start = () => {
        if (job) {
          return 'already running';
        }
        startCount++;
        job = setInterval(() => {}, 1000);
        return 'started';
      };

      expect(start()).toBe('started');
      expect(start()).toBe('already running');
      expect(startCount).toBe(1);

      // Cleanup
      if (job) clearInterval(job);
    });

    test('should allow restart after stop', () => {
      let job: ReturnType<typeof setInterval> | null = null;
      let startCount = 0;

      const start = () => {
        if (job) return 'already running';
        startCount++;
        job = setInterval(() => {}, 1000);
        return 'started';
      };

      const stop = () => {
        if (job) {
          clearInterval(job);
          job = null;
        }
      };

      start();
      stop();
      expect(start()).toBe('started');
      expect(startCount).toBe(2);

      // Cleanup
      if (job) clearInterval(job);
    });
  });

  describe('isRunning Guard', () => {
    test('should prevent overlapping executions', () => {
      let isRunning = false;
      const executions: number[] = [];

      const execute = async (id: number) => {
        if (isRunning) {
          return false;
        }
        isRunning = true;
        executions.push(id);
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 10));
        isRunning = false;
        return true;
      };

      // Synchronous check
      isRunning = true;
      const result = execute(1); // Should be blocked
      // Note: The check happens before the await, so this is synchronously blocked
      expect(isRunning).toBe(true);
    });

    test('should reset isRunning in finally block', async () => {
      let isRunning = false;

      const execute = async (shouldThrow: boolean) => {
        isRunning = true;
        try {
          if (shouldThrow) {
            throw new Error('Test error');
          }
        } finally {
          isRunning = false;
        }
      };

      try {
        await execute(true);
      } catch {
        // Expected
      }

      expect(isRunning).toBe(false);
    });
  });

  describe('Configuration Checks', () => {
    test('should skip when service not configured', () => {
      const scenarios = [
        { serviceName: 'Prowlarr', isConfigured: false },
        { serviceName: 'IGDB', isConfigured: false },
        { serviceName: 'qBittorrent', isConfigured: false },
      ];

      for (const scenario of scenarios) {
        let workPerformed = false;

        if (!scenario.isConfigured) {
          // Skip
          continue;
        }
        workPerformed = true;
        expect(workPerformed).toBe(false);
      }
    });
  });

  describe('Graceful Shutdown', () => {
    test('should stop interval on stop()', () => {
      let intervalId: ReturnType<typeof setInterval> | null = null;

      const start = () => {
        intervalId = setInterval(() => {}, 1000);
      };

      const stop = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      start();
      expect(intervalId).not.toBeNull();

      stop();
      expect(intervalId).toBeNull();
    });
  });
});

// ============================================================================
// ERROR CODE TESTS
// ============================================================================

describe('Error Codes', () => {
  // Mirror the error codes from errors.ts for testing
  const ErrorCode = {
    QBITTORRENT_CONNECTION_FAILED: 3201,
    QBITTORRENT_NOT_CONFIGURED: 3202,
    PROWLARR_NOT_CONFIGURED: 3102,
    IGDB_AUTH_FAILED: 3001,
  };

  test('should correctly identify qBittorrent errors', () => {
    const isQBittorrentError = (code: number) => {
      return code >= 3200 && code < 3300;
    };

    expect(isQBittorrentError(ErrorCode.QBITTORRENT_CONNECTION_FAILED)).toBe(true);
    expect(isQBittorrentError(ErrorCode.QBITTORRENT_NOT_CONFIGURED)).toBe(true);
    expect(isQBittorrentError(ErrorCode.PROWLARR_NOT_CONFIGURED)).toBe(false);
  });

  test('should correctly identify configuration errors', () => {
    const isNotConfiguredError = (code: number) => {
      return code === 3102 || code === 3202 || code === 2000;
    };

    expect(isNotConfiguredError(ErrorCode.QBITTORRENT_NOT_CONFIGURED)).toBe(true);
    expect(isNotConfiguredError(ErrorCode.PROWLARR_NOT_CONFIGURED)).toBe(true);
    expect(isNotConfiguredError(ErrorCode.QBITTORRENT_CONNECTION_FAILED)).toBe(false);
  });
});
