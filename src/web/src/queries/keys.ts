export const queryKeys = {
  games: {
    all: ['games'] as const,
    list: () => [...queryKeys.games.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.games.all, 'detail', id] as const,
    bySlug: (platform: string, slug: string) =>
      [...queryKeys.games.all, 'slug', platform, slug] as const,
    releases: (gameId: number) => [...queryKeys.games.all, gameId, 'releases'] as const,
    history: (gameId: number) => [...queryKeys.games.all, gameId, 'history'] as const,
    updates: (gameId: number) => [...queryKeys.games.all, gameId, 'updates'] as const,
    events: (gameId: number) => [...queryKeys.games.all, gameId, 'events'] as const,
    integrations: (gameId: number) =>
      [...queryKeys.games.all, gameId, 'integrations'] as const,
    folders: (gameId: number) => [...queryKeys.games.all, gameId, 'folders'] as const,
  },
  libraries: {
    all: ['libraries'] as const,
    list: () => [...queryKeys.libraries.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.libraries.all, 'detail', id] as const,
    platforms: () => [...queryKeys.libraries.all, 'platforms'] as const,
    duplicates: () => [...queryKeys.libraries.all, 'duplicates'] as const,
    looseFiles: () => [...queryKeys.libraries.all, 'looseFiles'] as const,
    scanCount: () => [...queryKeys.libraries.all, 'scanCount'] as const,
    healthCount: () => [...queryKeys.libraries.all, 'healthCount'] as const,
  },
  downloads: {
    all: ['downloads'] as const,
    list: (includeCompleted: boolean) =>
      [...queryKeys.downloads.all, 'list', { includeCompleted }] as const,
    detail: (hash: string) => [...queryKeys.downloads.all, 'detail', hash] as const,
  },
  updates: {
    all: ['updates'] as const,
    pending: () => [...queryKeys.updates.all, 'pending'] as const,
  },
  settings: {
    all: ['settings'] as const,
    list: () => [...queryKeys.settings.all, 'list'] as const,
    byKey: (key: string) => [...queryKeys.settings.all, 'key', key] as const,
    categories: () => [...queryKeys.settings.all, 'categories'] as const,
    categoriesSelected: () => [...queryKeys.settings.all, 'categories', 'selected'] as const,
    qbittorrentCategories: () =>
      [...queryKeys.settings.all, 'qbittorrent', 'categories'] as const,
    qbittorrentCategory: () =>
      [...queryKeys.settings.all, 'qbittorrent', 'category'] as const,
  },
  system: {
    all: ['system'] as const,
    status: () => [...queryKeys.system.all, 'status'] as const,
    setupStatus: () => [...queryKeys.system.all, 'setupStatus'] as const,
    appUpdate: () => [...queryKeys.system.all, 'appUpdate'] as const,
    appUpdateSettings: () => [...queryKeys.system.all, 'appUpdateSettings'] as const,
    logs: () => [...queryKeys.system.all, 'logs'] as const,
    logContent: (name: string) => [...queryKeys.system.all, 'logs', name] as const,
  },
  auth: {
    all: ['auth'] as const,
    status: () => [...queryKeys.auth.all, 'status'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
    users: () => [...queryKeys.auth.all, 'users'] as const,
  },
  indexers: {
    all: ['indexers'] as const,
    list: () => [...queryKeys.indexers.all, 'list'] as const,
    topTorrents: (query?: string, limit?: number, maxAgeDays?: number) =>
      [...queryKeys.indexers.all, 'torrents', { query, limit, maxAgeDays }] as const,
  },
  discover: {
    all: ['discover'] as const,
    popularityTypes: () => [...queryKeys.discover.all, 'popularityTypes'] as const,
    popular: (type: number, limit: number) =>
      [...queryKeys.discover.all, 'popular', type, limit] as const,
  },
  search: {
    all: ['search'] as const,
    games: (query: string) => [...queryKeys.search.all, 'games', query] as const,
    releases: (query: string) => [...queryKeys.search.all, 'releases', query] as const,
    releasesForGame: (gameId: number) =>
      [...queryKeys.search.all, 'releases', 'game', gameId] as const,
  },
  steam: {
    all: ['steam'] as const,
    ownedGames: () => [...queryKeys.steam.all, 'ownedGames'] as const,
  },
  gog: {
    all: ['gog'] as const,
    ownedGames: () => [...queryKeys.gog.all, 'ownedGames'] as const,
    authUrl: () => [...queryKeys.gog.all, 'authUrl'] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (params: { status?: string; kind?: string; limit?: number; offset?: number }) =>
      [...queryKeys.tasks.all, 'list', params] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    list: () => [...queryKeys.jobs.all, 'list'] as const,
  },
} as const;
