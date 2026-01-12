import { describe, expect, test } from 'bun:test';

import {
  APP_VERSION,
  parseVersion,
  compareVersions,
  isNewerVersion,
} from '../../src/server/utils/version';

describe('version utilities', () => {
  // =============================================================================
  // APP_VERSION Tests
  // =============================================================================
  describe('APP_VERSION', () => {
    test('should be defined and non-empty', () => {
      expect(APP_VERSION).toBeDefined();
      expect(typeof APP_VERSION).toBe('string');
      expect(APP_VERSION.length).toBeGreaterThan(0);
    });

    test('should match semantic versioning format', () => {
      // APP_VERSION should be something like "0.1.0" or "1.2.3"
      const semverPattern = /^\d+\.\d+\.\d+$/;
      expect(APP_VERSION).toMatch(semverPattern);
    });
  });

  // =============================================================================
  // parseVersion Tests
  // =============================================================================
  describe('parseVersion', () => {
    describe('v prefix patterns', () => {
      test('should parse v1.2.3 format with separator before', () => {
        expect(parseVersion('Game Name v1.2.3')).toBe('1.2.3');
        expect(parseVersion('Game.Name.v2.0.1.GOG')).toBe('2.0.1');
        expect(parseVersion('Game-v10.5.0')).toBe('10.5.0');
        expect(parseVersion('Game_v3.2.1')).toBe('3.2.1');
      });

      test('should parse single number version v1 with separator', () => {
        expect(parseVersion('Game Name v1 GOG')).toBe('1');
        expect(parseVersion('Game.Name.v5.Repack')).toBe('5');
        expect(parseVersion('Game-v10-CODEX')).toBe('10');
        expect(parseVersion('Game_v7_Release')).toBe('7');
      });

      test('should parse leading v version at start of string', () => {
        expect(parseVersion('v1.2.3 Game Name')).toBe('1.2.3');
        expect(parseVersion('v10.0')).toBe('10.0');
        expect(parseVersion('v5')).toBe('5');
        expect(parseVersion('v1.0.0.1234')).toBe('1.0.0.1234');
      });

      test('should handle v with many version parts', () => {
        expect(parseVersion('Game.v4.1.1.418')).toBe('4.1.1.418');
        expect(parseVersion('Game v1.2.3.4.5')).toBe('1.2.3.4.5');
      });

      test('should be case insensitive for v prefix', () => {
        expect(parseVersion('Game.V1.2.3')).toBe('1.2.3');
        expect(parseVersion('Game-V5')).toBe('5');
      });
    });

    describe('version keyword patterns', () => {
      test('should parse version 1.2.3 format', () => {
        expect(parseVersion('Game version 1.2.3')).toBe('1.2.3');
        expect(parseVersion('Game Version.2.0.1')).toBe('2.0.1');
        expect(parseVersion('Game version1.5')).toBe('1.5');
      });

      test('should parse version with underscore separator', () => {
        expect(parseVersion('Game version_3.0')).toBe('3.0');
      });

      test('should be case insensitive for version keyword', () => {
        expect(parseVersion('Game VERSION 1.0')).toBe('1.0');
        expect(parseVersion('Game Version 2.5')).toBe('2.5');
        expect(parseVersion('Game version 3.0')).toBe('3.0');
      });
    });

    describe('semantic versioning patterns', () => {
      test('should parse 3-part semantic versioning (1.2.3)', () => {
        expect(parseVersion('Game 1.2.3 GOG')).toBe('1.2.3');
        expect(parseVersion('Game-1.0.0-REPACK')).toBe('1.0.0');
        expect(parseVersion('Game.1.5.2.Scene')).toBe('1.5.2');
        expect(parseVersion('Game_10.20.30_Release')).toBe('10.20.30');
      });

      test('should require minimum 3 parts for bare semantic version', () => {
        // Bare "1.2" without prefix should not match (requires 3 parts)
        expect(parseVersion('Game 1.2 GOG')).toBeNull();
        // But with v prefix it should work
        expect(parseVersion('Game v1.2 GOG')).toBe('1.2');
      });
    });

    describe('build number patterns', () => {
      test('should parse build numbers', () => {
        expect(parseVersion('Game Build 12345')).toBe('12345');
        expect(parseVersion('Game.Build.999')).toBe('999');
        expect(parseVersion('Game build123')).toBe('123');
        expect(parseVersion('Game build_456')).toBe('456');
      });

      test('should be case insensitive for build keyword', () => {
        expect(parseVersion('Game BUILD 100')).toBe('100');
        expect(parseVersion('Game Build 200')).toBe('200');
        expect(parseVersion('Game build 300')).toBe('300');
      });
    });

    describe('update number patterns', () => {
      test('should parse update numbers with keyword', () => {
        expect(parseVersion('Game Update 5')).toBe('5');
        expect(parseVersion('Game.Update.10')).toBe('10');
        expect(parseVersion('Game update5')).toBe('5');
        expect(parseVersion('Game update_15')).toBe('15');
      });

      test('should parse u# short format for updates', () => {
        expect(parseVersion('Game.u5.CODEX')).toBe('5');
        expect(parseVersion('Game Name u10 Repack')).toBe('10');
        expect(parseVersion('Game-u7-GOG')).toBe('7');
        expect(parseVersion('Game_u3_Release')).toBe('3');
      });

      test('should not match u in middle of word', () => {
        // "beautiful" should not match the u pattern
        expect(parseVersion('Beautiful Game')).toBeNull();
      });

      test('should be case insensitive for update patterns', () => {
        expect(parseVersion('Game UPDATE 5')).toBe('5');
        expect(parseVersion('Game.U5.Scene')).toBe('5');
      });
    });

    describe('revision number patterns', () => {
      test('should parse r# revision format', () => {
        expect(parseVersion('Game.r5.GOG')).toBe('5');
        expect(parseVersion('Game Name r10 CODEX')).toBe('10');
        expect(parseVersion('Game-r3-Release')).toBe('3');
        expect(parseVersion('Game_r7_Scene')).toBe('7');
      });

      test('should not match r in middle of word', () => {
        // "parser" should not match the r pattern
        expect(parseVersion('Parser Game')).toBeNull();
      });

      test('should be case insensitive for revision pattern', () => {
        expect(parseVersion('Game.R5.Scene')).toBe('5');
      });
    });

    describe('patch version patterns', () => {
      test('should parse patch versions', () => {
        expect(parseVersion('Game patch 1.2')).toBe('1.2');
        expect(parseVersion('Game.Patch.5.0')).toBe('5.0');
        expect(parseVersion('Game patch3')).toBe('3');
        expect(parseVersion('Game patch_2.5')).toBe('2.5');
      });

      test('should parse multi-part patch versions', () => {
        expect(parseVersion('Game patch 1.2.3')).toBe('1.2.3');
        expect(parseVersion('Game.Patch.10.20.30')).toBe('10.20.30');
      });

      test('should be case insensitive for patch keyword', () => {
        expect(parseVersion('Game PATCH 1.0')).toBe('1.0');
        expect(parseVersion('Game Patch 2.0')).toBe('2.0');
        expect(parseVersion('Game patch 3.0')).toBe('3.0');
      });
    });

    describe('no version found', () => {
      test('should return null when no version pattern found', () => {
        expect(parseVersion('Game Name GOG')).toBeNull();
        expect(parseVersion('Some Random Release')).toBeNull();
        expect(parseVersion('CODEX')).toBeNull();
        expect(parseVersion('Game Name')).toBeNull();
        expect(parseVersion('')).toBeNull();
      });

      test('should not match years as versions', () => {
        // Years alone should not be matched as versions
        expect(parseVersion('Game (2023)')).toBeNull();
        expect(parseVersion('Game 2023 Edition')).toBeNull();
      });
    });

    describe('complex real-world release titles', () => {
      test('should handle typical scene release names', () => {
        expect(parseVersion('Cyberpunk.2077.v2.1.GOG')).toBe('2.1');
        expect(parseVersion('The.Witcher.3.Wild.Hunt.v4.04.GOTY.Edition')).toBe('4.04');
        expect(parseVersion('Baldurs.Gate.3.v4.1.1.418')).toBe('4.1.1.418');
      });

      test('should handle multiple separators', () => {
        expect(parseVersion('Game_Name_v1.2.3')).toBe('1.2.3');
        expect(parseVersion('Game_Name_v5_GOG')).toBe('5');
        expect(parseVersion('Game.Name-v2.0.0-CODEX')).toBe('2.0.0');
      });

      test('should handle spaces as separators', () => {
        expect(parseVersion('Game Name v1.2.3 GOG')).toBe('1.2.3');
        expect(parseVersion('Game Name v5 Repack')).toBe('5');
        expect(parseVersion('Game Name Update 10 Final')).toBe('10');
      });

      test('should match patterns in order defined', () => {
        // v pattern with separator comes before leading v pattern in pattern array
        // so ' v1.2.3' matches before '^v2.0'
        expect(parseVersion('Game v1.2.3 1.0.0')).toBe('1.2.3');
        // When string starts with v, but also has another v with separator,
        // the separator pattern matches first
        expect(parseVersion('v2.0 Game v1.0')).toBe('1.0');
      });
    });

    describe('edge cases', () => {
      test('should handle versions with leading zeros', () => {
        expect(parseVersion('Game v01.02.03')).toBe('01.02.03');
        expect(parseVersion('Game.v001.GOG')).toBe('001');
      });

      test('should handle very long version numbers', () => {
        expect(parseVersion('Game v100.200.300.400')).toBe('100.200.300.400');
        expect(parseVersion('Game build 1234567890')).toBe('1234567890');
      });

      test('should handle versions at end of string', () => {
        expect(parseVersion('Game v1.2.3')).toBe('1.2.3');
        expect(parseVersion('Game build 123')).toBe('123');
        expect(parseVersion('Game.u5')).toBe('5');
      });
    });
  });

  // =============================================================================
  // compareVersions Tests
  // =============================================================================
  describe('compareVersions', () => {
    describe('basic comparisons', () => {
      test('should return 1 when first version is greater (major)', () => {
        expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
        expect(compareVersions('10.0.0', '9.0.0')).toBe(1);
        expect(compareVersions('100.0.0', '99.0.0')).toBe(1);
      });

      test('should return 1 when first version is greater (minor)', () => {
        expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
        expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
        expect(compareVersions('1.100.0', '1.99.0')).toBe(1);
      });

      test('should return 1 when first version is greater (patch)', () => {
        expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
        expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
        expect(compareVersions('1.0.100', '1.0.99')).toBe(1);
      });

      test('should return -1 when first version is smaller (major)', () => {
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
        expect(compareVersions('9.0.0', '10.0.0')).toBe(-1);
      });

      test('should return -1 when first version is smaller (minor)', () => {
        expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
        expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
      });

      test('should return -1 when first version is smaller (patch)', () => {
        expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
        expect(compareVersions('1.0.9', '1.0.10')).toBe(-1);
      });

      test('should return 0 when versions are equal', () => {
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
        expect(compareVersions('2.5.3', '2.5.3')).toBe(0);
        expect(compareVersions('10.20.30', '10.20.30')).toBe(0);
      });
    });

    describe('different version lengths', () => {
      test('should handle shorter first version (equal)', () => {
        expect(compareVersions('1.0', '1.0.0')).toBe(0);
        expect(compareVersions('1', '1.0.0')).toBe(0);
        expect(compareVersions('1', '1.0.0.0')).toBe(0);
      });

      test('should handle shorter second version (equal)', () => {
        expect(compareVersions('1.0.0', '1.0')).toBe(0);
        expect(compareVersions('1.0.0', '1')).toBe(0);
        expect(compareVersions('1.0.0.0', '1')).toBe(0);
      });

      test('should handle shorter version with difference', () => {
        expect(compareVersions('2.0', '1.0.0')).toBe(1);
        expect(compareVersions('1.0.1', '1.0')).toBe(1);
        expect(compareVersions('1.0', '1.0.1')).toBe(-1);
        expect(compareVersions('1.0.0', '2.0')).toBe(-1);
      });
    });

    describe('single-number versions', () => {
      test('should compare single-number versions', () => {
        expect(compareVersions('2', '1')).toBe(1);
        expect(compareVersions('1', '2')).toBe(-1);
        expect(compareVersions('10', '9')).toBe(1);
        expect(compareVersions('9', '10')).toBe(-1);
        expect(compareVersions('5', '5')).toBe(0);
      });

      test('should compare single-number to multi-part', () => {
        expect(compareVersions('2', '1.9.9')).toBe(1);
        expect(compareVersions('1', '1.0.1')).toBe(-1);
        expect(compareVersions('1', '1.0.0')).toBe(0);
      });
    });

    describe('four-part versions', () => {
      test('should compare four-part versions correctly', () => {
        expect(compareVersions('4.1.1.418', '4.1.1.417')).toBe(1);
        expect(compareVersions('4.1.1.418', '4.1.1.419')).toBe(-1);
        expect(compareVersions('4.1.1.418', '4.1.1.418')).toBe(0);
        expect(compareVersions('4.1.2.0', '4.1.1.999')).toBe(1);
      });
    });

    describe('edge cases', () => {
      test('should handle empty strings', () => {
        expect(compareVersions('', '')).toBe(0);
        expect(compareVersions('1', '')).toBe(1);
        expect(compareVersions('', '1')).toBe(-1);
      });

      test('should handle non-numeric parts (defaults to 0)', () => {
        // Non-numeric parts should be treated as 0
        expect(compareVersions('1.a.0', '1.0.0')).toBe(0);
        expect(compareVersions('1.0.0', '1.b.0')).toBe(0);
      });

      test('should handle leading zeros', () => {
        expect(compareVersions('01.02.03', '1.2.3')).toBe(0);
        expect(compareVersions('001', '1')).toBe(0);
      });

      test('should handle very long version numbers', () => {
        expect(compareVersions('1.2.3.4.5.6.7.8.9', '1.2.3.4.5.6.7.8.10')).toBe(-1);
        expect(compareVersions('1.2.3.4.5.6.7.8.10', '1.2.3.4.5.6.7.8.9')).toBe(1);
      });

      test('should handle large numbers correctly', () => {
        expect(compareVersions('999999999', '999999998')).toBe(1);
        expect(compareVersions('1.999999999', '1.999999998')).toBe(1);
      });
    });
  });

  // =============================================================================
  // isNewerVersion Tests
  // =============================================================================
  describe('isNewerVersion', () => {
    describe('basic functionality', () => {
      test('should return true when new version is greater', () => {
        expect(isNewerVersion('2.0.0', '1.0.0')).toBe(true);
        expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true);
        expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
      });

      test('should return false when new version is smaller', () => {
        expect(isNewerVersion('1.0.0', '2.0.0')).toBe(false);
        expect(isNewerVersion('1.0.0', '1.1.0')).toBe(false);
        expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
      });

      test('should return false when versions are equal', () => {
        expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
        expect(isNewerVersion('2.5.3', '2.5.3')).toBe(false);
      });
    });

    describe('real-world upgrade scenarios', () => {
      test('should detect major version upgrades', () => {
        expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
        expect(isNewerVersion('3.0.0', '2.99.99')).toBe(true);
      });

      test('should detect minor version upgrades', () => {
        expect(isNewerVersion('1.5.0', '1.4.9')).toBe(true);
        expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
      });

      test('should detect patch version upgrades', () => {
        expect(isNewerVersion('1.0.5', '1.0.4')).toBe(true);
        expect(isNewerVersion('1.0.10', '1.0.9')).toBe(true);
      });

      test('should handle game update version comparisons', () => {
        // Common game version scenarios
        expect(isNewerVersion('1.5.0', '1.0.0')).toBe(true);
        expect(isNewerVersion('2.1', '2.0')).toBe(true);
        expect(isNewerVersion('4.1.1.418', '4.1.1.417')).toBe(true);
        expect(isNewerVersion('4.04', '4.03')).toBe(true);
      });

      test('should correctly identify non-upgrades', () => {
        // Same version is not an upgrade
        expect(isNewerVersion('1.5.0', '1.5.0')).toBe(false);
        // Older version is not an upgrade
        expect(isNewerVersion('1.0.0', '1.5.0')).toBe(false);
      });
    });

    describe('edge cases', () => {
      test('should handle different version lengths', () => {
        expect(isNewerVersion('1.0.1', '1.0')).toBe(true);
        expect(isNewerVersion('1.0', '1.0.1')).toBe(false);
        expect(isNewerVersion('2', '1.9.9')).toBe(true);
      });

      test('should handle single number versions', () => {
        expect(isNewerVersion('2', '1')).toBe(true);
        expect(isNewerVersion('1', '2')).toBe(false);
        expect(isNewerVersion('10', '9')).toBe(true);
      });

      test('should handle empty strings', () => {
        expect(isNewerVersion('1', '')).toBe(true);
        expect(isNewerVersion('', '1')).toBe(false);
        expect(isNewerVersion('', '')).toBe(false);
      });
    });
  });

  // =============================================================================
  // Integration Tests - Using functions together
  // =============================================================================
  describe('integration tests', () => {
    test('should correctly detect update availability from release titles', () => {
      const installedVersion = '1.0.0';
      const releaseTitle = 'Game Name v1.5.0 GOG';
      const releaseVersion = parseVersion(releaseTitle);

      expect(releaseVersion).toBe('1.5.0');
      expect(isNewerVersion(releaseVersion!, installedVersion)).toBe(true);
    });

    test('should not flag older releases as updates', () => {
      const installedVersion = '2.0.0';
      const releaseTitle = 'Game Name v1.5.0 GOG';
      const releaseVersion = parseVersion(releaseTitle);

      expect(releaseVersion).toBe('1.5.0');
      expect(isNewerVersion(releaseVersion!, installedVersion)).toBe(false);
    });

    test('should handle releases without versions', () => {
      const installedVersion = '1.0.0';
      const releaseTitle = 'Game Name GOG';
      const releaseVersion = parseVersion(releaseTitle);

      expect(releaseVersion).toBeNull();
      // Can't determine if it's newer without a version
    });

    test('should handle complex scene release names', () => {
      const installedVersion = '4.1.1.417';
      const releaseTitle = 'Baldurs.Gate.3.v4.1.1.418-GOG';
      const releaseVersion = parseVersion(releaseTitle);

      expect(releaseVersion).toBe('4.1.1.418');
      expect(isNewerVersion(releaseVersion!, installedVersion)).toBe(true);
    });

    test('should work with build numbers', () => {
      const installedBuild = '12345';
      const releaseTitle = 'Game Build 12346';
      const releaseBuild = parseVersion(releaseTitle);

      expect(releaseBuild).toBe('12346');
      expect(isNewerVersion(releaseBuild!, installedBuild)).toBe(true);
    });

    test('should work with update numbers', () => {
      const installedUpdate = '5';
      const releaseTitle = 'Game.u6.CODEX';
      const releaseUpdate = parseVersion(releaseTitle);

      expect(releaseUpdate).toBe('6');
      expect(isNewerVersion(releaseUpdate!, installedUpdate)).toBe(true);
    });
  });
});
