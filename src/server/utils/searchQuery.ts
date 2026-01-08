/**
 * Search query cleaning utilities
 * Used for cleaning up scene release names and version info for better IGDB matching
 */

/**
 * Clean up scene release names and version info for better IGDB matching
 * Removes: scene groups, version numbers, "update" keywords, edition names, common tags
 */
export function cleanSearchQuery(title: string): string {
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
