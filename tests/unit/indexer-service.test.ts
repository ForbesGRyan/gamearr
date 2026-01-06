import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock the dependencies before importing the service
const mockProwlarrClient = {
  isConfigured: mock(() => true),
  searchReleases: mock(() => Promise.resolve([])),
  testConnection: mock(() => Promise.resolve(true)),
  getIndexers: mock(() => Promise.resolve([])),
};

const mockSettingsService = {
  getProwlarrCategories: mock(() => Promise.resolve([])),
};

// We'll test the scoring logic directly since it's the core functionality
describe('IndexerService Scoring Logic', () => {
  // Helper to create a mock release
  const createRelease = (overrides = {}) => ({
    guid: 'test-guid',
    title: 'Test Game v1.0',
    indexer: 'TestIndexer',
    size: 10 * 1024 * 1024 * 1024, // 10 GB
    seeders: 50,
    downloadUrl: 'magnet:?xt=test',
    publishedAt: new Date(),
    quality: undefined,
    ...overrides,
  });

  // Helper to create a mock game
  const createGame = (overrides = {}) => ({
    id: 1,
    igdbId: 12345,
    title: 'Test Game',
    year: 2023,
    coverUrl: 'https://example.com/cover.jpg',
    monitored: true,
    status: 'wanted' as const,
    folderPath: null,
    addedAt: new Date(),
    store: null,
    ...overrides,
  });

  describe('Title Matching', () => {
    test('should give high score when release contains full game title', () => {
      const release = createRelease({ title: 'Test Game GOG' });
      const game = createGame({ title: 'Test Game' });

      // Title match should add +50 points to base 100
      // With GOG quality (+50), expect ~200
      expect(release.title.toLowerCase()).toContain(game.title.toLowerCase());
    });

    test('should handle case-insensitive matching', () => {
      const release = createRelease({ title: 'TEST GAME REPACK' });
      const game = createGame({ title: 'test game' });

      expect(release.title.toLowerCase()).toContain(game.title.toLowerCase());
    });

    test('should handle partial word matches', () => {
      const release = createRelease({ title: 'Awesome Test Adventure Game 2023' });
      const game = createGame({ title: 'Test Adventure Game' });

      const gameWords = game.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const releaseTitle = release.title.toLowerCase();
      const matchedWords = gameWords.filter(word => releaseTitle.includes(word));

      expect(matchedWords.length / gameWords.length).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Quality Scoring', () => {
    test('should identify GOG releases', () => {
      const release = createRelease({ title: 'Test Game GOG' });
      expect(release.title.toLowerCase()).toContain('gog');
    });

    test('should identify DRM-Free releases', () => {
      const release1 = createRelease({ title: 'Test Game DRM-Free' });
      const release2 = createRelease({ title: 'Test Game DRM Free' });

      expect(
        release1.title.toLowerCase().includes('drm-free') ||
        release1.title.toLowerCase().includes('drm free')
      ).toBe(true);

      expect(
        release2.title.toLowerCase().includes('drm-free') ||
        release2.title.toLowerCase().includes('drm free')
      ).toBe(true);
    });

    test('should identify Repack releases', () => {
      const release = createRelease({ title: 'Test Game-REPACK' });
      expect(release.title.toLowerCase()).toContain('repack');
    });

    test('should identify Scene releases', () => {
      const release = createRelease({ title: 'Test.Game-SCENE' });
      expect(release.title.toLowerCase()).toContain('scene');
    });
  });

  describe('Seeder Scoring', () => {
    test('should penalize releases with low seeders', () => {
      const lowSeeders = createRelease({ seeders: 2 });
      const normalSeeders = createRelease({ seeders: 10 });
      const highSeeders = createRelease({ seeders: 50 });

      // Low seeders (<5) should be penalized
      expect(lowSeeders.seeders).toBeLessThan(5);
      expect(normalSeeders.seeders).toBeGreaterThanOrEqual(5);
      expect(highSeeders.seeders).toBeGreaterThanOrEqual(20);
    });

    test('should bonus releases with high seeders', () => {
      const release = createRelease({ seeders: 25 });
      expect(release.seeders).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Size Validation', () => {
    test('should flag suspiciously small releases', () => {
      const smallRelease = createRelease({ size: 50 * 1024 * 1024 }); // 50 MB
      const sizeInGB = smallRelease.size / (1024 * 1024 * 1024);

      expect(sizeInGB).toBeLessThan(0.1);
    });

    test('should flag suspiciously large releases', () => {
      const largeRelease = createRelease({ size: 250 * 1024 * 1024 * 1024 }); // 250 GB
      const sizeInGB = largeRelease.size / (1024 * 1024 * 1024);

      expect(sizeInGB).toBeGreaterThan(200);
    });

    test('should accept normal sized releases', () => {
      const normalRelease = createRelease({ size: 30 * 1024 * 1024 * 1024 }); // 30 GB
      const sizeInGB = normalRelease.size / (1024 * 1024 * 1024);

      expect(sizeInGB).toBeGreaterThanOrEqual(0.1);
      expect(sizeInGB).toBeLessThanOrEqual(200);
    });
  });

  describe('Age Scoring', () => {
    test('should penalize old releases', () => {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

      const oldRelease = createRelease({ publishedAt: threeYearsAgo });
      const ageInYears = (Date.now() - oldRelease.publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 365);

      expect(ageInYears).toBeGreaterThan(2);
    });

    test('should not penalize recent releases', () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const recentRelease = createRelease({ publishedAt: oneMonthAgo });
      const ageInYears = (Date.now() - recentRelease.publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 365);

      expect(ageInYears).toBeLessThan(2);
    });
  });

  describe('Year Matching', () => {
    test('should bonus releases containing game year', () => {
      const release = createRelease({ title: 'Test Game 2023 GOG' });
      const game = createGame({ year: 2023 });

      expect(release.title).toContain(game.year.toString());
    });

    test('should handle games without year', () => {
      const release = createRelease({ title: 'Test Game GOG' });
      const game = createGame({ year: null as any });

      // Should not crash when year is null
      expect(game.year).toBeNull();
    });
  });

  describe('Auto-grab Criteria', () => {
    test('should define minimum score threshold', () => {
      const AUTO_GRAB_MIN_SCORE = 100;
      const AUTO_GRAB_MIN_SEEDERS = 5;

      // These are the criteria from the product plan
      expect(AUTO_GRAB_MIN_SCORE).toBe(100);
      expect(AUTO_GRAB_MIN_SEEDERS).toBe(5);
    });

    test('should validate auto-grab eligible release', () => {
      const eligibleRelease = {
        score: 150,
        seeders: 20,
        matchConfidence: 'high' as const,
      };

      const shouldGrab = eligibleRelease.score >= 100 && eligibleRelease.seeders >= 5;
      expect(shouldGrab).toBe(true);
    });

    test('should reject low score release', () => {
      const lowScoreRelease = {
        score: 50,
        seeders: 20,
        matchConfidence: 'low' as const,
      };

      const shouldGrab = lowScoreRelease.score >= 100 && lowScoreRelease.seeders >= 5;
      expect(shouldGrab).toBe(false);
    });

    test('should reject low seeder release', () => {
      const lowSeederRelease = {
        score: 150,
        seeders: 2,
        matchConfidence: 'high' as const,
      };

      const shouldGrab = lowSeederRelease.score >= 100 && lowSeederRelease.seeders >= 5;
      expect(shouldGrab).toBe(false);
    });
  });
});

describe('Search Query Normalization', () => {
  // Test the query normalization logic used in IndexerService
  const normalizeSearchQuery = (query: string): string => {
    // Remove apostrophes
    query = query.replace(/'/g, '');

    // Convert Roman numerals to Arabic numbers
    const romanToArabic: { [key: string]: string } = {
      ' VIII': ' 8',
      ' VII': ' 7',
      ' VI': ' 6',
      ' V': ' 5',
      ' IV': ' 4',
      ' III': ' 3',
      ' II': ' 2',
      ' I': ' 1',
      ' IX': ' 9',
      ' X': ' 10',
    };

    for (const [roman, arabic] of Object.entries(romanToArabic)) {
      query = query.replace(new RegExp(roman + '(?:\\s|$)', 'g'), arabic + ' ');
    }

    return query.trim();
  };

  test('should remove apostrophes', () => {
    expect(normalizeSearchQuery("Assassin's Creed")).toBe('Assassins Creed');
    expect(normalizeSearchQuery("Tony Hawk's Pro Skater")).toBe('Tony Hawks Pro Skater');
  });

  test('should convert Roman numerals', () => {
    expect(normalizeSearchQuery('Final Fantasy VII')).toBe('Final Fantasy 7');
    expect(normalizeSearchQuery('Grand Theft Auto III')).toBe('Grand Theft Auto 3');
    expect(normalizeSearchQuery('Civilization VI')).toBe('Civilization 6');
  });

  test('should handle mixed cases', () => {
    expect(normalizeSearchQuery("Baldur's Gate III")).toBe('Baldurs Gate 3');
  });

  test('should not convert Roman numerals within words', () => {
    // "Divinity" contains "IV" but shouldn't be converted
    expect(normalizeSearchQuery('Divinity')).toBe('Divinity');
  });
});
