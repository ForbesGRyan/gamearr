// SABnzbd API types

export interface SabnzbdConfig {
  host: string;
  apiKey: string;
}

export interface SabnzbdQueueSlot {
  nzo_id: string;
  filename: string;
  status: string; // Downloading, Queued, Paused, Fetching
  percentage: string; // "0" to "100"
  mb: string;
  mbleft: string;
  sizeleft: string;
  timeleft: string;
  cat: string;
  priority: string;
}

export interface SabnzbdHistorySlot {
  nzo_id: string;
  name: string;
  status: string; // Completed, Failed
  category: string;
  storage: string; // Final path
  bytes: number;
  completed: number; // Unix timestamp
}

export interface SabnzbdQueueResponse {
  queue: {
    slots: SabnzbdQueueSlot[];
    speed: string;
    status: string;
    noofslots_total: number;
  };
}

export interface SabnzbdHistoryResponse {
  history: {
    slots: SabnzbdHistorySlot[];
    noofslots: number;
  };
}

export interface SabnzbdAddResponse {
  status: boolean;
  nzo_ids: string[];
}

export interface SabnzbdVersionResponse {
  version: string;
}

export interface SabnzbdCategoriesResponse {
  categories: string[];
}

export interface NzbDownloadInfo {
  id: string; // nzo_id
  name: string;
  size: number;
  progress: number; // 0-1 (normalized from 0-100)
  downloadSpeed: number;
  eta: string;
  status: string;
  category: string;
  addedOn?: Date;
  completionOn?: Date;
  savePath?: string;
  client: 'sabnzbd';
}

export interface AddNzbOptions {
  category?: string;
  priority?: number; // -100 (default), -2 (paused), -1 (low), 0 (normal), 1 (high), 2 (force)
}
