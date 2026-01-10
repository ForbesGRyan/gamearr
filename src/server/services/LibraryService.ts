import { libraryRepository } from '../repositories/LibraryRepository';
import { settingsService } from './SettingsService';
import { type Library, type NewLibrary } from '../db/schema';
import { logger } from '../utils/logger';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

export interface CreateLibraryInput {
  name: string;
  path: string;
  platform?: string;
  monitored?: boolean;
  downloadEnabled?: boolean;
  downloadCategory?: string;
  priority?: number;
}

export interface UpdateLibraryInput {
  name?: string;
  path?: string;
  platform?: string | null;
  monitored?: boolean;
  downloadEnabled?: boolean;
  downloadCategory?: string | null;
  priority?: number;
}

export class LibraryService {
  /**
   * Get all libraries
   */
  async getAllLibraries(): Promise<Library[]> {
    return libraryRepository.findAll();
  }

  /**
   * Get library by ID
   */
  async getLibrary(id: number): Promise<Library | undefined> {
    return libraryRepository.findById(id);
  }

  /**
   * Get library by path
   */
  async getLibraryByPath(libraryPath: string): Promise<Library | undefined> {
    const normalizedPath = this.normalizePath(libraryPath);
    return libraryRepository.findByPath(normalizedPath);
  }

  /**
   * Get libraries by platform
   */
  async getLibrariesByPlatform(platform: string): Promise<Library[]> {
    return libraryRepository.findByPlatform(platform);
  }

  /**
   * Get monitored libraries
   */
  async getMonitoredLibraries(): Promise<Library[]> {
    return libraryRepository.findMonitored();
  }

  /**
   * Get libraries with downloads enabled
   */
  async getDownloadEnabledLibraries(): Promise<Library[]> {
    return libraryRepository.findDownloadEnabled();
  }

  /**
   * Create a new library
   */
  async createLibrary(input: CreateLibraryInput): Promise<Library> {
    const normalizedPath = this.normalizePath(input.path);

    // Validate path doesn't already exist as a library
    const existingLibrary = await libraryRepository.findByPath(normalizedPath);
    if (existingLibrary) {
      throw new Error(`Library already exists at path: ${normalizedPath}`);
    }

    // Validate path is accessible
    await this.validatePath(normalizedPath);

    // Get next priority if not specified
    let priority = input.priority;
    if (priority === undefined) {
      const libraries = await libraryRepository.findAll();
      priority = libraries.length;
    }

    const library: NewLibrary = {
      name: input.name,
      path: normalizedPath,
      platform: input.platform || null,
      monitored: input.monitored ?? true,
      downloadEnabled: input.downloadEnabled ?? true,
      downloadCategory: input.downloadCategory || 'gamearr',
      priority,
    };

    logger.info(`Creating library: ${library.name} at ${library.path}`);
    return libraryRepository.create(library);
  }

  /**
   * Update a library
   */
  async updateLibrary(id: number, input: UpdateLibraryInput): Promise<Library | undefined> {
    const library = await libraryRepository.findById(id);
    if (!library) {
      throw new Error(`Library not found: ${id}`);
    }

    const updates: Partial<NewLibrary> = {};

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.path !== undefined) {
      const normalizedPath = this.normalizePath(input.path);

      // Check if another library already uses this path
      const existingLibrary = await libraryRepository.findByPath(normalizedPath);
      if (existingLibrary && existingLibrary.id !== id) {
        throw new Error(`Another library already exists at path: ${normalizedPath}`);
      }

      // Validate path is accessible
      await this.validatePath(normalizedPath);
      updates.path = normalizedPath;
    }

    if (input.platform !== undefined) {
      updates.platform = input.platform || null;
    }

    if (input.monitored !== undefined) {
      updates.monitored = input.monitored;
    }

    if (input.downloadEnabled !== undefined) {
      updates.downloadEnabled = input.downloadEnabled;
    }

    if (input.priority !== undefined) {
      updates.priority = input.priority;
    }

    if (input.downloadCategory !== undefined) {
      updates.downloadCategory = input.downloadCategory || 'gamearr';
    }

    logger.info(`Updating library ${id}: ${JSON.stringify(updates)}`);
    return libraryRepository.update(id, updates);
  }

  /**
   * Delete a library
   */
  async deleteLibrary(id: number): Promise<boolean> {
    const library = await libraryRepository.findById(id);
    if (!library) {
      throw new Error(`Library not found: ${id}`);
    }

    logger.info(`Deleting library: ${library.name} (${library.path})`);
    return libraryRepository.delete(id);
  }

  /**
   * Validate that a path exists and is accessible
   */
  async validatePath(libraryPath: string): Promise<void> {
    try {
      const stats = await fsPromises.stat(libraryPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${libraryPath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Path doesn't exist, try to create it
        logger.info(`Library path doesn't exist, creating: ${libraryPath}`);
        await fsPromises.mkdir(libraryPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Test if a path is accessible (without creating it)
   */
  async testPath(libraryPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const normalizedPath = this.normalizePath(libraryPath);
      const stats = await fsPromises.stat(normalizedPath);

      if (!stats.isDirectory()) {
        return { valid: false, error: 'Path is not a directory' };
      }

      // Try to read the directory to ensure we have access
      await fsPromises.readdir(normalizedPath);
      return { valid: true };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return { valid: false, error: 'Path does not exist' };
      }
      if (err.code === 'EACCES') {
        return { valid: false, error: 'Permission denied' };
      }
      return { valid: false, error: err.message };
    }
  }

  /**
   * Normalize a path for consistent storage
   */
  normalizePath(inputPath: string): string {
    // Normalize path separators and resolve relative paths
    const normalized = path.normalize(inputPath);

    // Remove trailing slash
    return normalized.replace(/[/\\]$/, '');
  }

  /**
   * Check if a folder path belongs to a specific library
   */
  async getLibraryForPath(folderPath: string): Promise<Library | undefined> {
    const normalizedFolderPath = this.normalizePath(folderPath);
    const libraries = await libraryRepository.findAll();

    for (const library of libraries) {
      const normalizedLibraryPath = this.normalizePath(library.path);
      if (normalizedFolderPath.startsWith(normalizedLibraryPath)) {
        return library;
      }
    }

    return undefined;
  }

  /**
   * Migrate existing library_path setting to libraries table
   * This is a one-time migration for existing installations
   */
  async migrateFromSingleLibrary(): Promise<Library | null> {
    // Check if we already have libraries
    const existingLibraries = await libraryRepository.findAll();
    if (existingLibraries.length > 0) {
      logger.info('Libraries already exist, skipping migration');
      return null;
    }

    // Get the old library_path setting
    const libraryPath = await settingsService.getSetting('library_path');
    if (!libraryPath) {
      logger.info('No library_path setting found, skipping migration');
      return null;
    }

    logger.info(`Migrating library_path setting to libraries table: ${libraryPath}`);

    // Create a library from the old setting
    const library = await this.createLibrary({
      name: 'Default Library',
      path: libraryPath,
      platform: 'PC',
      monitored: true,
      downloadEnabled: true,
      priority: 0,
    });

    logger.info(`Created library from migration: ${library.name} (ID: ${library.id})`);
    return library;
  }

  /**
   * Get unique platforms across all libraries
   */
  async getUniquePlatforms(): Promise<string[]> {
    const libraries = await libraryRepository.findAll();
    const platforms = new Set<string>();

    for (const library of libraries) {
      if (library.platform) {
        platforms.add(library.platform);
      }
    }

    return Array.from(platforms).sort();
  }

  /**
   * Get the default library for downloads (highest priority download-enabled library)
   */
  async getDefaultDownloadLibrary(): Promise<Library | undefined> {
    const libraries = await libraryRepository.findDownloadEnabled();
    if (libraries.length === 0) {
      return undefined;
    }

    // Sort by priority descending (higher priority first)
    libraries.sort((a, b) => b.priority - a.priority);
    return libraries[0];
  }

  /**
   * Get library for a game based on platform matching or default
   */
  async getLibraryForGame(platform?: string): Promise<Library | undefined> {
    // First try to match by platform
    if (platform) {
      const platformLibraries = await libraryRepository.findByPlatform(platform);
      const downloadEnabled = platformLibraries.filter(l => l.downloadEnabled);
      if (downloadEnabled.length > 0) {
        // Return highest priority platform-matched library
        downloadEnabled.sort((a, b) => b.priority - a.priority);
        return downloadEnabled[0];
      }
    }

    // Fall back to default download library
    return this.getDefaultDownloadLibrary();
  }

  /**
   * Check if any libraries are configured
   */
  async hasLibraries(): Promise<boolean> {
    const libraries = await libraryRepository.findAll();
    return libraries.length > 0;
  }
}

// Singleton instance
export const libraryService = new LibraryService();
