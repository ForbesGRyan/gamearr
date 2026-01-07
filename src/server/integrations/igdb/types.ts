// IGDB API response types

export interface IGDBGame {
  id: number;
  name: string;
  cover?: {
    id: number;
    url?: string;
    image_id: string;
  };
  first_release_date?: number; // Unix timestamp
  // Platforms can be array of IDs (when not expanded) or objects (when expanded)
  platforms?: number[] | Array<{
    id: number;
    name: string;
  }>;
  summary?: string;
  storyline?: string;
  genres?: Array<{
    id: number;
    name: string;
  }>;
  rating?: number;
  aggregated_rating?: number;
  total_rating?: number;
  category?: number; // 0 = main game, 1 = DLC, 2 = expansion, etc.
  game_modes?: Array<{
    id: number;
    name: string;
  }>;
  involved_companies?: Array<{
    id: number;
    company: {
      id: number;
      name: string;
    };
    developer: boolean;
    publisher: boolean;
  }>;
  similar_games?: Array<{
    id: number;
    name: string;
    cover?: {
      image_id: string;
    };
  }>;
  multiplayer_modes?: IGDBMultiplayerMode[];
  themes?: Array<{
    id: number;
    name: string;
  }>;
}

export interface IGDBAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface IGDBSearchParams {
  search: string;
  limit?: number;
  offset?: number;
}

export interface GameSearchResult {
  igdbId: number;
  title: string;
  year?: number;
  coverUrl?: string;
  summary?: string;
  platforms?: string[];
  // Extended metadata
  genres?: string[];
  totalRating?: number;
  developer?: string;
  publisher?: string;
  gameModes?: string[];
  similarGames?: Array<{
    igdbId: number;
    name: string;
    coverUrl?: string;
  }>;
  multiplayer?: MultiplayerInfo;
  themes?: string[];
}

// Multiplayer modes
export interface IGDBMultiplayerMode {
  id: number;
  campaigncoop?: boolean;
  dropin?: boolean;
  lancoop?: boolean;
  offlinecoop?: boolean;
  offlinecoopmax?: number;
  offlinemax?: number;
  onlinecoop?: boolean;
  onlinecoopmax?: number;
  onlinemax?: number;
  platform?: number;
  splitscreen?: boolean;
  splitscreenonline?: boolean;
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

// Popularity API types
export interface PopularityType {
  id: number;
  name: string;
  popularity_source: number;
  updated_at?: number;
}

export interface PopularityPrimitive {
  id: number;
  game_id: number;
  popularity_type: number;
  value: number;
}

export interface PopularGame {
  game: GameSearchResult;
  popularityValue: number;
  popularityType: number;
  rank: number;
}
