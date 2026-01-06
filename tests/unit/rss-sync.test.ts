import { describe, expect, test } from 'bun:test';

// Test the matching logic used in RssSync
// These functions are extracted from RssSync for testing

/**
 * Normalize a title for matching
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '') // Remove apostrophes
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract quality from release title
 */
function extractQuality(title: string): string | undefined {
  const titleLower = title.toLowerCase();

  if (titleLower.includes('gog')) return 'GOG';
  if (titleLower.includes('drm free') || titleLower.includes('drm-free')) return 'DRM-Free';
  if (titleLower.includes('repack')) return 'Repack';
  if (titleLower.includes('scene')) return 'Scene';

  return undefined;
}

/**
 * Calculate match score between release and game
 */
function calculateMatchScore(
  releaseTitle: string,
  gameTitle: string,
  gameYear: number | null,
  seeders: number,
  size: number,
  publishedAt: Date
): { score: number; confidence: 'high' | 'medium' | 'low' } {
  let score = 100; // Base score
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  const normalizedRelease = normalizeTitle(releaseTitle);
  const normalizedGame = normalizeTitle(gameTitle);

  // Title matching
  if (normalizedRelease.includes(normalizedGame)) {
    score += 50;
    confidence = 'high';
  } else {
    const gameWords = normalizedGame.split(/\s+/).filter((w) => w.length > 2);
    const matchedWords = gameWords.filter((word) => normalizedRelease.includes(word));

    if (gameWords.length > 0 && matchedWords.length / gameWords.length >= 0.8) {
      score += 30;
      confidence = 'high';
    } else if (gameWords.length > 0 && matchedWords.length / gameWords.length >= 0.5) {
      score += 15;
    } else {
      score -= 60;
      confidence = 'low';
    }
  }

  // Year matching bonus
  if (gameYear && releaseTitle.toLowerCase().includes(gameYear.toString())) {
    score += 20;
  }

  // Quality preferences
  const quality = extractQuality(releaseTitle);
  if (quality === 'GOG') score += 50;
  else if (quality === 'DRM-Free') score += 40;
  else if (quality === 'Repack') score += 20;
  else if (quality === 'Scene') score += 10;

  // Seeders
  if (seeders < 5) score -= 30;
  else if (seeders >= 20) score += 10;

  // Age penalty
  const ageInYears = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (ageInYears > 2) score -= 20;

  // Size check
  const sizeInGB = size / (1024 * 1024 * 1024);
  if (sizeInGB < 0.1 || sizeInGB > 200) score -= 50;

  // Adjust confidence
  if (score >= 150) confidence = 'high';
  else if (score < 80) confidence = 'low';

  return { score, confidence };
}

describe('RssSync Title Normalization', () => {
  test('should convert to lowercase', () => {
    expect(normalizeTitle('DOOM Eternal')).toBe('doom eternal');
  });

  test('should remove apostrophes', () => {
    expect(normalizeTitle("Baldur's Gate")).toBe('baldurs gate');
    expect(normalizeTitle("Tony Hawk's Pro Skater")).toBe('tony hawks pro skater');
  });

  test('should replace special characters with spaces', () => {
    expect(normalizeTitle('Half-Life: Alyx')).toBe('half life alyx');
    expect(normalizeTitle('F.E.A.R.')).toBe('f e a r');
  });

  test('should normalize whitespace', () => {
    expect(normalizeTitle('  Game   Title  ')).toBe('game title');
  });

  test('should handle complex titles', () => {
    expect(normalizeTitle("Assassin's Creed: Valhalla - Ultimate Edition")).toBe(
      'assassins creed valhalla ultimate edition'
    );
  });
});

describe('RssSync Quality Extraction', () => {
  test('should identify GOG releases', () => {
    expect(extractQuality('Game.Name.GOG')).toBe('GOG');
    expect(extractQuality('Game Name (gog)')).toBe('GOG');
    expect(extractQuality('GameName-GOG-Rip')).toBe('GOG');
  });

  test('should identify DRM-Free releases', () => {
    expect(extractQuality('Game DRM-Free')).toBe('DRM-Free');
    expect(extractQuality('Game DRM Free Edition')).toBe('DRM-Free');
  });

  test('should identify Repack releases', () => {
    expect(extractQuality('Game-REPACK')).toBe('Repack');
    expect(extractQuality('Game Repack by Someone')).toBe('Repack');
  });

  test('should identify Scene releases', () => {
    expect(extractQuality('Game-SCENE')).toBe('Scene');
    expect(extractQuality('Game.Scene.Release')).toBe('Scene');
  });

  test('should return undefined for unknown quality', () => {
    expect(extractQuality('Game Name 2023')).toBeUndefined();
    expect(extractQuality('Just Some Release')).toBeUndefined();
  });

  test('should prioritize GOG over other qualities', () => {
    // GOG is checked first, so if a release has multiple markers, GOG wins
    expect(extractQuality('Game GOG Repack')).toBe('GOG');
  });
});

describe('RssSync Match Scoring', () => {
  const now = new Date();
  const defaultSize = 20 * 1024 * 1024 * 1024; // 20 GB

  describe('Title Matching', () => {
    test('should give high score for exact title match', () => {
      const result = calculateMatchScore(
        'Cyberpunk 2077 GOG',
        'Cyberpunk 2077',
        2020,
        50,
        defaultSize,
        now
      );

      expect(result.score).toBeGreaterThanOrEqual(150);
      expect(result.confidence).toBe('high');
    });

    test('should give lower score for partial match', () => {
      const result = calculateMatchScore(
        'Some Cyberpunk Game Collection 2077',
        'Cyberpunk 2077',
        2020,
        50,
        defaultSize,
        now
      );

      // Should still match "cyberpunk" and "2077"
      expect(result.score).toBeGreaterThan(80);
    });

    test('should give low score for poor match', () => {
      const result = calculateMatchScore(
        'Completely Different Game',
        'Cyberpunk 2077',
        2020,
        50,
        defaultSize,
        now
      );

      expect(result.score).toBeLessThan(100);
      expect(result.confidence).toBe('low');
    });
  });

  describe('Quality Bonuses', () => {
    test('should add 50 points for GOG', () => {
      const withGOG = calculateMatchScore('Test Game GOG', 'Test Game', null, 50, defaultSize, now);
      const withoutGOG = calculateMatchScore('Test Game', 'Test Game', null, 50, defaultSize, now);

      expect(withGOG.score - withoutGOG.score).toBe(50);
    });

    test('should add 40 points for DRM-Free', () => {
      const withDRMFree = calculateMatchScore(
        'Test Game DRM-Free',
        'Test Game',
        null,
        50,
        defaultSize,
        now
      );
      const withoutDRMFree = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        50,
        defaultSize,
        now
      );

      expect(withDRMFree.score - withoutDRMFree.score).toBe(40);
    });

    test('should add 20 points for Repack', () => {
      const withRepack = calculateMatchScore(
        'Test Game REPACK',
        'Test Game',
        null,
        50,
        defaultSize,
        now
      );
      const withoutRepack = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        50,
        defaultSize,
        now
      );

      expect(withRepack.score - withoutRepack.score).toBe(20);
    });
  });

  describe('Year Matching', () => {
    test('should add 20 points when year matches', () => {
      const withYear = calculateMatchScore(
        'Test Game 2023',
        'Test Game',
        2023,
        50,
        defaultSize,
        now
      );
      const withoutYear = calculateMatchScore(
        'Test Game',
        'Test Game',
        2023,
        50,
        defaultSize,
        now
      );

      expect(withYear.score - withoutYear.score).toBe(20);
    });

    test('should not crash with null year', () => {
      const result = calculateMatchScore('Test Game', 'Test Game', null, 50, defaultSize, now);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Seeder Impact', () => {
    test('should penalize low seeders', () => {
      const lowSeeders = calculateMatchScore('Test Game', 'Test Game', null, 2, defaultSize, now);
      const normalSeeders = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        10,
        defaultSize,
        now
      );

      expect(lowSeeders.score).toBeLessThan(normalSeeders.score);
      expect(normalSeeders.score - lowSeeders.score).toBe(30);
    });

    test('should bonus high seeders', () => {
      const normalSeeders = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        10,
        defaultSize,
        now
      );
      const highSeeders = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        25,
        defaultSize,
        now
      );

      expect(highSeeders.score).toBeGreaterThan(normalSeeders.score);
      expect(highSeeders.score - normalSeeders.score).toBe(10);
    });
  });

  describe('Size Validation', () => {
    test('should penalize too small releases', () => {
      const tooSmall = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        50,
        50 * 1024 * 1024, // 50 MB
        now
      );
      const normalSize = calculateMatchScore('Test Game', 'Test Game', null, 50, defaultSize, now);

      expect(tooSmall.score).toBeLessThan(normalSize.score);
      expect(normalSize.score - tooSmall.score).toBe(50);
    });

    test('should penalize too large releases', () => {
      const tooLarge = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        50,
        250 * 1024 * 1024 * 1024, // 250 GB
        now
      );
      const normalSize = calculateMatchScore('Test Game', 'Test Game', null, 50, defaultSize, now);

      expect(tooLarge.score).toBeLessThan(normalSize.score);
    });
  });

  describe('Age Impact', () => {
    test('should penalize old releases', () => {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

      const oldRelease = calculateMatchScore(
        'Test Game',
        'Test Game',
        null,
        50,
        defaultSize,
        threeYearsAgo
      );
      const newRelease = calculateMatchScore('Test Game', 'Test Game', null, 50, defaultSize, now);

      expect(oldRelease.score).toBeLessThan(newRelease.score);
      expect(newRelease.score - oldRelease.score).toBe(20);
    });
  });

  describe('Auto-grab Threshold', () => {
    test('should meet auto-grab criteria for good match', () => {
      const result = calculateMatchScore(
        'Elden Ring GOG',
        'Elden Ring',
        2022,
        30,
        defaultSize,
        now
      );

      const shouldAutoGrab = result.score >= 100 && 30 >= 5;
      expect(shouldAutoGrab).toBe(true);
    });

    test('should not auto-grab low confidence match', () => {
      const result = calculateMatchScore(
        'Random Unrelated Game',
        'Elden Ring',
        2022,
        30,
        defaultSize,
        now
      );

      expect(result.confidence).toBe('low');
      expect(result.score).toBeLessThan(100);
    });
  });
});

describe('RssSync Integration Scenarios', () => {
  test('should correctly score a typical GOG release', () => {
    const result = calculateMatchScore(
      'Baldurs.Gate.3.v4.1.1.GOG',
      "Baldur's Gate 3",
      2023,
      100,
      120 * 1024 * 1024 * 1024, // 120 GB
      new Date()
    );

    // Should be high score: title match, GOG bonus
    expect(result.score).toBeGreaterThanOrEqual(150);
    expect(result.confidence).toBe('high');
  });

  test('should correctly score a scene release', () => {
    const result = calculateMatchScore(
      'Cyberpunk.2077.v2.1-CODEX',
      'Cyberpunk 2077',
      2020,
      45,
      60 * 1024 * 1024 * 1024,
      new Date()
    );

    // Good match, scene release
    expect(result.score).toBeGreaterThanOrEqual(100);
  });

  test('should reject fake/mismatch releases', () => {
    const result = calculateMatchScore(
      'Free.Game.Download.2024.exe',
      'Elden Ring',
      2022,
      1,
      5 * 1024 * 1024, // Suspiciously small
      new Date()
    );

    expect(result.score).toBeLessThan(50);
    expect(result.confidence).toBe('low');
  });
});
