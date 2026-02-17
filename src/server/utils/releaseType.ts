/**
 * Release type detection utility
 * Detects whether a torrent release is a full game, update-only, patch-only, or DLC
 */

export type ReleaseType = 'full' | 'update' | 'patch' | 'dlc';

/**
 * Detect the release type from a torrent title
 * @param title - The torrent release title
 * @returns The detected release type
 */
export function detectReleaseType(title: string): ReleaseType {
  const titleLower = title.toLowerCase();

  // DLC patterns - check first as DLC releases may also have "update" in name
  if (
    /\bDLC\b/i.test(title) ||
    /\bExpansion\b/i.test(title) ||
    /\bSeason[\s._]*Pass\b/i.test(title) ||
    /\bDLC[\s._]*Pack\b/i.test(title)
  ) {
    return 'dlc';
  }

  // First check for patterns that indicate a FULL game (not update-only)
  // These take priority over update detection
  // "Updated to", "includes Update", "with Patch", "v1.5.3 Updated"
  if (
    /\bupdated?\s+(to|included|with)/i.test(title) ||
    /\bpatched?\s+(to|included|with)/i.test(title) ||
    /\b(includes?|with|contains?)\s+(update|hotfix|patch)/i.test(title) ||
    /v\d+(\.\d+)+[\s._]*(updated|patched)/i.test(title)
  ) {
    return 'full';
  }

  // Update-only patterns (highest confidence)
  // "Update Only", "Patch Only", "Hotfix Only"
  if (/\b(update|patch|hotfix|fix)[\s._]*only\b/i.test(title)) {
    return titleLower.includes('patch') ? 'patch' : 'update';
  }

  // Update/Patch at end of title with separator (before group name)
  // e.g., "Game.Title-Update", "Game Title - Hotfix", "Game.Title.Update-CODEX"
  if (/[-._](update|hotfix)(-[a-zA-Z0-9]+)?$/i.test(title)) {
    return 'update';
  }
  if (/[-._]patch(-[a-zA-Z0-9]+)?$/i.test(title)) {
    return 'patch';
  }

  // Update/Patch with version number pattern
  // e.g., "Game.Title.Update.v1.5-GROUP", "Game.Title.Hotfix.2-CODEX"
  // Match: .Update.v1.5 or .Update.1.5 or .Hotfix.2
  if (/[._](update|hotfix)[._]v?\d+(\.\d+)*(-[a-zA-Z0-9]+)?$/i.test(title)) {
    return 'update';
  }
  if (/[._]patch[._]v?\d+(\.\d+)*(-[a-zA-Z0-9]+)?$/i.test(title)) {
    return 'patch';
  }

  // Standalone update/hotfix/patch in the middle with separators
  // e.g., "Game.Title.Update.v1.5.Other-GROUP"
  if (/[._](update|hotfix)[._]v?\d/i.test(title) && !/\bupdated\b/i.test(title)) {
    return 'update';
  }
  if (/[._]patch[._]v?\d/i.test(title) && !/\bpatched\b/i.test(title)) {
    return 'patch';
  }

  return 'full';
}

/**
 * Get human-readable label for release type
 */
export function getReleaseTypeLabel(type: ReleaseType): string {
  switch (type) {
    case 'update':
      return 'Update Only';
    case 'patch':
      return 'Patch Only';
    case 'dlc':
      return 'DLC';
    case 'full':
    default:
      return 'Full Game';
  }
}
