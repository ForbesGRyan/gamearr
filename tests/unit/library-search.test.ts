import { describe, expect, test } from 'bun:test';

/**
 * Clean up scene release names and version info for better IGDB matching
 * This is a copy of the function from library.ts for testing
 */
function cleanSearchQuery(title: string): string {
  let cleaned = title;

  // Remove version numbers BEFORE normalizing dots to spaces
  // Patterns like .v1.0, .v2.3.1, .1.2.3.4567 (preceded by separator or space)
  cleaned = cleaned.replace(/[\s.\-_][vV]\d+(\.\d+)*/g, ' '); // v1, v1.0, v1.2.3
  cleaned = cleaned.replace(/[.\-_]\d+(\.\d+){1,}/g, ' '); // .1.2.3 style versions (must have at least 2 parts)

  // Now normalize separators to spaces
  cleaned = cleaned.replace(/[._-]/g, ' ');

  // Remove common scene group tags (case insensitive)
  const sceneGroups = [
    'CODEX', 'SKIDROW', 'PLAZA', 'RELOADED', 'PROPHET', 'CPY', 'HOODLUM',
    'STEAMPUNKS', 'GOLDBERG', 'FLT', 'RAZOR1911', 'TENOKE', 'DARKSiDERS',
    'RUNE', 'GOG', 'DODI', 'FitGirl', 'ElAmigos', 'CHRONOS', 'TiNYiSO',
    'I_KnoW', 'SiMPLEX', 'DINOByTES', 'ANOMALY', 'EMPRESS',
    'P2P', 'PROPER', 'INTERNAL', 'KaOs', 'Portable', 'x64', 'x86'
  ];

  // Remove scene groups
  sceneGroups.forEach((group) => {
    cleaned = cleaned.replace(new RegExp(`\\b${group}\\b`, 'gi'), ' ');
  });

  // Remove content in brackets (usually metadata)
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');

  // Remove any remaining version patterns after space normalization
  cleaned = cleaned.replace(/\b[vV]\d+\b/g, ' '); // Standalone v1, v2, etc.
  cleaned = cleaned.replace(/\b(build|patch|update|updated|hotfix)\s*\d*\b/gi, ' ');

  // Remove multi-word edition phrases FIRST (before single words)
  const editionPhrases = [
    'Game of the Year',
    "Director'?s Cut",
    'Directors? Cut',
    "Collector'?s Edition",
    'Collectors? Edition',
    'Limited Edition',
    'Special Edition',
    'Gold Edition',
    'Premium Edition',
    'Digital Edition',
    'Digital Deluxe',
    'Super Deluxe',
    'Complete Edition',
    'Definitive Edition',
    'Enhanced Edition',
    'Ultimate Edition',
    'Deluxe Edition',
    'Standard Edition',
    'Legendary Edition',
    'Base Game',
    'All DLCs?',
    'incl\\.?\\s*DLCs?',
    '\\+\\s*DLCs?',
    'with\\s+DLCs?',
    'and\\s+DLCs?'
  ];
  editionPhrases.forEach((phrase) => {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), ' ');
  });

  // Remove common single-word tags (be careful not to remove words that are part of game titles)
  const tags = [
    'Repack', 'MULTi\\d*', 'RIP', 'Cracked', 'Crack',
    'DLC', 'DLCs', 'GOTY', 'Complete', 'Edition', 'Deluxe', 'Ultimate',
    'Definitive', 'Enhanced', 'Remastered', 'Anniversary', 'Remake',
    'Digital', 'Steam', 'Epic', 'Uplay', 'Origin',
    'Collectors?', 'Limited', 'Special', 'Gold', 'Premium', 'Standard',
    'Directors?', 'Extended', 'Expanded', 'Uncut', 'Uncensored',
    'Bundle', 'Trilogy', 'Anthology',
    'FHD', '4K', 'UHD', 'SDR', 'HDR',
    'Windows', 'Win', 'Mac', 'Linux',
    'Incl', 'Including'
  ];
  tags.forEach((tag) => {
    cleaned = cleaned.replace(new RegExp(`\\b${tag}\\b`, 'gi'), ' ');
  });

  // Note: We intentionally do NOT remove trailing numbers like "4" in "Far Cry 4"
  // The version number removal earlier handles actual versions like ".v1.2.3"
  // Any remaining numbers are likely part of the game title

  // Normalize spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

describe('Library Search Query Cleaning', () => {
  describe('Edition Name Removal', () => {
    test('should remove "Collectors Edition"', () => {
      expect(cleanSearchQuery('Divinity Original Sin 2 Collectors Edition')).toBe('Divinity Original Sin 2');
    });

    test('should remove "Collector\'s Edition"', () => {
      expect(cleanSearchQuery("Divinity Original Sin 2 Collector's Edition")).toBe('Divinity Original Sin 2');
    });

    test('should remove "Enhanced Edition"', () => {
      expect(cleanSearchQuery('Baldurs Gate Enhanced Edition')).toBe('Baldurs Gate');
    });

    test('should remove "Definitive Edition"', () => {
      expect(cleanSearchQuery('Divinity Original Sin 2 Definitive Edition')).toBe('Divinity Original Sin 2');
    });

    test('should remove "Game of the Year Edition"', () => {
      expect(cleanSearchQuery('The Witcher 3 Game of the Year Edition')).toBe('The Witcher 3');
    });

    test('should remove "GOTY"', () => {
      expect(cleanSearchQuery('Fallout 4 GOTY')).toBe('Fallout 4');
    });

    test('should remove "Ultimate Edition"', () => {
      expect(cleanSearchQuery('Control Ultimate Edition')).toBe('Control');
    });

    test('should remove "Deluxe Edition"', () => {
      // "2077" is part of the game title, should remain
      expect(cleanSearchQuery('Cyberpunk 2077 Deluxe Edition')).toBe('Cyberpunk 2077');
    });

    test('should remove "Digital Deluxe"', () => {
      expect(cleanSearchQuery('Elden Ring Digital Deluxe')).toBe('Elden Ring');
    });

    test('should remove "Complete Edition"', () => {
      expect(cleanSearchQuery('Horizon Zero Dawn Complete Edition')).toBe('Horizon Zero Dawn');
    });

    test('should remove "Director\'s Cut"', () => {
      expect(cleanSearchQuery("Death Stranding Director's Cut")).toBe('Death Stranding');
    });

    test('should remove "Gold Edition"', () => {
      expect(cleanSearchQuery('Far Cry 6 Gold Edition')).toBe('Far Cry 6');
    });

    test('should remove "Remastered"', () => {
      expect(cleanSearchQuery('Mass Effect Legendary Edition Remastered')).toBe('Mass Effect');
    });

    test('should remove "Legendary Edition"', () => {
      expect(cleanSearchQuery('Mass Effect Legendary Edition')).toBe('Mass Effect');
    });
  });

  describe('Scene Group Removal', () => {
    test('should remove CODEX tag', () => {
      // "2077" is part of the game title, should remain
      expect(cleanSearchQuery('Cyberpunk.2077-CODEX')).toBe('Cyberpunk 2077');
    });

    test('should remove FitGirl tag', () => {
      expect(cleanSearchQuery('Elden Ring FitGirl Repack')).toBe('Elden Ring');
    });

    test('should remove DODI tag', () => {
      expect(cleanSearchQuery('Baldurs Gate 3 DODI Repack')).toBe('Baldurs Gate 3');
    });

    test('should remove GOG tag', () => {
      expect(cleanSearchQuery('Stardew Valley GOG')).toBe('Stardew Valley');
    });

    test('should remove bracketed content', () => {
      expect(cleanSearchQuery('Game Name [PLAZA]')).toBe('Game Name');
    });

    test('should remove parenthesized content', () => {
      expect(cleanSearchQuery('Game Name (2023)')).toBe('Game Name');
    });
  });

  describe('Version Number Removal', () => {
    test('should remove version numbers like v1.0', () => {
      expect(cleanSearchQuery('Game Name v1.0')).toBe('Game Name');
    });

    test('should remove version numbers like v1.2.3', () => {
      expect(cleanSearchQuery('Game Name v1.2.3')).toBe('Game Name');
    });

    test('should remove build keyword with numbers', () => {
      expect(cleanSearchQuery('Game Name Build 12345')).toBe('Game Name');
    });

    test('should remove build keyword without numbers', () => {
      expect(cleanSearchQuery('Game Name Build')).toBe('Game Name');
    });

    test('should remove patch keyword', () => {
      expect(cleanSearchQuery('Game Name Patch 5')).toBe('Game Name');
    });

    test('should remove update keyword', () => {
      expect(cleanSearchQuery('Game Name Update 3')).toBe('Game Name');
    });
  });

  describe('DLC Removal', () => {
    test('should remove "All DLCs"', () => {
      expect(cleanSearchQuery('Game Name All DLCs')).toBe('Game Name');
    });

    test('should remove "incl DLC"', () => {
      expect(cleanSearchQuery('Game Name incl DLC')).toBe('Game Name');
    });

    test('should remove "+ DLC"', () => {
      expect(cleanSearchQuery('Game Name + DLC')).toBe('Game Name');
    });

    test('should remove "with DLCs"', () => {
      expect(cleanSearchQuery('Game Name with DLCs')).toBe('Game Name');
    });
  });

  describe('Complex Real-World Examples', () => {
    test('should clean "Baldurs.Gate.3.v4.1.1.GOG"', () => {
      const result = cleanSearchQuery('Baldurs.Gate.3.v4.1.1.GOG');
      expect(result).toBe('Baldurs Gate 3');
    });

    test('should clean "Divinity.Original.Sin.2.Definitive.Edition-GOG"', () => {
      const result = cleanSearchQuery('Divinity.Original.Sin.2.Definitive.Edition-GOG');
      expect(result).toBe('Divinity Original Sin 2');
    });

    test('should clean "The.Witcher.3.Wild.Hunt.Game.of.the.Year.Edition-GOG"', () => {
      // "3" is part of the title and should remain (it's followed by more text)
      const result = cleanSearchQuery('The.Witcher.3.Wild.Hunt.Game.of.the.Year.Edition-GOG');
      expect(result).toBe('The Witcher 3 Wild Hunt');
    });

    test('should clean "Cyberpunk.2077.v2.1.Ultimate.Edition-FitGirl.Repack"', () => {
      // "2077" is part of the game title, should remain
      const result = cleanSearchQuery('Cyberpunk.2077.v2.1.Ultimate.Edition-FitGirl.Repack');
      expect(result).toBe('Cyberpunk 2077');
    });

    test('should clean "Elden.Ring.Shadow.of.the.Erdtree.Deluxe.Edition.v1.14-CODEX"', () => {
      const result = cleanSearchQuery('Elden.Ring.Shadow.of.the.Erdtree.Deluxe.Edition.v1.14-CODEX');
      expect(result).toBe('Elden Ring Shadow of the Erdtree');
    });

    test('should clean "Control.Ultimate.Edition.All.DLCs.Repack"', () => {
      const result = cleanSearchQuery('Control.Ultimate.Edition.All.DLCs.Repack');
      expect(result).toBe('Control');
    });

    test('should clean simple game name', () => {
      const result = cleanSearchQuery('Hades');
      expect(result).toBe('Hades');
    });

    test('should preserve "Original" in game titles', () => {
      const result = cleanSearchQuery('Divinity Original Sin');
      expect(result).toBe('Divinity Original Sin');
    });

    test('should clean "Mass.Effect.Legendary.Edition.Remastered-CODEX"', () => {
      const result = cleanSearchQuery('Mass.Effect.Legendary.Edition.Remastered-CODEX');
      expect(result).toBe('Mass Effect');
    });

    test('should clean "Horizon.Forbidden.West.Complete.Edition-RUNE"', () => {
      const result = cleanSearchQuery('Horizon.Forbidden.West.Complete.Edition-RUNE');
      expect(result).toBe('Horizon Forbidden West');
    });

    test('should clean "Red.Dead.Redemption.2.Ultimate.Edition-P2P"', () => {
      const result = cleanSearchQuery('Red.Dead.Redemption.2.Ultimate.Edition-P2P');
      expect(result).toBe('Red Dead Redemption 2');
    });
  });

  describe('Platform Tags Removal', () => {
    test('should remove Windows tag', () => {
      expect(cleanSearchQuery('Game Name Windows')).toBe('Game Name');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string', () => {
      expect(cleanSearchQuery('')).toBe('');
    });

    test('should handle string with only separators', () => {
      expect(cleanSearchQuery('...-___')).toBe('');
    });

    test('should handle game titles with numbers mid-title', () => {
      // Numbers in title should remain
      const result = cleanSearchQuery('Far Cry 6 Gold Edition');
      expect(result).toBe('Far Cry 6');
    });

    test('should preserve trailing numbers that are part of title', () => {
      expect(cleanSearchQuery('Far.Cry.4-SKIDROW')).toBe('Far Cry 4');
      expect(cleanSearchQuery('Fallout 4')).toBe('Fallout 4');
      expect(cleanSearchQuery('The Sims 4')).toBe('The Sims 4');
    });

    test('should preserve Roman numerals in game titles', () => {
      // Roman numerals are valid parts of game names
      const result = cleanSearchQuery('Final Fantasy VII');
      expect(result).toBe('Final Fantasy VII');
    });

    test('should remove Remake tag', () => {
      const result = cleanSearchQuery('Final Fantasy VII Remake');
      expect(result).toBe('Final Fantasy VII');
    });
  });
});
