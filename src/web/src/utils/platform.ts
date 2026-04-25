/**
 * Pick the preferred platform from an IGDB platform list.
 * Gamearr is PC-focused, so prefer a PC/Windows entry when present;
 * otherwise fall back to the first listed platform.
 */
export function pickPreferredPlatform(platforms?: string[]): string | undefined {
  if (!platforms || platforms.length === 0) return undefined;
  const pc = platforms.find(p => /\b(PC|Windows)\b/i.test(p));
  return pc || platforms[0];
}
