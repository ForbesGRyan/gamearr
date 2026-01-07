import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { settingsService } from './SettingsService';
import { gameRepository } from '../repositories/GameRepository';
import { libraryFileRepository } from '../repositories/LibraryFileRepository';
import type { Game, LibraryFile } from '../db/schema';

export interface MoveResult {
  success: boolean;
  newPath?: string;
  error?: string;
}

export interface LooseFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: number;
}

export interface DuplicateGameInfo {
  id: number;
  title: string;
  year?: number;
  status: string;
  folderPath?: string;
  size?: number;
}

export interface DuplicateGroup {
  games: DuplicateGameInfo[];
  similarity: number;
}

// Loose file extensions to detect
const LOOSE_FILE_EXTENSIONS = [
  '.iso', '.rar', '.zip', '.7z', '.tar', '.gz', '.bin', '.cue', '.nrg'
];

export interface LibraryFolder {
  folderName: string;
  parsedTitle: string;
  cleanedTitle: string;
  parsedYear?: number;
  parsedVersion?: string;
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
   * Parse version number from a string (folder name or release title)
   * Returns null if no version pattern is found
   */
  parseVersion(text: string): string | null {
    const patterns = [
      /[._\s]v(\d+(?:\.\d+)+)/i,           // v1.2.3 or v1.2 (with separator before)
      /[._\s]v(\d+)(?:[._\s-]|$)/i,        // v1 alone (single number version)
      /version[.\s_]?(\d+(?:\.\d+)*)/i,    // version 1.2.3 or version.1.2
      /[._\s](\d+\.\d+\.\d+)(?:[._\s-]|$)/, // 1.2.3 (semantic versioning)
      /build[.\s_]?(\d+)/i,                // build 123 or build.123
      /update[.\s_]?(\d+)/i,               // update 5 or update.5
      /[._\s]u(\d+)(?:[._\s-]|$)/i,        // u5 (short for update)
      /[._\s]r(\d+)(?:[._\s-]|$)/i,        // r5 (revision)
      /patch[.\s_]?(\d+(?:\.\d+)*)/i,      // patch 1.2 or patch.1
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
   * Parse folder name to extract title, year, and version
   * Supports patterns like "Game Title (2023)" or "Game.Title.v1.2.3-CODEX"
   */
  private parseFolderName(folderName: string): { title: string; year?: number; version?: string } {
    let workingName = folderName;
    let year: number | undefined;
    let version: string | undefined;

    // Extract version first (before cleaning)
    version = this.parseVersion(workingName) || undefined;

    // Match pattern: "Title (Year)" at the end
    const yearMatch = workingName.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    if (yearMatch) {
      workingName = yearMatch[1].trim();
      year = parseInt(yearMatch[2], 10);
    }

    // Also check for year in the middle: "Title (Year) v1.2.3"
    const yearMiddleMatch = workingName.match(/^(.+?)\s*\((\d{4})\)\s*(.*)$/);
    if (yearMiddleMatch && !year) {
      workingName = (yearMiddleMatch[1] + ' ' + yearMiddleMatch[3]).trim();
      year = parseInt(yearMiddleMatch[2], 10);
    }

    // Clean the title by removing version patterns and scene tags
    let title = workingName;

    // Remove version patterns from title
    const versionPatterns = [
      /[._\s]v\d+(?:\.\d+)*/gi,
      /[._\s]version[.\s_]?\d+(?:\.\d+)*/gi,
      /[._\s]\d+\.\d+\.\d+/g,
      /[._\s]build[.\s_]?\d+/gi,
      /[._\s]update[.\s_]?\d+/gi,
      /[._\s]patch[.\s_]?\d+(?:\.\d+)*/gi,
      /[._\s][ur]\d+(?=[._\s-]|$)/gi,
    ];

    for (const pattern of versionPatterns) {
      title = title.replace(pattern, '');
    }

    // Remove scene tags
    const sceneTags = [
      /-CODEX$/i, /-PLAZA$/i, /-SKIDROW$/i, /-RELOADED$/i, /-FitGirl$/i,
      /-DODI$/i, /-ElAmigos$/i, /-GOG$/i, /-DARKSiDERS$/i, /-EMPRESS$/i,
      /-Razor1911$/i, /-RUNE$/i, /-TiNYiSO$/i, /-HOODLUM$/i,
      /\[GOG\]/gi, /\[REPACK\]/gi, /\[MULTI\d*\]/gi, /\[R\.G\.[^\]]+\]/gi,
    ];

    for (const tag of sceneTags) {
      title = title.replace(tag, '');
    }

    // Replace dots and underscores with spaces, normalize whitespace
    title = title.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

    return { title, year, version };
  }

  /**
   * Clean up a title for display purposes
   * Removes common scene tags, replaces separators with spaces, fixes capitalization
   */
  private cleanDisplayTitle(title: string): string {
    let cleaned = title;

    // Remove common scene/release tags
    const tagsToRemove = [
      /\[GOG\]/gi,
      /\[REPACK\]/gi,
      /\[MULTI\d*\]/gi,
      /\[R\.G\.[^\]]+\]/gi,
      /-CODEX$/i,
      /-PLAZA$/i,
      /-SKIDROW$/i,
      /-RELOADED$/i,
      /-FitGirl$/i,
      /-DODI$/i,
      /-ElAmigos$/i,
      /-GOG$/i,
      /-DARKSiDERS$/i,
      /-EMPRESS$/i,
      /-Razor1911$/i,
      /\.v?\d+(\.\d+)*$/i, // Version numbers like .v1.2.3
    ];

    for (const tag of tagsToRemove) {
      cleaned = cleaned.replace(tag, '');
    }

    // Replace dots and underscores with spaces
    cleaned = cleaned.replace(/[._]/g, ' ');

    // Remove multiple spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Get cached library files from database (excluding ignored and matched)
   * This is for the import page - only shows unmatched folders
   */
  async getCachedLibraryFiles(): Promise<LibraryFolder[]> {
    try {
      const cachedFiles = await libraryFileRepository.findAll();

      // Filter out ignored folders AND matched folders, then sort alphabetically
      return cachedFiles
        .filter((file) => !file.ignored && !file.matchedGameId)
        .map((file) => {
          const folderName = path.basename(file.folderPath);
          const parsedTitle = file.parsedTitle || '';
          const version = this.parseVersion(folderName) || undefined;
          return {
            folderName,
            parsedTitle,
            cleanedTitle: this.cleanDisplayTitle(parsedTitle),
            parsedYear: file.parsedYear || undefined,
            parsedVersion: version,
            matched: false, // All results are unmatched
            gameId: undefined,
            path: file.folderPath,
          };
        })
        .sort((a, b) => a.cleanedTitle.localeCompare(b.cleanedTitle, undefined, { sensitivity: 'base' }));
    } catch (error) {
      logger.error('Failed to get cached library files:', error);
      return [];
    }
  }

  /**
   * Refresh library scan and update cache
   */
  async refreshLibraryScan(): Promise<LibraryFolder[]> {
    try {
      logger.info('Refreshing library scan...');

      const libraryPath = await this.getLibraryPath();

      if (!fs.existsSync(libraryPath)) {
        logger.warn('Library path does not exist');
        return [];
      }

      const folderNames = fs.readdirSync(libraryPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      // Get all games from database to check for matches
      const allGames = await gameRepository.findAll();

      // Get existing cached files
      const existingFiles = await libraryFileRepository.findAll();
      const existingPaths = new Set(existingFiles.map((f) => f.folderPath));

      // Parse and cache each folder
      const libraryFolders: LibraryFolder[] = [];

      for (const folderName of folderNames) {
        const parsed = this.parseFolderName(folderName);
        const folderPath = path.join(libraryPath, folderName);

        // Try to find a matching game
        const matchedGame = allGames.find((game) => {
          const titleMatch = game.title.toLowerCase() === parsed.title.toLowerCase();

          if (parsed.year && game.year) {
            return titleMatch && game.year === parsed.year;
          }

          return titleMatch;
        });

        // Check if we have existing match data
        const existingFile = existingFiles.find((f) => f.folderPath === folderPath);

        // Upsert to database - preserve ignored status
        await libraryFileRepository.upsert({
          folderPath,
          parsedTitle: parsed.title,
          parsedYear: parsed.year || null,
          matchedGameId: existingFile?.matchedGameId || matchedGame?.id || null,
          ignored: existingFile?.ignored || false, // Preserve ignored status
        });

        // Only add to results if not ignored AND not matched
        // This makes it an "import" page showing only folders that need matching
        const isMatched = !!(existingFile?.matchedGameId || matchedGame);
        if (!existingFile?.ignored && !isMatched) {
          libraryFolders.push({
            folderName,
            parsedTitle: parsed.title,
            cleanedTitle: this.cleanDisplayTitle(parsed.title),
            parsedYear: parsed.year,
            parsedVersion: parsed.version,
            matched: false,
            gameId: undefined,
            path: folderPath,
          });
        }

        // Remove from existing paths set
        existingPaths.delete(folderPath);
      }

      // Delete cached files that no longer exist in filesystem
      for (const missingPath of existingPaths) {
        logger.info(`Removing cached file that no longer exists: ${missingPath}`);
        await libraryFileRepository.delete(missingPath);
      }

      logger.info(
        `Library scan refreshed: ${libraryFolders.length} folders, ${libraryFolders.filter((f) => f.matched).length} matched`
      );

      // Sort alphabetically by cleaned title for consistent display
      return libraryFolders.sort((a, b) =>
        a.cleanedTitle.localeCompare(b.cleanedTitle, undefined, { sensitivity: 'base' })
      );
    } catch (error) {
      logger.error('Failed to refresh library scan:', error);
      return [];
    }
  }

  /**
   * Scan library folder and return detailed folder information
   * This method now uses cached data if available
   */
  async scanLibrary(): Promise<LibraryFolder[]> {
    try {
      // Check if we have cached data
      const cachedFiles = await libraryFileRepository.findAll();

      if (cachedFiles.length > 0) {
        logger.info(`Using cached library data: ${cachedFiles.length} files`);
        return this.getCachedLibraryFiles();
      }

      // No cached data, perform fresh scan
      logger.info('No cached data, performing fresh scan');
      return this.refreshLibraryScan();
    } catch (error) {
      logger.error('Failed to scan library:', error);
      return [];
    }
  }

  /**
   * Match a library folder to a game
   * Optionally accepts a version to set as installedVersion
   */
  async matchFolderToGame(folderPath: string, gameId: number, version?: string): Promise<boolean> {
    try {
      logger.info(`Matching folder ${folderPath} to game ID ${gameId}`);

      // Parse folder name to extract title, year, and version
      const folderName = path.basename(folderPath);
      const parsed = this.parseFolderName(folderName);

      // Use provided version, or parsed version, or undefined
      const installedVersion = version || parsed.version;

      // Ensure the folder exists in library_files table
      const existingFile = await libraryFileRepository.findByPath(folderPath);

      if (!existingFile) {
        logger.info(`Folder not in cache, adding it: ${folderPath}`);

        // Create the library file entry
        await libraryFileRepository.upsert({
          folderPath,
          parsedTitle: parsed.title,
          parsedYear: parsed.year || null,
          matchedGameId: gameId,
          ignored: false,
        });
      } else {
        // Update existing entry with the match
        await libraryFileRepository.matchToGame(folderPath, gameId);
      }

      // Update game status to downloaded, set folder path, and set installed version if found
      const gameUpdate: Record<string, any> = {
        status: 'downloaded',
        folderPath: folderPath,
      };

      if (installedVersion) {
        gameUpdate.installedVersion = installedVersion;
        logger.info(`Setting installed version for game ${gameId}: ${installedVersion}`);
      }

      await gameRepository.update(gameId, gameUpdate);

      logger.info(`Successfully matched folder to game ${gameId}`);
      return true;
    } catch (error) {
      logger.error('Failed to match folder to game:', error);
      return false;
    }
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns a value between 0 and 100 (percentage similarity)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 100;

    const len1 = s1.length;
    const len2 = s2.length;

    // Create distance matrix
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);

    return Math.round((1 - distance / maxLen) * 100);
  }

  /**
   * Find loose files (archives, ISOs) in the library folder
   */
  async findLooseFiles(): Promise<LooseFile[]> {
    try {
      const libraryPath = await this.getLibraryPath();

      if (!fs.existsSync(libraryPath)) {
        return [];
      }

      const entries = fs.readdirSync(libraryPath, { withFileTypes: true });
      const looseFiles: LooseFile[] = [];

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();

          if (LOOSE_FILE_EXTENSIONS.includes(ext)) {
            const filePath = path.join(libraryPath, entry.name);
            const stats = fs.statSync(filePath);

            looseFiles.push({
              path: filePath,
              name: entry.name,
              extension: ext,
              size: stats.size,
              modifiedAt: Math.floor(stats.mtimeMs / 1000),
            });
          }
        }
      }

      // Sort by size descending
      return looseFiles.sort((a, b) => b.size - a.size);
    } catch (error) {
      logger.error('Failed to find loose files:', error);
      return [];
    }
  }

  /**
   * Find potential duplicate games based on title similarity
   */
  async findDuplicateGames(): Promise<DuplicateGroup[]> {
    try {
      const games = await gameRepository.findAll();

      if (games.length < 2) {
        return [];
      }

      const duplicateGroups: DuplicateGroup[] = [];
      const processedPairs = new Set<string>();

      for (let i = 0; i < games.length; i++) {
        for (let j = i + 1; j < games.length; j++) {
          const game1 = games[i];
          const game2 = games[j];

          // Create a unique pair key to avoid duplicates
          const pairKey = [game1.id, game2.id].sort().join('-');
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);

          const similarity = this.calculateSimilarity(game1.title, game2.title);

          // Only flag as duplicate if >80% similar
          if (similarity >= 80) {
            // Get folder sizes if paths exist
            let size1: number | undefined;
            let size2: number | undefined;

            if (game1.folderPath && fs.existsSync(game1.folderPath)) {
              size1 = await this.getFolderSize(game1.folderPath);
            }

            if (game2.folderPath && fs.existsSync(game2.folderPath)) {
              size2 = await this.getFolderSize(game2.folderPath);
            }

            duplicateGroups.push({
              games: [
                {
                  id: game1.id,
                  title: game1.title,
                  year: game1.year || undefined,
                  status: game1.status,
                  folderPath: game1.folderPath || undefined,
                  size: size1,
                },
                {
                  id: game2.id,
                  title: game2.title,
                  year: game2.year || undefined,
                  status: game2.status,
                  folderPath: game2.folderPath || undefined,
                  size: size2,
                },
              ],
              similarity,
            });
          }
        }
      }

      // Sort by similarity descending
      return duplicateGroups.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      logger.error('Failed to find duplicate games:', error);
      return [];
    }
  }

  /**
   * Organize a loose file by creating a folder and moving the file into it
   */
  async organizeLooseFile(filePath: string): Promise<MoveResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return { success: false, error: 'Path is not a file' };
      }

      const fileName = path.basename(filePath);
      const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
      const parentDir = path.dirname(filePath);

      // Create folder with the file name (without extension)
      const newFolderPath = path.join(parentDir, fileNameWithoutExt);

      if (fs.existsSync(newFolderPath)) {
        // Folder already exists, just move the file
        const targetPath = path.join(newFolderPath, fileName);
        if (fs.existsSync(targetPath)) {
          return { success: false, error: 'File already exists in target folder' };
        }
        fs.renameSync(filePath, targetPath);
        logger.info(`Moved ${fileName} into existing folder ${fileNameWithoutExt}`);
      } else {
        // Create the folder and move the file
        fs.mkdirSync(newFolderPath, { recursive: true });
        const targetPath = path.join(newFolderPath, fileName);
        fs.renameSync(filePath, targetPath);
        logger.info(`Created folder ${fileNameWithoutExt} and moved ${fileName} into it`);
      }

      return { success: true, newPath: newFolderPath };
    } catch (error) {
      logger.error('Failed to organize loose file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const fileService = new FileService();
