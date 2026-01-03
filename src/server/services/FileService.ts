import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { settingsService } from './SettingsService';
import { gameRepository } from '../repositories/GameRepository';
import type { Game } from '../db/schema';

export interface MoveResult {
  success: boolean;
  newPath?: string;
  error?: string;
}

export interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  parsedYear?: number;
  matched: boolean;
  gameId?: number;
  path: string;
}

export class FileService {
  /**
   * Get the library path from settings
   */
  private async getLibraryPath(): Promise<string> {
    const libraryPath = await settingsService.getSetting('library_path');

    if (!libraryPath) {
      throw new Error('Library path not configured. Please set library_path in settings.');
    }

    // Ensure library path exists
    if (!fs.existsSync(libraryPath)) {
      logger.info(`Creating library directory: ${libraryPath}`);
      fs.mkdirSync(libraryPath, { recursive: true });
    }

    return libraryPath;
  }

  /**
   * Build target folder name based on game info
   * Pattern: {Title} ({Year})
   */
  private buildFolderName(game: Game): string {
    const sanitizedTitle = this.sanitizeFileName(game.title);

    if (game.year) {
      return `${sanitizedTitle} (${game.year})`;
    }

    return sanitizedTitle;
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFileName(name: string): string {
    // Remove or replace characters that are invalid in file names
    return name
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if a path exists
   */
  async pathExists(filePath: string): Promise<boolean> {
    return fs.existsSync(filePath);
  }

  /**
   * Get folder size in bytes
   */
  async getFolderSize(folderPath: string): Promise<number> {
    if (!fs.existsSync(folderPath)) {
      return 0;
    }

    let totalSize = 0;

    const stats = fs.statSync(folderPath);

    if (stats.isFile()) {
      return stats.size;
    }

    if (stats.isDirectory()) {
      const files = fs.readdirSync(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const fileStats = fs.statSync(filePath);

        if (fileStats.isDirectory()) {
          totalSize += await this.getFolderSize(filePath);
        } else {
          totalSize += fileStats.size;
        }
      }
    }

    return totalSize;
  }

  /**
   * Move and organize a completed download
   */
  async organizeDownload(game: Game, sourcePath: string): Promise<MoveResult> {
    try {
      logger.info(`Organizing download for game: ${game.title}`);
      logger.info(`Source path: ${sourcePath}`);

      // Check if source exists
      if (!fs.existsSync(sourcePath)) {
        logger.error(`Source path does not exist: ${sourcePath}`);
        return {
          success: false,
          error: 'Source path does not exist',
        };
      }

      // Get library path
      const libraryPath = await this.getLibraryPath();

      // Build target folder name
      const folderName = this.buildFolderName(game);
      const targetPath = path.join(libraryPath, folderName);

      logger.info(`Target path: ${targetPath}`);

      // Check for duplicates
      if (fs.existsSync(targetPath)) {
        logger.warn(`Target path already exists: ${targetPath}`);

        // Check if it's the same file (already moved)
        const sourceSize = await this.getFolderSize(sourcePath);
        const targetSize = await this.getFolderSize(targetPath);

        if (Math.abs(sourceSize - targetSize) < 1024 * 1024) { // Within 1MB difference
          logger.info('Files appear to be duplicates (same size), skipping move');
          return {
            success: true,
            newPath: targetPath,
          };
        }

        // Different files - append counter
        let counter = 1;
        let uniqueTargetPath = targetPath;

        while (fs.existsSync(uniqueTargetPath)) {
          uniqueTargetPath = path.join(libraryPath, `${folderName} (${counter})`);
          counter++;
        }

        logger.info(`Using unique path: ${uniqueTargetPath}`);
        return await this.moveFiles(sourcePath, uniqueTargetPath);
      }

      // Move files to target
      return await this.moveFiles(sourcePath, targetPath);
    } catch (error) {
      logger.error('Failed to organize download:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Move files from source to target
   */
  private async moveFiles(sourcePath: string, targetPath: string): Promise<MoveResult> {
    try {
      logger.info(`Moving files from ${sourcePath} to ${targetPath}`);

      // Create target directory
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      const stats = fs.statSync(sourcePath);

      if (stats.isFile()) {
        // Single file - move it into the target folder
        const fileName = path.basename(sourcePath);
        const targetFile = path.join(targetPath, fileName);

        fs.renameSync(sourcePath, targetFile);
        logger.info(`Moved file: ${sourcePath} -> ${targetFile}`);
      } else if (stats.isDirectory()) {
        // Directory - move all contents
        const files = fs.readdirSync(sourcePath);

        for (const file of files) {
          const sourceFile = path.join(sourcePath, file);
          const targetFile = path.join(targetPath, file);

          fs.renameSync(sourceFile, targetFile);
        }

        logger.info(`Moved directory contents: ${sourcePath} -> ${targetPath}`);

        // Remove empty source directory
        try {
          fs.rmdirSync(sourcePath);
        } catch (err) {
          logger.warn(`Could not remove source directory: ${sourcePath}`, err);
        }
      }

      return {
        success: true,
        newPath: targetPath,
      };
    } catch (error) {
      logger.error('Failed to move files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse folder name to extract title and year
   * Supports patterns like "Game Title (2023)" or just "Game Title"
   */
  private parseFolderName(folderName: string): { title: string; year?: number } {
    // Match pattern: "Title (Year)"
    const yearMatch = folderName.match(/^(.+?)\s*\((\d{4})\)$/);

    if (yearMatch) {
      return {
        title: yearMatch[1].trim(),
        year: parseInt(yearMatch[2], 10),
      };
    }

    // No year found, return the whole name as title
    return {
      title: folderName.trim(),
    };
  }

  /**
   * Scan library folder and return detailed folder information
   */
  async scanLibrary(): Promise<LibraryFolder[]> {
    try {
      const libraryPath = await this.getLibraryPath();

      if (!fs.existsSync(libraryPath)) {
        return [];
      }

      const folderNames = fs.readdirSync(libraryPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      // Get all games from database to check for matches
      const allGames = await gameRepository.findAll();

      // Parse and match each folder
      const libraryFolders: LibraryFolder[] = folderNames.map((folderName) => {
        const parsed = this.parseFolderName(folderName);

        // Try to find a matching game
        const matchedGame = allGames.find((game) => {
          const titleMatch = game.title.toLowerCase() === parsed.title.toLowerCase();

          if (parsed.year && game.year) {
            return titleMatch && game.year === parsed.year;
          }

          return titleMatch;
        });

        return {
          folderName,
          parsedTitle: parsed.title,
          parsedYear: parsed.year,
          matched: !!matchedGame,
          gameId: matchedGame?.id,
          path: path.join(libraryPath, folderName),
        };
      });

      logger.info(`Scanned library: ${libraryFolders.length} folders, ${libraryFolders.filter(f => f.matched).length} matched`);

      return libraryFolders;
    } catch (error) {
      logger.error('Failed to scan library:', error);
      return [];
    }
  }
}

// Singleton instance
export const fileService = new FileService();
