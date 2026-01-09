/**
 * Generate a URL-safe slug from a title
 * "Elden Ring" -> "elden-ring"
 * "The Witcher 3: Wild Hunt" -> "the-witcher-3-wild-hunt"
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')           // Remove apostrophes
    .replace(/[:\-–—]/g, ' ')       // Replace colons/dashes with spaces
    .replace(/[^a-z0-9\s]/g, '')    // Remove special characters
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-');           // Collapse multiple hyphens
}

/**
 * Normalize platform for URL usage
 * "PC (Microsoft Windows)" -> "pc"
 * "PlayStation 5" -> "playstation-5"
 */
export function normalizePlatformSlug(platform: string): string {
  const lower = platform.toLowerCase();

  // Normalize all PC variants to just "pc"
  if (lower.includes('pc') || lower.includes('windows') || lower === 'microsoft windows') {
    return 'pc';
  }

  // For other platforms, create a clean slug
  return lower
    .replace(/[()]/g, '')           // Remove parentheses
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
}

/**
 * Generate the path to a game detail page
 * Platform is normalized (PC variants become just "pc")
 */
export function getGameDetailPath(platform: string, title: string): string {
  const platformSlug = normalizePlatformSlug(platform);
  const titleSlug = generateSlug(title);
  return `/game/${platformSlug}/${titleSlug}`;
}
