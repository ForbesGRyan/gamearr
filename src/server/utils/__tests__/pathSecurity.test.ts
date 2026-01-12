import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'path';
import {
  safeJoinPath,
  normalizePath,
  isPathWithinBase,
  validatePathWithinBase,
  containsTraversalPatterns,
} from '../pathSecurity';
import { PathTraversalError } from '../errors';

describe('pathSecurity', () => {
  describe('safeJoinPath', () => {
    const basePath = process.platform === 'win32' ? 'C:\\Games\\Library' : '/home/user/games';

    describe('valid paths', () => {
      it('should allow joining a simple subdirectory', () => {
        const result = safeJoinPath(basePath, 'Cyberpunk 2077');
        expect(result).toBe(path.join(basePath, 'Cyberpunk 2077'));
      });

      it('should allow joining nested subdirectories', () => {
        const result = safeJoinPath(basePath, 'GOG', 'Witcher 3', 'DLC');
        expect(result).toBe(path.join(basePath, 'GOG', 'Witcher 3', 'DLC'));
      });

      it('should allow joining with file name', () => {
        const result = safeJoinPath(basePath, 'Game', 'save.dat');
        expect(result).toBe(path.join(basePath, 'Game', 'save.dat'));
      });

      it('should handle empty segment array', () => {
        const result = safeJoinPath(basePath);
        expect(result).toBe(basePath);
      });
    });

    describe('path traversal error cases', () => {
      it('should throw PathTraversalError when using ../ to escape base directory', () => {
        expect(() => {
          safeJoinPath(basePath, '..', 'outside');
        }).toThrow(PathTraversalError);
      });

      it('should throw PathTraversalError when using multiple ../ to escape', () => {
        expect(() => {
          safeJoinPath(basePath, '..', '..', '..', 'etc', 'passwd');
        }).toThrow(PathTraversalError);
      });

      it('should throw PathTraversalError when traversal is embedded in path', () => {
        expect(() => {
          safeJoinPath(basePath, 'subdir', '..', '..', 'outside');
        }).toThrow(PathTraversalError);
      });

      it('should throw PathTraversalError with normalized traversal sequences', () => {
        expect(() => {
          // Even if path.join normalizes this, the result escapes base
          safeJoinPath(basePath, 'game/../../../outside');
        }).toThrow(PathTraversalError);
      });

      it('should throw PathTraversalError for deeply nested traversal attempts', () => {
        expect(() => {
          safeJoinPath(basePath, 'a', 'b', 'c', '..', '..', '..', '..', 'escape');
        }).toThrow(PathTraversalError);
      });

      it('should throw PathTraversalError with correct error message', () => {
        try {
          safeJoinPath(basePath, '..', 'outside');
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(PathTraversalError);
          expect((error as PathTraversalError).message).toBe(
            'Access denied: path is outside the allowed directory'
          );
        }
      });

      it('should throw PathTraversalError with correct error code', () => {
        try {
          safeJoinPath(basePath, '..', 'outside');
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(PathTraversalError);
          expect((error as PathTraversalError).statusCode).toBe(403);
        }
      });

      it('should throw PathTraversalError for backslash traversal', () => {
        // Works on both platforms - backslashes are normalized
        expect(() => {
          safeJoinPath(basePath, '..\\..\\..\\escape');
        }).toThrow(PathTraversalError);
      });
    });

    describe('edge cases', () => {
      it('should allow current directory reference (.)', () => {
        const result = safeJoinPath(basePath, '.', 'game');
        expect(result).toBe(path.join(basePath, 'game'));
      });

      it('should allow traversal that stays within base', () => {
        // Go into subdir then back out but still within base
        const result = safeJoinPath(basePath, 'sub', '..', 'other');
        expect(result).toBe(path.join(basePath, 'other'));
      });

      it('should handle paths with spaces', () => {
        const result = safeJoinPath(basePath, 'Game With Spaces', 'Sub Directory');
        expect(result).toBe(path.join(basePath, 'Game With Spaces', 'Sub Directory'));
      });

      it('should handle paths with special characters', () => {
        const result = safeJoinPath(basePath, "Game's Name (2023)", 'save');
        expect(result).toBe(path.join(basePath, "Game's Name (2023)", 'save'));
      });
    });
  });

  describe('normalizePath', () => {
    it('should resolve relative paths to absolute', () => {
      const result = normalizePath('./relative/path');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should normalize path separators', () => {
      const result = normalizePath('/some//path///with/extra/slashes');
      expect(result).not.toContain('//');
    });
  });

  describe('isPathWithinBase', () => {
    const basePath = process.platform === 'win32' ? 'C:\\Games' : '/home/games';

    it('should return true for exact base path match', () => {
      expect(isPathWithinBase(basePath, basePath)).toBe(true);
    });

    it('should return true for valid subdirectory', () => {
      const subPath = path.join(basePath, 'subdir');
      expect(isPathWithinBase(subPath, basePath)).toBe(true);
    });

    it('should return false for parent directory', () => {
      const parentPath = path.dirname(basePath);
      expect(isPathWithinBase(parentPath, basePath)).toBe(false);
    });

    it('should return false for sibling directory', () => {
      const siblingPath = path.join(path.dirname(basePath), 'sibling');
      expect(isPathWithinBase(siblingPath, basePath)).toBe(false);
    });

    it('should return false for path with similar prefix but not subdirectory', () => {
      // e.g., /home/games vs /home/games-backup
      const similarPath = basePath + '-backup';
      expect(isPathWithinBase(similarPath, basePath)).toBe(false);
    });
  });

  describe('validatePathWithinBase', () => {
    const basePath = process.platform === 'win32' ? 'C:\\Games' : '/home/games';

    it('should not throw for valid path within base', () => {
      const validPath = path.join(basePath, 'subdir');
      expect(() => validatePathWithinBase(validPath, basePath)).not.toThrow();
    });

    it('should throw PathTraversalError for path outside base', () => {
      const outsidePath = path.join(basePath, '..', 'outside');
      expect(() => validatePathWithinBase(outsidePath, basePath)).toThrow(PathTraversalError);
    });

    it('should include context in error logging', () => {
      const outsidePath = path.join(basePath, '..', 'outside');
      expect(() => validatePathWithinBase(outsidePath, basePath, 'test operation')).toThrow(
        PathTraversalError
      );
    });
  });

  describe('containsTraversalPatterns', () => {
    it('should detect parent directory reference (..)', () => {
      expect(containsTraversalPatterns('../etc/passwd')).toBe(true);
      expect(containsTraversalPatterns('path/../other')).toBe(true);
    });

    it('should detect Unix absolute path', () => {
      expect(containsTraversalPatterns('/etc/passwd')).toBe(true);
    });

    it('should detect Windows absolute path', () => {
      expect(containsTraversalPatterns('C:\\Windows\\System32')).toBe(true);
      expect(containsTraversalPatterns('D:/Games')).toBe(true);
    });

    it('should detect URL-encoded traversal', () => {
      expect(containsTraversalPatterns('%2e%2e/etc/passwd')).toBe(true);
      expect(containsTraversalPatterns('%2E%2E/etc/passwd')).toBe(true);
    });

    it('should detect double URL-encoded traversal', () => {
      expect(containsTraversalPatterns('%252e%252e/etc/passwd')).toBe(true);
    });

    it('should detect null byte injection', () => {
      expect(containsTraversalPatterns('file.txt\0.jpg')).toBe(true);
    });

    it('should return false for safe relative paths', () => {
      expect(containsTraversalPatterns('game/saves/slot1.dat')).toBe(false);
      expect(containsTraversalPatterns('My Game (2023)')).toBe(false);
    });

    it('should return false for current directory reference', () => {
      expect(containsTraversalPatterns('./game/saves')).toBe(false);
    });
  });
});
