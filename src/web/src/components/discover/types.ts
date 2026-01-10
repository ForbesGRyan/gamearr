export type TabType = 'trending' | 'torrents';

export interface TorrentFilters {
  releaseGroups: string[];
  platformTags: string[];
  languageTags: string[];
  otherPatterns: string[];
}

export interface PopularityType {
  id: number;
  name: string;
  popularity_source: number;
}

export interface MultiplayerInfo {
  hasOnlineCoop: boolean;
  hasOfflineCoop: boolean;
  hasLanCoop: boolean;
  hasSplitscreen: boolean;
  maxOnlinePlayers?: number;
  maxOfflinePlayers?: number;
  hasCampaignCoop: boolean;
  hasDropIn: boolean;
}

export interface GameSearchResult {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  genres?: string[];
  themes?: string[];
  totalRating?: number;
  developer?: string;
  publisher?: string;
  multiplayer?: MultiplayerInfo;
}

export interface PopularGame {
  game: GameSearchResult;
  popularityValue: number;
  popularityType: number;
  rank: number;
  inLibrary: boolean;
}

export interface TorrentRelease {
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  leechers: number;
  publishedAt: string;
  downloadUrl?: string;
  infoUrl?: string;
  quality?: string;
}
