// Prowlarr API types

export interface ProwlarrSearchParams {
  query: string;
  indexerIds?: number[];
  categories?: number[];
  limit?: number;
  offset?: number;
  type?: 'search' | 'tvsearch' | 'movie';
}

export interface ProwlarrRssParams {
  indexerIds?: number[];
  categories?: number[];
  limit?: number;
}

export interface ProwlarrRelease {
  guid: string;
  title: string;
  indexerId: number;
  indexer: string;
  size: number;
  publishDate: string;
  downloadUrl: string;
  magnetUrl?: string;
  infoUrl?: string;
  seeders?: number;
  leechers?: number;
  categories?: number[];
  protocol: 'torrent' | 'usenet';
}

export interface ProwlarrIndexer {
  id: number;
  name: string;
  enable: boolean;
  protocol: 'torrent' | 'usenet';
  privacy: 'public' | 'private' | 'semiPrivate';
  capabilities?: {
    categories?: Array<{
      id: number;
      name: string;
    }>;
  };
}

export interface ReleaseSearchResult {
  guid: string;
  title: string;
  indexer: string;
  size: number;
  seeders: number;
  downloadUrl: string;
  publishedAt: Date;
  quality?: string;
}
