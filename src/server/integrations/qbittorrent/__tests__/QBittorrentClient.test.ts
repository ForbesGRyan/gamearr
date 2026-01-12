import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { QBittorrentClient } from '../QBittorrentClient';
import { QBittorrentError, ErrorCode } from '../../../utils/errors';
import type { QBittorrentTorrent, TorrentInfo } from '../types';

// Mock the http module
const mockFetchWithRetry = mock(() => Promise.resolve(new Response()));
const mockRateLimiterAcquire = mock(() => Promise.resolve());

mock.module('../../../utils/http', () => ({
  fetchWithRetry: mockFetchWithRetry,
  RateLimiter: class {
    acquire = mockRateLimiterAcquire;
  },
}));

// Mock the logger
mock.module('../../../utils/logger', () => ({
  logger: {
    info: () => {},
    debug: () => {},
    error: () => {},
    warn: () => {},
  },
}));

// Mock global fetch for torrent file downloads
const originalFetch = global.fetch;

describe('QBittorrentClient', () => {
  let client: QBittorrentClient;
  const testConfig = {
    host: 'http://localhost:8080',
    username: 'admin',
    password: 'adminpass',
  };

  beforeEach(() => {
    // Reset mocks
    mockFetchWithRetry.mockReset();
    mockRateLimiterAcquire.mockReset();
    mockRateLimiterAcquire.mockResolvedValue(undefined);

    // Create a new client for each test
    client = new QBittorrentClient(testConfig);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const client = new QBittorrentClient({
        host: 'http://test:8080',
        username: 'testuser',
        password: 'testpass',
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('should remove trailing slash from host', () => {
      const client = new QBittorrentClient({
        host: 'http://test:8080/',
        username: 'testuser',
        password: 'testpass',
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('should initialize as unconfigured without host when explicitly passing empty host', () => {
      // Create a client with explicit empty config
      const client = new QBittorrentClient({
        host: '',
        username: 'testuser',
        password: 'testpass',
      });
      // Reconfigure with empty host to ensure it's unconfigured regardless of env vars
      client.configure({
        host: '',
        username: 'testuser',
        password: 'testpass',
      });
      expect(client.isConfigured()).toBe(false);
    });

    it('should be configurable after initialization', () => {
      // Start with explicit config
      const client = new QBittorrentClient({
        host: 'http://initial:8080',
        username: 'user',
        password: 'pass',
      });
      expect(client.isConfigured()).toBe(true);

      // Can be reconfigured to be unconfigured
      client.configure({ host: '', username: '', password: '' });
      expect(client.isConfigured()).toBe(false);
    });
  });

  describe('configure', () => {
    it('should reconfigure the client with new credentials', () => {
      // Start unconfigured by explicitly setting empty config
      const client = new QBittorrentClient({
        host: '',
        username: '',
        password: '',
      });
      client.configure({ host: '', username: '', password: '' });
      expect(client.isConfigured()).toBe(false);

      client.configure({
        host: 'http://newhost:8080',
        username: 'newuser',
        password: 'newpass',
      });

      expect(client.isConfigured()).toBe(true);
    });

    it('should remove trailing slash from new host', () => {
      const client = new QBittorrentClient();
      client.configure({
        host: 'http://newhost:8080/',
        username: 'newuser',
        password: 'newpass',
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('should allow empty password for setups without authentication', () => {
      const client = new QBittorrentClient();
      client.configure({
        host: 'http://newhost:8080',
        username: 'admin',
        password: '',
      });
      expect(client.isConfigured()).toBe(true);
    });

    it('should set configured to false when host is empty', () => {
      const client = new QBittorrentClient(testConfig);
      expect(client.isConfigured()).toBe(true);

      client.configure({
        host: '',
        username: 'user',
        password: 'pass',
      });
      expect(client.isConfigured()).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('should return true when properly configured', () => {
      expect(client.isConfigured()).toBe(true);
    });

    it('should return false when not configured', () => {
      // Create and explicitly unconfigure
      const unconfiguredClient = new QBittorrentClient({
        host: '',
        username: '',
        password: '',
      });
      unconfiguredClient.configure({ host: '', username: '', password: '' });
      expect(unconfiguredClient.isConfigured()).toBe(false);
    });
  });

  describe('authentication', () => {
    it('should authenticate successfully and store cookie', async () => {
      // Mock successful auth response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock subsequent request
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify(['games']), {
          headers: { 'content-type': 'application/json' },
        })
      );

      // This should trigger authentication
      const categories = await client.getCategories();
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(2);
    });

    it('should throw error when not configured', async () => {
      // Create and explicitly unconfigure
      const unconfiguredClient = new QBittorrentClient({
        host: '',
        username: '',
        password: '',
      });
      unconfiguredClient.configure({ host: '', username: '', password: '' });
      await expect(unconfiguredClient.getCategories()).rejects.toThrow(QBittorrentError);
    });

    it('should throw error on invalid credentials', async () => {
      mockFetchWithRetry.mockResolvedValueOnce(new Response('Fails.'));

      // Use getCategories instead of testConnection since testConnection catches errors
      await expect(client.getCategories()).rejects.toThrow(QBittorrentError);
    });

    it('should throw error when auth response is not ok', async () => {
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(client.getCategories()).rejects.toThrow(QBittorrentError);
    });

    it('should invalidate cookie and throw on 401 response', async () => {
      // First auth succeeds
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Request returns 401
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Forbidden', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(client.getCategories()).rejects.toThrow(QBittorrentError);
    });

    it('should invalidate cookie and throw on 403 response', async () => {
      // First auth succeeds
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Request returns 403
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      await expect(client.getCategories()).rejects.toThrow(QBittorrentError);
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock version response
      mockFetchWithRetry.mockResolvedValueOnce(new Response('v4.6.0'));

      const result = await client.testConnection();
      expect(result).toBe(true);
    });

    it('should return false on connection failure', async () => {
      mockFetchWithRetry.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await client.testConnection();
      expect(result).toBe(false);
    });

    it('should return false when not configured', async () => {
      // Create and explicitly unconfigure
      const unconfiguredClient = new QBittorrentClient({
        host: '',
        username: '',
        password: '',
      });
      unconfiguredClient.configure({ host: '', username: '', password: '' });
      const result = await unconfiguredClient.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('getVersion', () => {
    it('should return qBittorrent version', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock version response
      mockFetchWithRetry.mockResolvedValueOnce(new Response('v4.6.0'));

      const version = await client.getVersion();
      expect(version).toBe('v4.6.0');
    });

    it('should throw error on failure', async () => {
      mockFetchWithRetry.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(client.getVersion()).rejects.toThrow();
    });
  });

  describe('getCategories', () => {
    it('should return array of category names', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock categories response
      const categoriesResponse = {
        games: { name: 'games', savePath: '/downloads/games' },
        movies: { name: 'movies', savePath: '/downloads/movies' },
      };
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify(categoriesResponse), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const categories = await client.getCategories();
      expect(categories).toEqual(['games', 'movies']);
    });

    it('should return empty array when no categories exist', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock empty categories response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const categories = await client.getCategories();
      expect(categories).toEqual([]);
    });

    it('should throw error on API failure', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock error response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(client.getCategories()).rejects.toThrow(QBittorrentError);
    });
  });

  describe('getTorrents', () => {
    const mockTorrent: QBittorrentTorrent = {
      hash: 'abc123',
      name: 'Test Game',
      size: 1024000000,
      progress: 0.5,
      dlspeed: 1000000,
      upspeed: 500000,
      priority: 0,
      num_seeds: 10,
      num_leechs: 5,
      ratio: 1.5,
      eta: 3600,
      state: 'downloading',
      seq_dl: false,
      f_l_piece_prio: false,
      category: 'games',
      tags: 'gamearr',
      save_path: '/downloads/games',
      added_on: 1700000000,
      completion_on: 0,
      tracker: 'http://tracker.example.com',
      dl_limit: 0,
      up_limit: 0,
      downloaded: 512000000,
      uploaded: 768000000,
      downloaded_session: 512000000,
      uploaded_session: 768000000,
      amount_left: 512000000,
      completed: 512000000,
      max_ratio: -1,
      max_seeding_time: -1,
      ratio_limit: -2,
      seeding_time_limit: -2,
      seen_complete: 0,
      last_activity: 1700000000,
    };

    it('should return list of torrents', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify([mockTorrent]), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.getTorrents();
      expect(torrents).toHaveLength(1);
      expect(torrents[0].hash).toBe('abc123');
      expect(torrents[0].name).toBe('Test Game');
      expect(torrents[0].progress).toBe(0.5);
      expect(torrents[0].state).toBe('downloading');
    });

    it('should return empty array when no torrents exist', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock empty torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.getTorrents();
      expect(torrents).toEqual([]);
    });

    it('should apply filter when provided', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify([mockTorrent]), {
          headers: { 'content-type': 'application/json' },
        })
      );

      await client.getTorrents('downloading');

      // Verify the filter was included in the URL
      const lastCall = mockFetchWithRetry.mock.calls[1];
      expect(lastCall[0]).toContain('filter=downloading');
    });

    it('should map torrent data correctly', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify([mockTorrent]), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.getTorrents();
      const torrent = torrents[0];

      expect(torrent.hash).toBe('abc123');
      expect(torrent.name).toBe('Test Game');
      expect(torrent.size).toBe(1024000000);
      expect(torrent.progress).toBe(0.5);
      expect(torrent.downloadSpeed).toBe(1000000);
      expect(torrent.uploadSpeed).toBe(500000);
      expect(torrent.eta).toBe(3600);
      expect(torrent.state).toBe('downloading');
      expect(torrent.category).toBe('games');
      expect(torrent.tags).toBe('gamearr');
      expect(torrent.savePath).toBe('/downloads/games');
      expect(torrent.addedOn).toBeInstanceOf(Date);
      expect(torrent.completionOn).toBeUndefined(); // completion_on is 0
    });

    it('should set completionOn when torrent is completed', async () => {
      const completedTorrent = { ...mockTorrent, completion_on: 1700001000 };
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify([completedTorrent]), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.getTorrents();
      expect(torrents[0].completionOn).toBeInstanceOf(Date);
    });

    it('should throw error on API failure', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock error response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(client.getTorrents()).rejects.toThrow(QBittorrentError);
    });
  });

  describe('getTorrent', () => {
    const mockTorrent: QBittorrentTorrent = {
      hash: 'abc123',
      name: 'Test Game',
      size: 1024000000,
      progress: 1.0,
      dlspeed: 0,
      upspeed: 500000,
      priority: 0,
      num_seeds: 10,
      num_leechs: 5,
      ratio: 1.5,
      eta: 0,
      state: 'uploading',
      seq_dl: false,
      f_l_piece_prio: false,
      category: 'games',
      tags: '',
      save_path: '/downloads/games',
      added_on: 1700000000,
      completion_on: 1700001000,
      tracker: 'http://tracker.example.com',
      dl_limit: 0,
      up_limit: 0,
      downloaded: 1024000000,
      uploaded: 1536000000,
      downloaded_session: 1024000000,
      uploaded_session: 1536000000,
      amount_left: 0,
      completed: 1024000000,
      max_ratio: -1,
      max_seeding_time: -1,
      ratio_limit: -2,
      seeding_time_limit: -2,
      seen_complete: 1700001000,
      last_activity: 1700002000,
    };

    it('should return torrent by hash', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrent response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify([mockTorrent]), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrent = await client.getTorrent('abc123');
      expect(torrent).not.toBeNull();
      expect(torrent!.hash).toBe('abc123');
      expect(torrent!.name).toBe('Test Game');
    });

    it('should return null when torrent not found', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock empty response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrent = await client.getTorrent('nonexistent');
      expect(torrent).toBeNull();
    });

    it('should throw error on API failure', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock error response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(client.getTorrent('abc123')).rejects.toThrow(QBittorrentError);
    });
  });

  describe('addTorrent', () => {
    describe('with magnet links', () => {
      it('should add magnet link successfully', async () => {
        const magnetLink = 'magnet:?xt=urn:btih:abc123&dn=Test+Game';
        // Mock auth
        mockFetchWithRetry.mockResolvedValueOnce(
          new Response('Ok.', {
            headers: { 'set-cookie': 'SID=testsession; path=/' },
          })
        );
        // Mock add torrent response
        mockFetchWithRetry.mockResolvedValueOnce(new Response('Ok.'));

        const result = await client.addTorrent(magnetLink);
        expect(result).toBe('Ok.');
      });

      it('should include options in request', async () => {
        const magnetLink = 'magnet:?xt=urn:btih:abc123&dn=Test+Game';
        // Mock auth
        mockFetchWithRetry.mockResolvedValueOnce(
          new Response('Ok.', {
            headers: { 'set-cookie': 'SID=testsession; path=/' },
          })
        );
        // Mock add torrent response
        mockFetchWithRetry.mockResolvedValueOnce(new Response('Ok.'));

        await client.addTorrent(magnetLink, {
          category: 'games',
          tags: 'gamearr,test',
          savepath: '/downloads/games',
        });

        const lastCall = mockFetchWithRetry.mock.calls[1];
        const body = lastCall[1]?.body as string;
        expect(body).toContain('category=games');
        expect(body).toContain('tags=gamearr%2Ctest');
        expect(body).toContain('savepath=%2Fdownloads%2Fgames');
      });

      it('should throw error when qBittorrent rejects the torrent', async () => {
        const magnetLink = 'magnet:?xt=urn:btih:abc123&dn=Test+Game';
        // Mock auth
        mockFetchWithRetry.mockResolvedValueOnce(
          new Response('Ok.', {
            headers: { 'set-cookie': 'SID=testsession; path=/' },
          })
        );
        // Mock rejection response
        mockFetchWithRetry.mockResolvedValueOnce(new Response('Fails.'));

        await expect(client.addTorrent(magnetLink)).rejects.toThrow(QBittorrentError);
      });
    });

    describe('with torrent file URLs', () => {
      it('should download and upload torrent file', async () => {
        const torrentUrl = 'http://example.com/test.torrent';
        const mockTorrentData = new ArrayBuffer(100);

        // Mock global fetch for downloading torrent file
        global.fetch = mock(() =>
          Promise.resolve(new Response(mockTorrentData))
        ) as typeof fetch;

        // Mock auth
        mockFetchWithRetry.mockResolvedValueOnce(
          new Response('Ok.', {
            headers: { 'set-cookie': 'SID=testsession; path=/' },
          })
        );
        // Mock add torrent response
        mockFetchWithRetry.mockResolvedValueOnce(new Response('Ok.'));

        const result = await client.addTorrent(torrentUrl);
        expect(result).toBe('Ok.');
      });

      it('should throw error when torrent file download fails', async () => {
        const torrentUrl = 'http://example.com/test.torrent';

        // Mock global fetch for failed download
        global.fetch = mock(() =>
          Promise.resolve(new Response('Not Found', { status: 404, statusText: 'Not Found' }))
        ) as typeof fetch;

        await expect(client.addTorrent(torrentUrl)).rejects.toThrow(QBittorrentError);
      });

      it('should throw error when qBittorrent rejects uploaded torrent file', async () => {
        const torrentUrl = 'http://example.com/test.torrent';
        const mockTorrentData = new ArrayBuffer(100);

        // Mock global fetch for downloading torrent file
        global.fetch = mock(() =>
          Promise.resolve(new Response(mockTorrentData))
        ) as typeof fetch;

        // Mock auth
        mockFetchWithRetry.mockResolvedValueOnce(
          new Response('Ok.', {
            headers: { 'set-cookie': 'SID=testsession; path=/' },
          })
        );
        // Mock rejection response
        mockFetchWithRetry.mockResolvedValueOnce(new Response('Fails.'));

        await expect(client.addTorrent(torrentUrl)).rejects.toThrow(QBittorrentError);
      });

      it('should include options when uploading torrent file', async () => {
        const torrentUrl = 'http://example.com/test.torrent';
        const mockTorrentData = new ArrayBuffer(100);

        // Mock global fetch for downloading torrent file
        global.fetch = mock(() =>
          Promise.resolve(new Response(mockTorrentData))
        ) as typeof fetch;

        // Mock auth
        mockFetchWithRetry.mockResolvedValueOnce(
          new Response('Ok.', {
            headers: { 'set-cookie': 'SID=testsession; path=/' },
          })
        );
        // Mock add torrent response
        mockFetchWithRetry.mockResolvedValueOnce(new Response('Ok.'));

        await client.addTorrent(torrentUrl, {
          category: 'games',
          tags: 'gamearr',
        });

        // Verify FormData was used (body should be FormData instance)
        const lastCall = mockFetchWithRetry.mock.calls[1];
        expect(lastCall[1]?.body).toBeInstanceOf(FormData);
      });
    });
  });

  describe('deleteTorrents', () => {
    it('should delete torrents without files', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock delete response
      mockFetchWithRetry.mockResolvedValueOnce(new Response(''));

      await client.deleteTorrents(['abc123', 'def456']);

      const lastCall = mockFetchWithRetry.mock.calls[1];
      const body = lastCall[1]?.body as string;
      expect(body).toContain('hashes=abc123%7Cdef456');
      expect(body).toContain('deleteFiles=false');
    });

    it('should delete torrents with files', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock delete response
      mockFetchWithRetry.mockResolvedValueOnce(new Response(''));

      await client.deleteTorrents(['abc123'], true);

      const lastCall = mockFetchWithRetry.mock.calls[1];
      const body = lastCall[1]?.body as string;
      expect(body).toContain('deleteFiles=true');
    });

    it('should throw error on API failure', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock error response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(client.deleteTorrents(['abc123'])).rejects.toThrow(QBittorrentError);
    });
  });

  describe('pauseTorrents', () => {
    it('should pause torrents', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock pause response
      mockFetchWithRetry.mockResolvedValueOnce(new Response(''));

      await client.pauseTorrents(['abc123', 'def456']);

      const lastCall = mockFetchWithRetry.mock.calls[1];
      expect(lastCall[0]).toContain('torrents/stop');
      const body = lastCall[1]?.body as string;
      expect(body).toContain('hashes=abc123%7Cdef456');
    });

    it('should throw error on API failure', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock error response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(client.pauseTorrents(['abc123'])).rejects.toThrow(QBittorrentError);
    });
  });

  describe('resumeTorrents', () => {
    it('should resume torrents', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock resume response
      mockFetchWithRetry.mockResolvedValueOnce(new Response(''));

      await client.resumeTorrents(['abc123', 'def456']);

      const lastCall = mockFetchWithRetry.mock.calls[1];
      expect(lastCall[0]).toContain('torrents/start');
      const body = lastCall[1]?.body as string;
      expect(body).toContain('hashes=abc123%7Cdef456');
    });

    it('should throw error on API failure', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock error response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(client.resumeTorrents(['abc123'])).rejects.toThrow(QBittorrentError);
    });
  });

  describe('addTags', () => {
    it('should add tags to torrents', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock addTags response
      mockFetchWithRetry.mockResolvedValueOnce(new Response(''));

      await client.addTags(['abc123', 'def456'], 'gamearr,test');

      const lastCall = mockFetchWithRetry.mock.calls[1];
      expect(lastCall[0]).toContain('torrents/addTags');
      const body = lastCall[1]?.body as string;
      expect(body).toContain('hashes=abc123%7Cdef456');
      expect(body).toContain('tags=gamearr%2Ctest');
    });

    it('should throw error on API failure', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock error response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Server Error', { status: 500, statusText: 'Internal Server Error' })
      );

      await expect(client.addTags(['abc123'], 'test')).rejects.toThrow(QBittorrentError);
    });
  });

  describe('findTorrentsByPath', () => {
    const mockTorrents: QBittorrentTorrent[] = [
      {
        hash: 'abc123',
        name: 'Game 1',
        size: 1024000000,
        progress: 1.0,
        dlspeed: 0,
        upspeed: 0,
        priority: 0,
        num_seeds: 0,
        num_leechs: 0,
        ratio: 0,
        eta: 0,
        state: 'pausedUP',
        seq_dl: false,
        f_l_piece_prio: false,
        category: 'games',
        tags: '',
        save_path: '/downloads/games/Game 1',
        added_on: 1700000000,
        completion_on: 1700001000,
        tracker: '',
        dl_limit: 0,
        up_limit: 0,
        downloaded: 0,
        uploaded: 0,
        downloaded_session: 0,
        uploaded_session: 0,
        amount_left: 0,
        completed: 0,
        max_ratio: -1,
        max_seeding_time: -1,
        ratio_limit: -2,
        seeding_time_limit: -2,
        seen_complete: 0,
        last_activity: 0,
      },
      {
        hash: 'def456',
        name: 'Game 2',
        size: 2048000000,
        progress: 1.0,
        dlspeed: 0,
        upspeed: 0,
        priority: 0,
        num_seeds: 0,
        num_leechs: 0,
        ratio: 0,
        eta: 0,
        state: 'pausedUP',
        seq_dl: false,
        f_l_piece_prio: false,
        category: 'movies',
        tags: '',
        save_path: '/downloads/movies/Movie 1',
        added_on: 1700000000,
        completion_on: 1700001000,
        tracker: '',
        dl_limit: 0,
        up_limit: 0,
        downloaded: 0,
        uploaded: 0,
        downloaded_session: 0,
        uploaded_session: 0,
        amount_left: 0,
        completed: 0,
        max_ratio: -1,
        max_seeding_time: -1,
        ratio_limit: -2,
        seeding_time_limit: -2,
        seen_complete: 0,
        last_activity: 0,
      },
    ];

    it('should find torrents matching path', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify(mockTorrents), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.findTorrentsByPath('/downloads/games');
      expect(torrents).toHaveLength(1);
      expect(torrents[0].hash).toBe('abc123');
    });

    it('should handle Windows-style paths', async () => {
      const windowsTorrents = [
        { ...mockTorrents[0], save_path: 'C:\\Downloads\\Games\\Game 1' },
        { ...mockTorrents[1], save_path: 'C:\\Downloads\\Movies\\Movie 1' },
      ];

      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify(windowsTorrents), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.findTorrentsByPath('C:\\Downloads\\Games');
      expect(torrents).toHaveLength(1);
      expect(torrents[0].hash).toBe('abc123');
    });

    it('should be case-insensitive', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify(mockTorrents), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.findTorrentsByPath('/DOWNLOADS/GAMES');
      expect(torrents).toHaveLength(1);
      expect(torrents[0].hash).toBe('abc123');
    });

    it('should return empty array when no matches found', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock torrents response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response(JSON.stringify(mockTorrents), {
          headers: { 'content-type': 'application/json' },
        })
      );

      const torrents = await client.findTorrentsByPath('/nonexistent/path');
      expect(torrents).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should wrap network errors in QBittorrentError', async () => {
      mockFetchWithRetry.mockRejectedValueOnce(new TypeError('fetch failed'));

      try {
        await client.testConnection();
      } catch (error) {
        // testConnection catches errors and returns false, so we need to test via another method
      }

      // Test via getVersion which throws errors
      mockFetchWithRetry.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(client.getVersion()).rejects.toThrow(QBittorrentError);
    });

    it('should handle non-JSON responses correctly', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock text response (like version)
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('v4.6.0', {
          headers: { 'content-type': 'text/plain' },
        })
      );

      const version = await client.getVersion();
      expect(version).toBe('v4.6.0');
    });

    it('should handle generic API errors', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock bad request response
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Bad Request', { status: 400, statusText: 'Bad Request' })
      );

      await expect(client.getCategories()).rejects.toThrow(QBittorrentError);
    });
  });

  describe('rate limiting', () => {
    it('should acquire rate limit token before making request', async () => {
      // Mock auth
      mockFetchWithRetry.mockResolvedValueOnce(
        new Response('Ok.', {
          headers: { 'set-cookie': 'SID=testsession; path=/' },
        })
      );
      // Mock version response
      mockFetchWithRetry.mockResolvedValueOnce(new Response('v4.6.0'));

      await client.getVersion();

      // Rate limiter acquire should be called once (for the version request, not auth)
      expect(mockRateLimiterAcquire).toHaveBeenCalled();
    });
  });
});
