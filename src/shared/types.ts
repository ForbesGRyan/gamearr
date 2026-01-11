import { z } from 'zod';

// Game schemas
export const GameSchema = z.object({
  id: z.number().optional(),
  igdbId: z.number(),
  title: z.string(),
  year: z.number().optional(),
  platform: z.string(),
  monitored: z.boolean().default(true),
  status: z.enum(['wanted', 'downloading', 'downloaded']),
  coverUrl: z.string().optional(),
  folderPath: z.string().optional(),
  addedAt: z.date().optional(),
});

export type Game = z.infer<typeof GameSchema>;

// Release schemas
export const ReleaseSchema = z.object({
  id: z.number().optional(),
  gameId: z.number(),
  title: z.string(),
  size: z.number().optional(),
  seeders: z.number().optional(),
  downloadUrl: z.string(),
  indexer: z.string(),
  quality: z.string().optional(),
  grabbedAt: z.date().optional(),
  status: z.enum(['pending', 'downloading', 'completed', 'failed']),
});

export type Release = z.infer<typeof ReleaseSchema>;

// Download history schemas
export const DownloadHistorySchema = z.object({
  id: z.number().optional(),
  gameId: z.number(),
  releaseId: z.number(),
  downloadId: z.string(),
  status: z.string(),
  progress: z.number().default(0),
  completedAt: z.date().optional(),
});

export type DownloadHistory = z.infer<typeof DownloadHistorySchema>;

// Settings schemas
export const SettingsSchema = z.object({
  id: z.number().optional(),
  key: z.string(),
  value: z.string(), // JSON string
});

export type Settings = z.infer<typeof SettingsSchema>;

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Steam Import SSE Event Types
// Used by both server (src/server/routes/steam.ts) and client (src/web/src/api/client.ts)

/**
 * Progress event sent during Steam import
 */
export interface SteamImportProgressEvent {
  type: 'progress';
  current: number;
  total: number;
  game: string;
  status: 'searching' | 'imported' | 'skipped' | 'error';
}

/**
 * Completion event sent when Steam import finishes
 */
export interface SteamImportCompleteEvent {
  type: 'complete';
  imported: number;
  skipped: number;
  errors?: string[];
}

/**
 * Error event sent when Steam import encounters a fatal error
 */
export interface SteamImportErrorEvent {
  type: 'error';
  message: string;
}

/**
 * Union of all Steam import SSE event types
 */
export type SteamImportSSEEvent =
  | SteamImportProgressEvent
  | SteamImportCompleteEvent
  | SteamImportErrorEvent;

// GOG Import SSE Event Types
// Used by both server (src/server/routes/gog.ts) and client (src/web/src/api/client.ts)

/**
 * Progress event sent during GOG import
 */
export interface GogImportProgressEvent {
  type: 'progress';
  current: number;
  total: number;
  game: string;
  status: 'searching' | 'imported' | 'skipped' | 'error';
}

/**
 * Completion event sent when GOG import finishes
 */
export interface GogImportCompleteEvent {
  type: 'complete';
  imported: number;
  skipped: number;
  errors?: string[];
}

/**
 * Error event sent when GOG import encounters a fatal error
 */
export interface GogImportErrorEvent {
  type: 'error';
  message: string;
}

/**
 * Union of all GOG import SSE event types
 */
export type GogImportSSEEvent =
  | GogImportProgressEvent
  | GogImportCompleteEvent
  | GogImportErrorEvent;
