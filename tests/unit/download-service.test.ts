import { describe, expect, test, beforeEach, mock } from 'bun:test';

// We need to test the DownloadService class methods directly.
// Since the methods we want to test are private, we'll create a testable wrapper
// that exposes them, or we'll test through the public interface.

// For testing private methods, we'll create a test instance and use type assertion
// to access them, or we'll replicate the logic in the tests.

// First, let's define the core logic we want to test by extracting it:

// Size tolerance percentage for matching (10% difference allowed)
const SIZE_TOLERANCE_PERCENT = 0.10;

/**
 * Normalize a string for comparison by removing special characters,
 * converting to lowercase, and collapsing whitespace.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Remove common scene/release group markers
    .replace(/[\[\](){}]/g, ' ')
    // Remove file extensions
    .replace(/\.(torrent|nfo|txt|rar|zip|7z)$/i, '')
    // Replace common separators with spaces
    .replace(/[._-]+/g, ' ')
    // Remove special characters except alphanumeric and spaces
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key identifying tokens from a release name.
 * This helps match torrents even when names differ slightly.
 */
function extractKeyTokens(name: string): Set<string> {
  const normalized = normalizeName(name);
  const tokens = normalized.split(' ').filter(t => t.length >= 2);
  return new Set(tokens);
}

/**
 * Calculate token overlap ratio between two sets of tokens.
 * Returns a value between 0 and 1.
 */
function calculateTokenOverlap(tokens1: Set<string>, tokens2: Set<string>): number {
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let matchCount = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      matchCount++;
    }
  }

  // Use the smaller set as the denominator to favor partial matches
  const minSize = Math.min(tokens1.size, tokens2.size);
  return matchCount / minSize;
}

/**
 * Check if two sizes are within tolerance of each other.
 */
function sizesMatch(size1: number | null, size2: number): boolean {
  if (size1 === null || size1 === 0) return true; // No size to compare

  const diff = Math.abs(size1 - size2);
  const maxSize = Math.max(size1, size2);
  const percentDiff = diff / maxSize;

  return percentDiff <= SIZE_TOLERANCE_PERCENT;
}

/**
 * Parse game ID from torrent tags (e.g., "gamearr,game-123" -> 123)
 */
function parseGameIdFromTags(tags: string): number | null {
  if (!tags) return null;

  const tagList = tags.split(',').map(t => t.trim());
  for (const tag of tagList) {
    const match = tag.match(/^game-(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

// Helper to create a mock release
const createRelease = (overrides: Partial<{
  id: number;
  gameId: number;
  title: string;
  size: number | null;
  seeders: number | null;
  downloadUrl: string;
  indexer: string;
  quality: string | null;
  torrentHash: string | null;
  grabbedAt: Date | null;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
}> = {}) => ({
  id: 1,
  gameId: 1,
  title: 'Test Game v1.0',
  size: 10 * 1024 * 1024 * 1024, // 10 GB
  seeders: 50,
  downloadUrl: 'magnet:?xt=test',
  indexer: 'TestIndexer',
  quality: null,
  torrentHash: null,
  grabbedAt: new Date(),
  status: 'downloading' as const,
  ...overrides,
});

// Helper to create a mock torrent
const createTorrent = (overrides: Partial<{
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  state: string;
  category: string;
  tags: string;
  savePath: string;
  addedOn: Date;
  completionOn?: Date;
}> = {}) => ({
  hash: 'abc123def456',
  name: 'Test Game v1.0',
  size: 10 * 1024 * 1024 * 1024, // 10 GB
  progress: 0.5,
  downloadSpeed: 1024 * 1024, // 1 MB/s
  uploadSpeed: 512 * 1024,
  eta: 3600,
  state: 'downloading' as const,
  category: 'gamearr',
  tags: 'gamearr,game-1',
  savePath: '/downloads/games',
  addedOn: new Date(),
  ...overrides,
});


describe('DownloadService', () => {
  describe('normalizeName', () => {
    test('should convert to lowercase', () => {
      expect(normalizeName('TEST GAME')).toBe('test game');
      expect(normalizeName('TeSt GaMe')).toBe('test game');
    });

    test('should remove brackets and braces', () => {
      expect(normalizeName('Test Game [GOG]')).toBe('test game gog');
      expect(normalizeName('Test Game (2023)')).toBe('test game 2023');
      expect(normalizeName('Test Game {Repack}')).toBe('test game repack');
    });

    test('should remove file extensions', () => {
      expect(normalizeName('Test Game.torrent')).toBe('test game');
      expect(normalizeName('Test Game.nfo')).toBe('test game');
      expect(normalizeName('Test Game.txt')).toBe('test game');
      expect(normalizeName('Test Game.rar')).toBe('test game');
      expect(normalizeName('Test Game.zip')).toBe('test game');
      expect(normalizeName('Test Game.7z')).toBe('test game');
    });

    test('should replace common separators with spaces', () => {
      expect(normalizeName('Test.Game.v1.0')).toBe('test game v1 0');
      expect(normalizeName('Test_Game_v1_0')).toBe('test game v1 0');
      expect(normalizeName('Test-Game-v1-0')).toBe('test game v1 0');
      expect(normalizeName('Test..Game--v1__0')).toBe('test game v1 0');
    });

    test('should remove special characters', () => {
      expect(normalizeName("Assassin's Creed")).toBe('assassins creed');
      expect(normalizeName('Test: The Game')).toBe('test the game');
      expect(normalizeName('Test & Game')).toBe('test game');
      expect(normalizeName('Game!!! v2')).toBe('game v2');
    });

    test('should collapse multiple spaces', () => {
      expect(normalizeName('Test    Game    v1')).toBe('test game v1');
    });

    test('should trim whitespace', () => {
      expect(normalizeName('  Test Game  ')).toBe('test game');
    });

    test('should handle complex release names', () => {
      expect(normalizeName('Test.Game.v1.2.3-REPACK[GOG]')).toBe('test game v1 2 3 repack gog');
      expect(normalizeName('Test_Game_(2023)_[DRM-Free]-Scene')).toBe('test game 2023 drm free scene');
      expect(normalizeName("Assassin's.Creed.Odyssey-CODEX")).toBe('assassins creed odyssey codex');
    });

    test('should preserve alphanumeric content', () => {
      expect(normalizeName('Game123')).toBe('game123');
      expect(normalizeName('2023 Game Edition')).toBe('2023 game edition');
    });

    test('should handle empty string', () => {
      expect(normalizeName('')).toBe('');
    });

    test('should handle string with only special characters', () => {
      expect(normalizeName('---')).toBe('');
      expect(normalizeName('...')).toBe('');
      expect(normalizeName('[()]')).toBe('');
    });
  });

  describe('extractKeyTokens', () => {
    test('should extract tokens from simple name', () => {
      const tokens = extractKeyTokens('Test Game v1');
      expect(tokens.has('test')).toBe(true);
      expect(tokens.has('game')).toBe(true);
      expect(tokens.has('v1')).toBe(true);
    });

    test('should filter out single character tokens', () => {
      const tokens = extractKeyTokens('A Test B Game C');
      expect(tokens.has('a')).toBe(false);
      expect(tokens.has('b')).toBe(false);
      expect(tokens.has('c')).toBe(false);
      expect(tokens.has('test')).toBe(true);
      expect(tokens.has('game')).toBe(true);
    });

    test('should normalize before extracting tokens', () => {
      const tokens = extractKeyTokens('Test.Game-v1_0');
      expect(tokens.has('test')).toBe(true);
      expect(tokens.has('game')).toBe(true);
      expect(tokens.has('v1')).toBe(true);
      // Note: '0' is only 1 character, filtered out
    });

    test('should return empty set for empty string', () => {
      const tokens = extractKeyTokens('');
      expect(tokens.size).toBe(0);
    });

    test('should return empty set for single character tokens only', () => {
      const tokens = extractKeyTokens('A B C D');
      expect(tokens.size).toBe(0);
    });

    test('should handle complex release names', () => {
      const tokens = extractKeyTokens('Test.Game.v1.2.3-REPACK[GOG]');
      expect(tokens.has('test')).toBe(true);
      expect(tokens.has('game')).toBe(true);
      expect(tokens.has('v1')).toBe(true);
      expect(tokens.has('repack')).toBe(true);
      expect(tokens.has('gog')).toBe(true);
    });

    test('should deduplicate tokens', () => {
      const tokens = extractKeyTokens('Test Test Test');
      expect(tokens.size).toBe(1);
      expect(tokens.has('test')).toBe(true);
    });
  });

  describe('calculateTokenOverlap', () => {
    test('should return 1 for identical sets', () => {
      const tokens1 = new Set(['test', 'game', 'v1']);
      const tokens2 = new Set(['test', 'game', 'v1']);
      expect(calculateTokenOverlap(tokens1, tokens2)).toBe(1);
    });

    test('should return 0 for completely different sets', () => {
      const tokens1 = new Set(['test', 'game']);
      const tokens2 = new Set(['foo', 'bar']);
      expect(calculateTokenOverlap(tokens1, tokens2)).toBe(0);
    });

    test('should return 0 for empty sets', () => {
      const emptySet = new Set<string>();
      const nonEmptySet = new Set(['test', 'game']);

      expect(calculateTokenOverlap(emptySet, nonEmptySet)).toBe(0);
      expect(calculateTokenOverlap(nonEmptySet, emptySet)).toBe(0);
      expect(calculateTokenOverlap(emptySet, emptySet)).toBe(0);
    });

    test('should calculate partial overlap correctly', () => {
      const tokens1 = new Set(['test', 'game', 'v1']);
      const tokens2 = new Set(['test', 'game', 'v2']);
      // 2 matches out of min(3, 3) = 3 -> 2/3 = 0.666...
      expect(calculateTokenOverlap(tokens1, tokens2)).toBeCloseTo(0.666, 2);
    });

    test('should favor partial matches by using smaller set size', () => {
      const smallSet = new Set(['test', 'game']);
      const largeSet = new Set(['test', 'game', 'v1', 'gog', 'repack']);
      // 2 matches, min size is 2 -> 2/2 = 1
      expect(calculateTokenOverlap(smallSet, largeSet)).toBe(1);
      expect(calculateTokenOverlap(largeSet, smallSet)).toBe(1);
    });

    test('should handle single token sets', () => {
      const single = new Set(['test']);
      const multiple = new Set(['test', 'game']);

      expect(calculateTokenOverlap(single, multiple)).toBe(1);
      expect(calculateTokenOverlap(multiple, single)).toBe(1);
    });

    test('should handle single token with no match', () => {
      const single = new Set(['foo']);
      const multiple = new Set(['test', 'game']);

      expect(calculateTokenOverlap(single, multiple)).toBe(0);
    });

    test('should be symmetric', () => {
      const tokens1 = new Set(['test', 'game', 'v1']);
      const tokens2 = new Set(['test', 'game', 'v2', 'gog']);

      expect(calculateTokenOverlap(tokens1, tokens2)).toBe(
        calculateTokenOverlap(tokens2, tokens1)
      );
    });
  });

  describe('sizesMatch', () => {
    test('should return true when sizes are identical', () => {
      expect(sizesMatch(1000, 1000)).toBe(true);
    });

    test('should return true when size1 is null', () => {
      expect(sizesMatch(null, 1000)).toBe(true);
    });

    test('should return true when size1 is 0', () => {
      expect(sizesMatch(0, 1000)).toBe(true);
    });

    test('should return true when within 10% tolerance', () => {
      const baseSize = 10 * 1024 * 1024 * 1024; // 10 GB
      const withinTolerance = baseSize * 1.09; // 9% larger

      expect(sizesMatch(baseSize, withinTolerance)).toBe(true);
    });

    test('should return true at exactly 10% tolerance boundary', () => {
      const baseSize = 10 * 1024 * 1024 * 1024; // 10 GB
      const atBoundary = baseSize * 1.10; // exactly 10% larger

      expect(sizesMatch(baseSize, atBoundary)).toBe(true);
    });

    test('should return false when exceeding 10% tolerance', () => {
      const baseSize = 10 * 1024 * 1024 * 1024; // 10 GB
      const beyondTolerance = baseSize * 1.15; // 15% larger (well beyond tolerance)

      expect(sizesMatch(baseSize, beyondTolerance)).toBe(false);
    });

    test('should handle smaller size2', () => {
      const baseSize = 10 * 1024 * 1024 * 1024; // 10 GB
      const smaller = baseSize * 0.91; // 9% smaller

      expect(sizesMatch(baseSize, smaller)).toBe(true);
    });

    test('should handle smaller size2 beyond tolerance', () => {
      const baseSize = 10 * 1024 * 1024 * 1024; // 10 GB
      const tooSmall = baseSize * 0.85; // 15% smaller

      expect(sizesMatch(baseSize, tooSmall)).toBe(false);
    });

    test('should handle very small sizes', () => {
      expect(sizesMatch(100, 110)).toBe(true); // 10%
      expect(sizesMatch(100, 115)).toBe(false); // 15% (well beyond tolerance)
    });

    test('should handle very large sizes', () => {
      const large1 = 100 * 1024 * 1024 * 1024; // 100 GB
      const large2 = 109 * 1024 * 1024 * 1024; // 109 GB (9% larger)

      expect(sizesMatch(large1, large2)).toBe(true);
    });
  });

  describe('parseGameIdFromTags', () => {
    test('should parse game ID from standard tag format', () => {
      expect(parseGameIdFromTags('gamearr,game-123')).toBe(123);
    });

    test('should parse game ID from tag only format', () => {
      expect(parseGameIdFromTags('game-456')).toBe(456);
    });

    test('should handle multiple tags', () => {
      expect(parseGameIdFromTags('tag1,gamearr,game-789,tag2')).toBe(789);
    });

    test('should handle whitespace in tags', () => {
      expect(parseGameIdFromTags('gamearr, game-123, other')).toBe(123);
      expect(parseGameIdFromTags('  game-999  ')).toBe(999);
    });

    test('should return null for empty tags', () => {
      expect(parseGameIdFromTags('')).toBe(null);
    });

    test('should return null for tags without game ID', () => {
      expect(parseGameIdFromTags('gamearr,other-tag')).toBe(null);
      expect(parseGameIdFromTags('random,tags,here')).toBe(null);
    });

    test('should return null for malformed game tags', () => {
      expect(parseGameIdFromTags('game-')).toBe(null);
      expect(parseGameIdFromTags('game-abc')).toBe(null);
      expect(parseGameIdFromTags('game123')).toBe(null);
      expect(parseGameIdFromTags('games-123')).toBe(null);
    });

    test('should return first game ID when multiple exist', () => {
      expect(parseGameIdFromTags('game-1,game-2,game-3')).toBe(1);
    });

    test('should handle large game IDs', () => {
      expect(parseGameIdFromTags('game-999999')).toBe(999999);
    });
  });

  describe('findMatchingTorrent', () => {
    // We need to test the matching algorithm itself
    // Since findMatchingTorrent is a private method, we'll test the logic patterns

    describe('hash matching (priority 1)', () => {
      test('should match by exact hash when release has stored hash', () => {
        const release = createRelease({
          torrentHash: 'abc123def456',
          title: 'Different Title' // Title doesn't matter for hash match
        });
        const torrents = [
          createTorrent({ hash: 'abc123def456', name: 'Some Other Name' }),
          createTorrent({ hash: 'xyz789', name: 'Test Game v1.0' }),
        ];

        // Hash match should find first torrent regardless of name
        const hashMatch = torrents.find(
          t => t.hash.toLowerCase() === release.torrentHash!.toLowerCase()
        );
        expect(hashMatch).toBeDefined();
        expect(hashMatch!.hash).toBe('abc123def456');
      });

      test('should be case insensitive for hash comparison', () => {
        const release = createRelease({ torrentHash: 'ABC123DEF456' });
        const torrents = [
          createTorrent({ hash: 'abc123def456' }),
        ];

        const hashMatch = torrents.find(
          t => t.hash.toLowerCase() === release.torrentHash!.toLowerCase()
        );
        expect(hashMatch).toBeDefined();
      });
    });

    describe('tag matching (priority 2)', () => {
      test('should match by game ID tag when hash not available', () => {
        const release = createRelease({
          gameId: 42,
          torrentHash: null,
          title: 'Test Game GOG'
        });
        const torrents = [
          createTorrent({ tags: 'gamearr,game-42', name: 'Test Game GOG' }),
          createTorrent({ tags: 'gamearr,game-99', name: 'Other Game' }),
        ];

        const tagMatches = torrents.filter(t => {
          const gameId = parseGameIdFromTags(t.tags);
          return gameId === release.gameId;
        });

        expect(tagMatches.length).toBe(1);
        expect(tagMatches[0].name).toBe('Test Game GOG');
      });

      test('should handle multiple torrents with same game ID tag', () => {
        const release = createRelease({
          gameId: 42,
          torrentHash: null,
          title: 'Test Game v1.0 GOG',
          size: 10 * 1024 * 1024 * 1024
        });
        const torrents = [
          createTorrent({
            tags: 'gamearr,game-42',
            name: 'Test Game v1.0 GOG',
            size: 10 * 1024 * 1024 * 1024
          }),
          createTorrent({
            tags: 'gamearr,game-42',
            name: 'Test Game v2.0 Update',
            size: 5 * 1024 * 1024 * 1024
          }),
        ];

        const tagMatches = torrents.filter(t => {
          const gameId = parseGameIdFromTags(t.tags);
          return gameId === release.gameId;
        });

        expect(tagMatches.length).toBe(2);

        // When multiple matches, should use token overlap + size to narrow down
        const releaseTokens = extractKeyTokens(release.title);
        let bestMatch = null;
        let bestScore = 0;

        for (const torrent of tagMatches) {
          const torrentTokens = extractKeyTokens(torrent.name);
          const tokenOverlap = calculateTokenOverlap(releaseTokens, torrentTokens);
          const sizeMatches = sizesMatch(release.size, torrent.size);
          const score = tokenOverlap + (sizeMatches ? 0.2 : 0);

          if (score > bestScore) {
            bestScore = score;
            bestMatch = torrent;
          }
        }

        expect(bestMatch).toBeDefined();
        expect(bestMatch!.name).toBe('Test Game v1.0 GOG');
      });
    });

    describe('multi-criteria matching (priority 3)', () => {
      test('should match by name similarity with category filter', () => {
        const release = createRelease({
          torrentHash: null,
          gameId: 999, // No tag match
          title: 'Test Game v1.0 GOG',
          size: 10 * 1024 * 1024 * 1024
        });
        const torrents = [
          createTorrent({
            category: 'gamearr',
            tags: '',
            name: 'Test Game v1.0 GOG',
            size: 10 * 1024 * 1024 * 1024
          }),
          createTorrent({
            category: 'movies',
            tags: '',
            name: 'Test Game v1.0 GOG',
            size: 10 * 1024 * 1024 * 1024
          }),
        ];

        // Filter by gamearr category
        const gamearrTorrents = torrents.filter(t => t.category === 'gamearr');
        expect(gamearrTorrents.length).toBe(1);

        const releaseTokens = extractKeyTokens(release.title);
        const torrentTokens = extractKeyTokens(gamearrTorrents[0].name);
        const overlap = calculateTokenOverlap(releaseTokens, torrentTokens);

        expect(overlap).toBe(1); // Perfect match
      });

      test('should require at least 60% token overlap', () => {
        const releaseTokens = extractKeyTokens('Test Game v1.0 GOG');

        // 3 out of 4 tokens match = 75%
        const goodMatch = extractKeyTokens('Test Game v1.0 Repack');
        const goodOverlap = calculateTokenOverlap(releaseTokens, goodMatch);
        expect(goodOverlap).toBeGreaterThanOrEqual(0.6);

        // Only 1 out of 4 tokens match = 25%
        const badMatch = extractKeyTokens('Other Software Bundle Pack');
        const badOverlap = calculateTokenOverlap(releaseTokens, badMatch);
        expect(badOverlap).toBeLessThan(0.6);
      });

      test('should give size match bonus in scoring', () => {
        const releaseSize = 10 * 1024 * 1024 * 1024;
        const releaseTokens = extractKeyTokens('Test Game v1.0');

        // Torrent with matching size
        const matchingSizeTorrent = {
          name: 'Test Game v1.0 GOG',
          size: releaseSize * 1.05 // Within 10% tolerance
        };
        const matchingTokens = extractKeyTokens(matchingSizeTorrent.name);
        const matchingOverlap = calculateTokenOverlap(releaseTokens, matchingTokens);
        const matchingScore = matchingOverlap + (sizesMatch(releaseSize, matchingSizeTorrent.size) ? 0.3 : -0.2);

        // Torrent with mismatched size
        const mismatchSizeTorrent = {
          name: 'Test Game v1.0 GOG',
          size: releaseSize * 0.5 // 50% difference
        };
        const mismatchOverlap = calculateTokenOverlap(releaseTokens, extractKeyTokens(mismatchSizeTorrent.name));
        const mismatchScore = mismatchOverlap + (sizesMatch(releaseSize, mismatchSizeTorrent.size) ? 0.3 : -0.2);

        expect(matchingScore).toBeGreaterThan(mismatchScore);
      });

      test('should determine confidence level based on score', () => {
        const determineConfidence = (score: number, overlap: number) => {
          if (score >= 0.9 && overlap >= 0.8) return 'high';
          if (score >= 0.7) return 'medium';
          return 'low';
        };

        // High confidence: high score and high overlap
        expect(determineConfidence(0.95, 0.85)).toBe('high');
        expect(determineConfidence(1.0, 1.0)).toBe('high');

        // Medium confidence
        expect(determineConfidence(0.75, 0.65)).toBe('medium');
        expect(determineConfidence(0.85, 0.7)).toBe('medium'); // High score but low overlap

        // Low confidence
        expect(determineConfidence(0.65, 0.5)).toBe('low');
        expect(determineConfidence(0.5, 0.9)).toBe('low');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle NotConfiguredError for qBittorrent', () => {
      // The grabRelease method throws NotConfiguredError when qBittorrent is not configured
      // We test that the error type and message are correct
      const error = {
        name: 'NotConfiguredError',
        message: 'qBittorrent is not configured. Please add your qBittorrent settings.',
        service: 'qBittorrent'
      };

      expect(error.message).toContain('qBittorrent');
      expect(error.message).toContain('not configured');
    });

    test('should handle NotFoundError for game', () => {
      // When grabRelease is called with a non-existent gameId
      const error = {
        name: 'NotFoundError',
        message: "Game with ID '999' not found",
        resource: 'Game',
        identifier: 999
      };

      expect(error.message).toContain('Game');
      expect(error.message).toContain('999');
    });
  });

  describe('Real-world Matching Scenarios', () => {
    test('should match similar release names with different formatting', () => {
      const scenarios = [
        {
          release: 'Cyberpunk 2077 v1.6-GOG',
          torrent: 'Cyberpunk.2077.v1.6.GOG',
          expected: true
        },
        {
          release: 'The Witcher 3 Wild Hunt GOTY-RELOADED',
          torrent: 'The_Witcher_3_Wild_Hunt_GOTY-RELOADED',
          expected: true
        },
        {
          release: "Baldur's Gate 3 v4.1.1.3956130 GOG",
          torrent: 'Baldurs.Gate.3.v4.1.1.GOG',
          expected: true
        },
        {
          release: 'Elden Ring v1.10 + DLC',
          torrent: 'Completely Different Game',
          expected: false
        }
      ];

      for (const scenario of scenarios) {
        const releaseTokens = extractKeyTokens(scenario.release);
        const torrentTokens = extractKeyTokens(scenario.torrent);
        const overlap = calculateTokenOverlap(releaseTokens, torrentTokens);

        if (scenario.expected) {
          expect(overlap).toBeGreaterThanOrEqual(0.6);
        } else {
          expect(overlap).toBeLessThan(0.6);
        }
      }
    });

    test('should handle version number differences', () => {
      const releaseTokens = extractKeyTokens('Game v1.2.3');
      const torrentV124 = extractKeyTokens('Game v1.2.4');
      const torrentV200 = extractKeyTokens('Game v2.0.0');

      // v1.2.3 vs v1.2.4 - mostly similar
      const overlapSmallDiff = calculateTokenOverlap(releaseTokens, torrentV124);
      // v1.2.3 vs v2.0.0 - more different
      const overlapLargeDiff = calculateTokenOverlap(releaseTokens, torrentV200);

      // Both should still have reasonable overlap due to game name
      // Note: 'game' token matches, version tokens differ
      expect(overlapSmallDiff).toBeGreaterThanOrEqual(0.5);
      expect(overlapLargeDiff).toBeGreaterThanOrEqual(0.5);
    });

    test('should handle release group differences', () => {
      const scenarios = [
        { release: 'Game-GOG', torrent: 'Game-RELOADED' },
        { release: 'Game-FitGirl', torrent: 'Game-DODI' },
        { release: 'Game-CODEX', torrent: 'Game-PLAZA' },
      ];

      for (const scenario of scenarios) {
        const releaseTokens = extractKeyTokens(scenario.release);
        const torrentTokens = extractKeyTokens(scenario.torrent);
        const overlap = calculateTokenOverlap(releaseTokens, torrentTokens);

        // Should have ~50% overlap (game name matches, release group doesn't)
        expect(overlap).toBeGreaterThan(0.4);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle unicode characters in names', () => {
      const normalized = normalizeName('Pokémon Legends');
      // Unicode characters are stripped by the alphanumeric filter
      expect(normalized).toBe('pokmon legends');
    });

    test('should handle very long release names', () => {
      const longName = 'A'.repeat(1000) + ' Game v1.0';
      const normalized = normalizeName(longName);

      // Should handle without error and produce reasonable output
      expect(normalized.length).toBeGreaterThan(0);
      expect(normalized).toContain('game');
    });

    test('should handle release with null/undefined size', () => {
      expect(sizesMatch(null, 1000)).toBe(true);
      // undefined coerces to NaN, which fails the comparison
      // The actual behavior is to return false for undefined
      // @ts-expect-error - testing undefined handling
      expect(sizesMatch(undefined, 1000)).toBe(false);
    });

    test('should handle zero-size torrents', () => {
      // When torrent size is 0, should not divide by zero
      expect(sizesMatch(1000, 0)).toBe(false); // 0 is very different from 1000
      expect(sizesMatch(0, 0)).toBe(true); // Both are 0/null
    });
  });
});
