import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { parseVersion } from '../utils/version';
import { validatePathWithinBase, isPathWithinBase } from '../utils/pathSecurity';
import { settingsService } from './SettingsService';
import { libraryService } from './LibraryService';
import { gameRepository } from '../repositories/GameRepository';
import { libraryFileRepository } from '../repositories/LibraryFileRepository';
import type { Game, LibraryFile, Library } from '../db/schema';

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
  libraryName: string;
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

// Type for game update fields that can be set during folder matching
interface GameUpdateFields {
  status: 'wanted' | 'downloading' | 'downloaded';
  folderPath: string;
  installedVersion?: string;
  libraryId?: number | null;
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
  libraryId?: number;
  libraryName?: string;
  relativePath?: string; // Path relative to library root (e.g., "Switch/Game Name")
}

export class FileService {
  /**
   * Get a library by ID
   */
  async getLibraryById(libraryId: number): Promise<Library | undefined> {
    return libraryService.getLibrary(libraryId);
  }

  /**
   * Get all libraries
   */
  async getAllLibraries(): Promise<Library[]> {
    return libraryService.getAllLibraries();
  }

  /**
   * Get the library path from settings (legacy support) or by library ID
   * If libraryId is provided, returns that library's path
   * Otherwise falls back to legacy library_path setting or first library
   */
  private async getLibraryPath(libraryId?: number): Promise<string> {
    // If libraryId is provided, get that specific library
    if (libraryId !== undefined) {
      const library = await libraryService.getLibrary(libraryId);
      if (!library) {
        throw new Error(`Library not found: ${libraryId}`);
      }
      return library.path;
    }

    // Try to get libraries from new system first
    const libraries = await libraryService.getAllLibraries();
    if (libraries.length > 0) {
      // Return first library's path as default
      return libraries[0].path;
    }

    // Fall back to legacy library_path setting
    const libraryPath = await settingsService.getSetting('library_path');

    if (!libraryPath) {
      throw new Error('No libraries configured. Please add a library in Settings.');
    }

    // Ensure library path exists
    const exists = await this.pathExists(libraryPath);
    if (!exists) {
      logger.info(`Creating library directory: ${libraryPath}`);
      await fsPromises.mkdir(libraryPath, { recursive: true });
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
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get folder size in bytes
   * Note: This method is used internally with trusted paths from database.
   * For user-provided paths, use getFolderSizeWithValidation instead.
   */
  async getFolderSize(folderPath: string): Promise<number> {
    const exists = await this.pathExists(folderPath);
    if (!exists) {
      return 0;
    }

    let totalSize = 0;

    const stats = await fsPromises.stat(folderPath);

    if (stats.isFile()) {
      return stats.size;
    }

    if (stats.isDirectory()) {
      const files = await fsPromises.readdir(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const fileStats = await fsPromises.stat(filePath);

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
   * Get folder size with path validation
   * Validates that the path is within the library before accessing
   */
  async getFolderSizeWithValidation(folderPath: string): Promise<number> {
    const libraryPath = await this.getLibraryPath();
    validatePathWithinBase(folderPath, libraryPath, 'getFolderSize');
    return this.getFolderSize(folderPath);
  }

  /**
   * Move and organize a completed download
   */
  async organizeDownload(game: Game, sourcePath: string): Promise<MoveResult> {
    try {
      logger.info(`Organizing download for game: ${game.title}`);
      logger.info(`Source path: ${sourcePath}`);

      // Check if source exists
      const sourceExists = await this.pathExists(sourcePath);
      if (!sourceExists) {
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
      const targetExists = await this.pathExists(targetPath);
      if (targetExists) {
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

        while (await this.pathExists(uniqueTargetPath)) {
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
      const targetExists = await this.pathExists(targetPath);
      if (!targetExists) {
        await fsPromises.mkdir(targetPath, { recursive: true });
      }

      const stats = await fsPromises.stat(sourcePath);

      if (stats.isFile()) {
        // Single file - move it into the target folder
        const fileName = path.basename(sourcePath);
        const targetFile = path.join(targetPath, fileName);

        await fsPromises.rename(sourcePath, targetFile);
        logger.info(`Moved file: ${sourcePath} -> ${targetFile}`);
      } else if (stats.isDirectory()) {
        // Directory - move all contents
        const files = await fsPromises.readdir(sourcePath);

        for (const file of files) {
          const sourceFile = path.join(sourcePath, file);
          const targetFile = path.join(targetPath, file);

          await fsPromises.rename(sourceFile, targetFile);
        }

        logger.info(`Moved directory contents: ${sourcePath} -> ${targetPath}`);

        // Remove empty source directory
        try {
          await fsPromises.rmdir(sourcePath);
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
   * Parse folder name to extract title, year, and version
   * Supports patterns like "Game Title (2023)" or "Game.Title.v1.2.3-CODEX"
   */
  private parseFolderName(folderName: string): { title: string; year?: number; version?: string } {
    let workingName = folderName;
    let year: number | undefined;
    let version: string | undefined;

    // Extract version first (before cleaning)
    version = parseVersion(workingName) || undefined;

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
   * @param libraryId Optional library ID to filter by
   */
  async getCachedLibraryFiles(libraryId?: number): Promise<LibraryFolder[]> {
    try {
      const cachedFiles = libraryId !== undefined
        ? await libraryFileRepository.findByLibraryId(libraryId)
        : await libraryFileRepository.findAll();

      // Get library info for adding to results
      const libraries = await libraryService.getAllLibraries();
      const libraryMap = new Map(libraries.map(lib => [lib.id, lib]));

      // Filter out ignored folders AND matched folders, then sort alphabetically
      return cachedFiles
        .filter((file) => !file.ignored && !file.matchedGameId)
        .map((file) => {
          const folderName = path.basename(file.folderPath);
          const parsedTitle = file.parsedTitle || '';
          const version = parseVersion(folderName) || undefined;
          const library = file.libraryId ? libraryMap.get(file.libraryId) : undefined;
          return {
            folderName,
            parsedTitle,
            cleanedTitle: this.cleanDisplayTitle(parsedTitle),
            parsedYear: file.parsedYear || undefined,
            parsedVersion: version,
            matched: false, // All results are unmatched
            gameId: undefined,
            path: file.folderPath,
            libraryId: file.libraryId || undefined,
            libraryName: library?.name,
          };
        })
        .sort((a, b) => a.cleanedTitle.localeCompare(b.cleanedTitle, undefined, { sensitivity: 'base' }));
    } catch (error) {
      logger.error('Failed to get cached library files:', error);
      return [];
    }
  }

  /**
   * Refresh library scan and update cache (recursively scans subdirectories)
   * @param libraryId Optional library ID to scan a specific library. If not provided, scans all libraries.
   */
  async refreshLibraryScan(libraryId?: number): Promise<LibraryFolder[]> {
    try {
      // If no libraryId provided, scan all libraries
      if (libraryId === undefined) {
        return this.refreshAllLibrariesScan();
      }

      const library = await libraryService.getLibrary(libraryId);
      if (!library) {
        logger.error(`Library not found: ${libraryId}`);
        return [];
      }

      logger.info(`Refreshing library scan for: ${library.name} (${library.path})`);

      const libraryExists = await this.pathExists(library.path);
      if (!libraryExists) {
        logger.warn(`Library path does not exist: ${library.path}`);
        return [];
      }

      // Get all games from database to check for matches
      const allGames = await gameRepository.findAll();

      // Get existing cached files for this library
      const existingFiles = await libraryFileRepository.findByLibraryId(libraryId);
      const existingPaths = new Set(existingFiles.map((f) => f.folderPath));

      // Parse and cache each folder recursively
      const libraryFolders: LibraryFolder[] = [];
      await this.scanDirectoryForFolders(
        library.path,
        library.path,
        library.name,
        libraryId,
        allGames,
        existingFiles,
        existingPaths,
        libraryFolders
      );

      // Delete cached files that no longer exist in filesystem
      for (const missingPath of existingPaths) {
        logger.info(`Removing cached file that no longer exists: ${missingPath}`);
        await libraryFileRepository.delete(missingPath);
      }

      logger.info(
        `Library scan refreshed: ${libraryFolders.length} unmatched folders in ${library.name}`
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
   * Recursively scan a directory for game folders
   */
  private async scanDirectoryForFolders(
    dirPath: string,
    libraryRoot: string,
    libraryName: string,
    libraryId: number,
    allGames: Array<{ id: number; title: string; year?: number | null }>,
    existingFiles: Array<{ folderPath: string; matchedGameId: number | null; ignored: boolean }>,
    existingPaths: Set<string>,
    libraryFolders: LibraryFolder[]
  ): Promise<void> {
    const dirents = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const subDirs = dirents.filter((dirent) => dirent.isDirectory());

    for (const dirent of subDirs) {
      const folderName = dirent.name;
      const folderPath = path.join(dirPath, folderName);
      const parsed = this.parseFolderName(folderName);

      // Check if this looks like a game folder (has a parseable name)
      // or if it's a category folder (like "Switch", "3DS", etc.)
      const hasGameFiles = await this.hasGameContent(folderPath);

      if (hasGameFiles) {
        // This is a game folder - process it
        const matchedGame = allGames.find((game) => {
          const titleMatch = game.title.toLowerCase() === parsed.title.toLowerCase();
          if (parsed.year && game.year) {
            return titleMatch && game.year === parsed.year;
          }
          return titleMatch;
        });

        const existingFile = existingFiles.find((f) => f.folderPath === folderPath);

        // Upsert to database
        await libraryFileRepository.upsert({
          folderPath,
          parsedTitle: parsed.title,
          parsedYear: parsed.year || null,
          matchedGameId: existingFile?.matchedGameId || matchedGame?.id || null,
          libraryId: libraryId,
          ignored: existingFile?.ignored || false,
        });

        // Only add to results if not ignored AND not matched
        const isMatched = !!(existingFile?.matchedGameId || matchedGame);
        if (!existingFile?.ignored && !isMatched) {
          const relativePath = path.relative(libraryRoot, folderPath);
          libraryFolders.push({
            folderName,
            parsedTitle: parsed.title,
            cleanedTitle: this.cleanDisplayTitle(parsed.title),
            parsedYear: parsed.year,
            parsedVersion: parsed.version,
            matched: false,
            gameId: undefined,
            path: folderPath,
            libraryId: libraryId,
            libraryName: libraryName,
            relativePath: relativePath,
          });
        }

        existingPaths.delete(folderPath);
      } else {
        // This might be a category folder - recurse into it
        try {
          await this.scanDirectoryForFolders(
            folderPath,
            libraryRoot,
            libraryName,
            libraryId,
            allGames,
            existingFiles,
            existingPaths,
            libraryFolders
          );
        } catch (err) {
          logger.warn(`Failed to scan subdirectory ${folderPath}:`, err);
        }
      }
    }
  }

  /**
   * Check if a folder contains game content (files, not just more folders)
   */
  private async hasGameContent(folderPath: string): Promise<boolean> {
    try {
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });
      // A game folder typically has files (executables, data, etc.)
      // A category folder only has subdirectories
      return entries.some((entry) => entry.isFile());
    } catch {
      return false;
    }
  }

  /**
   * Refresh scan for all libraries
   */
  private async refreshAllLibrariesScan(): Promise<LibraryFolder[]> {
    const libraries = await libraryService.getAllLibraries();

    if (libraries.length === 0) {
      // Fall back to legacy single library
      const legacyPath = await settingsService.getSetting('library_path');
      if (!legacyPath) {
        logger.warn('No libraries configured');
        return [];
      }
      // Use legacy scan logic for backwards compatibility
      return this.refreshLegacyLibraryScan(legacyPath);
    }

    const allFolders: LibraryFolder[] = [];

    for (const library of libraries) {
      const folders = await this.refreshLibraryScan(library.id);
      allFolders.push(...folders);
    }

    // Sort alphabetically by cleaned title
    return allFolders.sort((a, b) =>
      a.cleanedTitle.localeCompare(b.cleanedTitle, undefined, { sensitivity: 'base' })
    );
  }

  /**
   * Legacy library scan for backwards compatibility
   */
  private async refreshLegacyLibraryScan(libraryPath: string): Promise<LibraryFolder[]> {
    logger.info(`Refreshing legacy library scan at: ${libraryPath}`);

    const libraryExists = await this.pathExists(libraryPath);
    if (!libraryExists) {
      logger.warn('Library path does not exist');
      return [];
    }

    const dirents = await fsPromises.readdir(libraryPath, { withFileTypes: true });
    const folderNames = dirents
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const allGames = await gameRepository.findAll();
    const existingFiles = await libraryFileRepository.findAll();
    const existingPaths = new Set(existingFiles.map((f) => f.folderPath));
    const libraryFolders: LibraryFolder[] = [];

    for (const folderName of folderNames) {
      const parsed = this.parseFolderName(folderName);
      const folderPath = path.join(libraryPath, folderName);

      const matchedGame = allGames.find((game) => {
        const titleMatch = game.title.toLowerCase() === parsed.title.toLowerCase();
        if (parsed.year && game.year) {
          return titleMatch && game.year === parsed.year;
        }
        return titleMatch;
      });

      const existingFile = existingFiles.find((f) => f.folderPath === folderPath);

      await libraryFileRepository.upsert({
        folderPath,
        parsedTitle: parsed.title,
        parsedYear: parsed.year || null,
        matchedGameId: existingFile?.matchedGameId || matchedGame?.id || null,
        ignored: existingFile?.ignored || false,
      });

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

      existingPaths.delete(folderPath);
    }

    for (const missingPath of existingPaths) {
      logger.info(`Removing cached file that no longer exists: ${missingPath}`);
      await libraryFileRepository.delete(missingPath);
    }

    logger.info(`Legacy library scan refreshed: ${libraryFolders.length} unmatched folders`);

    return libraryFolders.sort((a, b) =>
      a.cleanedTitle.localeCompare(b.cleanedTitle, undefined, { sensitivity: 'base' })
    );
  }

  /**
   * Scan library folder and return detailed folder information
   * This method now uses cached data if available
   * @param libraryId Optional library ID to scan a specific library. If not provided, scans all libraries.
   */
  async scanLibrary(libraryId?: number): Promise<LibraryFolder[]> {
    try {
      // Check if we have cached data for this library
      const cachedFiles = libraryId !== undefined
        ? await libraryFileRepository.findByLibraryId(libraryId)
        : await libraryFileRepository.findAll();

      if (cachedFiles.length > 0) {
        logger.info(`Using cached library data: ${cachedFiles.length} files`);
        return this.getCachedLibraryFiles(libraryId);
      }

      // No cached data, perform fresh scan
      logger.info('No cached data, performing fresh scan');
      return this.refreshLibraryScan(libraryId);
    } catch (error) {
      logger.error('Failed to scan library:', error);
      return [];
    }
  }

  /**
   * Scan all libraries and return combined results
   */
  async scanAllLibraries(): Promise<LibraryFolder[]> {
    const libraries = await libraryService.getAllLibraries();
    const allFolders: LibraryFolder[] = [];

    for (const library of libraries) {
      const folders = await this.scanLibrary(library.id);
      allFolders.push(...folders);
    }

    // Sort alphabetically by cleaned title
    return allFolders.sort((a, b) =>
      a.cleanedTitle.localeCompare(b.cleanedTitle, undefined, { sensitivity: 'base' })
    );
  }

  /**
   * Match a library folder to a game
   * Optionally accepts a version to set as installedVersion
   * @param folderPath Path to the folder to match
   * @param gameId ID of the game to match to
   * @param version Optional version string to set
   * @param libraryId Optional library ID (will be detected from path if not provided)
   */
  async matchFolderToGame(folderPath: string, gameId: number, version?: string, libraryId?: number): Promise<boolean> {
    try {
      logger.info(`Matching folder ${folderPath} to game ID ${gameId}`);

      // Find the library this folder belongs to
      let detectedLibraryId = libraryId;
      if (detectedLibraryId === undefined) {
        const library = await libraryService.getLibraryForPath(folderPath);
        detectedLibraryId = library?.id;
      }

      // Security: Validate that the folder path is within a valid library
      if (detectedLibraryId !== undefined) {
        const library = await libraryService.getLibrary(detectedLibraryId);
        if (library) {
          validatePathWithinBase(folderPath, library.path, 'matchFolderToGame');
        }
      } else {
        // Fall back to legacy validation
        const libraryPath = await this.getLibraryPath();
        validatePathWithinBase(folderPath, libraryPath, 'matchFolderToGame');
      }

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
          libraryId: detectedLibraryId || null,
          ignored: false,
        });
      } else {
        // Update existing entry with the match
        await libraryFileRepository.matchToGame(folderPath, gameId);
      }

      // Update game status to downloaded, set folder path, library, and installed version
      const gameUpdate: GameUpdateFields = {
        status: 'downloaded',
        folderPath: folderPath,
        libraryId: detectedLibraryId,
      };

      if (installedVersion) {
        gameUpdate.installedVersion = installedVersion;
        logger.info(`Setting installed version for game ${gameId}: ${installedVersion}`);
      }

      await gameRepository.update(gameId, gameUpdate);

      logger.info(`Successfully matched folder to game ${gameId} (library: ${detectedLibraryId || 'none'})`);
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
   * Find loose files (archives, ISOs) in all library folders recursively
   */
  async findLooseFiles(): Promise<LooseFile[]> {
    try {
      const libraries = await libraryService.getAllLibraries();
      if (libraries.length === 0) {
        return [];
      }

      const looseFiles: LooseFile[] = [];

      for (const library of libraries) {
        const libraryExists = await this.pathExists(library.path);
        if (!libraryExists) {
          continue;
        }

        try {
          await this.scanDirectoryForLooseFiles(library.path, library.path, library.name, looseFiles);
        } catch (err) {
          logger.warn(`Failed to scan library ${library.name} for loose files:`, err);
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
   * Recursively scan a directory for loose files
   */
  private async scanDirectoryForLooseFiles(
    dirPath: string,
    libraryRoot: string,
    libraryName: string,
    looseFiles: LooseFile[]
  ): Promise<void> {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        try {
          await this.scanDirectoryForLooseFiles(fullPath, libraryRoot, libraryName, looseFiles);
        } catch (err) {
          logger.warn(`Failed to scan subdirectory ${fullPath}:`, err);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        if (LOOSE_FILE_EXTENSIONS.includes(ext)) {
          const stats = await fsPromises.stat(fullPath);
          // Get relative path from library root for display
          const relativePath = path.relative(libraryRoot, dirPath);
          const folderDisplay = relativePath ? `${libraryName}/${relativePath}` : libraryName;

          looseFiles.push({
            path: fullPath,
            name: entry.name,
            extension: ext,
            size: stats.size,
            modifiedAt: Math.floor(stats.mtimeMs / 1000),
            libraryName: folderDisplay,
          });
        }
      }
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

      // Collect unique folder paths that need size calculation
      const uniqueFolderPaths = new Set<string>();
      for (const game of games) {
        if (game.folderPath) {
          uniqueFolderPaths.add(game.folderPath);
        }
      }

      // Batch check path existence in parallel (fixes N+1 I/O pattern)
      const pathExistsResults = await Promise.all(
        [...uniqueFolderPaths].map(async (folderPath) => ({
          path: folderPath,
          exists: await this.pathExists(folderPath),
        }))
      );

      // Build set of existing paths
      const existingPaths = new Set<string>(
        pathExistsResults.filter((r) => r.exists).map((r) => r.path)
      );

      // Batch calculate folder sizes in parallel (only for existing paths)
      const sizeResults = await Promise.all(
        [...existingPaths].map(async (folderPath) => ({
          path: folderPath,
          size: await this.getFolderSize(folderPath),
        }))
      );

      // Build folder size cache from parallel results
      const folderSizeCache = new Map<string, number>(
        sizeResults.map((r) => [r.path, r.size])
      );

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
            // Get folder sizes from pre-calculated cache
            const size1 = game1.folderPath ? folderSizeCache.get(game1.folderPath) : undefined;
            const size2 = game2.folderPath ? folderSizeCache.get(game2.folderPath) : undefined;

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
      // Security: Validate that the file path is within the library
      const libraryPath = await this.getLibraryPath();
      validatePathWithinBase(filePath, libraryPath, 'organizeLooseFile');

      const fileExists = await this.pathExists(filePath);
      if (!fileExists) {
        return { success: false, error: 'File not found' };
      }

      const stats = await fsPromises.stat(filePath);
      if (!stats.isFile()) {
        return { success: false, error: 'Path is not a file' };
      }

      const fileName = path.basename(filePath);
      const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
      const parentDir = path.dirname(filePath);

      // Create folder with the file name (without extension)
      const newFolderPath = path.join(parentDir, fileNameWithoutExt);

      const folderExists = await this.pathExists(newFolderPath);
      if (folderExists) {
        // Folder already exists, just move the file
        const targetPath = path.join(newFolderPath, fileName);
        const targetExists = await this.pathExists(targetPath);
        if (targetExists) {
          return { success: false, error: 'File already exists in target folder' };
        }
        await fsPromises.rename(filePath, targetPath);
        logger.info(`Moved ${fileName} into existing folder ${fileNameWithoutExt}`);
      } else {
        // Create the folder and move the file
        await fsPromises.mkdir(newFolderPath, { recursive: true });
        const targetPath = path.join(newFolderPath, fileName);
        await fsPromises.rename(filePath, targetPath);
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
