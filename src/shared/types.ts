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
