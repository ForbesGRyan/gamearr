/**
 * Version parsing and comparison utilities
 * Used by UpdateService and FileService for version extraction and comparison
 */

// Import package.json for app version
// @ts-ignore - Bun supports JSON imports
import packageJson from '../../../package.json';

/**
 * Application version from package.json
 */
export const APP_VERSION: string = packageJson.version;

/**
 * Parse version number from a string (folder name, release title, etc.)
 * Returns null if no version pattern is found
 *
 * Supports patterns:
 * - v1.2.3, v1.2, v1 (versioned releases)
 * - version 1.2.3, version.1.2 (explicit version)
 * - 1.2.3 (semantic versioning)
 * - build 123, build.123 (build numbers)
 * - update 5, update.5, u5 (update numbers)
 * - r5 (revision numbers)
 * - patch 1.2 (patch versions)
 */
export function parseVersion(text: string): string | null {
  const patterns = [
    // v1.2.3 or v1.2 (with separator before to avoid matching mid-word)
    /[._\s-]v(\d+(?:\.\d+)+)/i,
    // v1 alone (single number version, with separator)
    /[._\s-]v(\d+)(?:[._\s-]|$)/i,
    // Leading v1.2.3 or v1.2 (at start of string)
    /^v(\d+(?:\.\d+)*)/i,
    // version 1.2.3 or version.1.2
    /version[.\s_]?(\d+(?:\.\d+)*)/i,
    // 1.2.3 (semantic versioning - 3 parts minimum)
    /[._\s-](\d+\.\d+\.\d+)(?:[._\s-]|$)/,
    // build 123 or build.123
    /build[.\s_]?(\d+)/i,
    // update 5 or update.5
    /update[.\s_]?(\d+)/i,
    // u5 (short for update)
    /[._\s-]u(\d+)(?:[._\s-]|$)/i,
    // r5 (revision)
    /[._\s-]r(\d+)(?:[._\s-]|$)/i,
    // patch 1.2 or patch.1
    /patch[.\s_]?(\d+(?:\.\d+)*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 *
 * Handles versions like:
 * - "1.2.3" vs "1.2.4"
 * - "1.2" vs "1.2.1"
 * - "10" vs "9"
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);

  // Pad shorter array with zeros for fair comparison
  const maxLength = Math.max(partsA.length, partsB.length);
  while (partsA.length < maxLength) partsA.push(0);
  while (partsB.length < maxLength) partsB.push(0);

  for (let i = 0; i < maxLength; i++) {
    if (partsA[i] < partsB[i]) return -1;
    if (partsA[i] > partsB[i]) return 1;
  }

  return 0;
}

/**
 * Check if version A is newer than version B
 */
export function isNewerVersion(newVersion: string, currentVersion: string): boolean {
  return compareVersions(newVersion, currentVersion) > 0;
}
