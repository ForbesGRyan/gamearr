// qBittorrent Web API types

export interface QBittorrentAuthConfig {
  host: string;
  username: string;
  password: string;
}

export interface QBittorrentTorrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  priority: number;
  num_seeds: number;
  num_leechs: number;
  ratio: number;
  eta: number;
  state: string;
  seq_dl: boolean;
  f_l_piece_prio: boolean;
  category: string;
  tags: string;
  save_path: string;
  added_on: number;
  completion_on: number;
  tracker: string;
  dl_limit: number;
  up_limit: number;
  downloaded: number;
  uploaded: number;
  downloaded_session: number;
  uploaded_session: number;
  amount_left: number;
  completed: number;
  max_ratio: number;
  max_seeding_time: number;
  ratio_limit: number;
  seeding_time_limit: number;
  seen_complete: number;
  last_activity: number;
}

export interface AddTorrentOptions {
  urls?: string;
  torrents?: Blob;
  savepath?: string;
  cookie?: string;
  category?: string;
  tags?: string;
  skip_checking?: string;
  paused?: string;
  root_folder?: string;
  rename?: string;
  upLimit?: number;
  dlLimit?: number;
  ratioLimit?: number;
  seedingTimeLimit?: number;
  autoTMM?: boolean;
  sequentialDownload?: string;
  firstLastPiecePrio?: string;
}

export interface TorrentInfo {
  hash: string;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  state: TorrentState;
  category: string;
  savePath: string;
  addedOn: Date;
  completionOn?: Date;
}

export type TorrentState =
  | 'error'
  | 'missingFiles'
  | 'uploading'
  | 'pausedUP'
  | 'queuedUP'
  | 'stalledUP'
  | 'checkingUP'
  | 'forcedUP'
  | 'allocating'
  | 'downloading'
  | 'metaDL'
  | 'pausedDL'
  | 'queuedDL'
  | 'stalledDL'
  | 'checkingDL'
  | 'forcedDL'
  | 'checkingResumeData'
  | 'moving';
