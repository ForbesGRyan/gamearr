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
}
