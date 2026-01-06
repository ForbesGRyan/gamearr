import { Hono } from 'hono';
import { logger } from '../utils/logger';
import { prowlarrClient } from '../integrations/prowlarr/ProwlarrClient';
import { qbittorrentClient } from '../integrations/qbittorrent/QBittorrentClient';
import { settingsService } from '../services/SettingsService';
import { db } from '../db';
import { games } from '../db/schema';
import { count } from 'drizzle-orm';

const system = new Hono();

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unconfigured';
  message?: string;
  responseTime?: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: ServiceStatus[];
  stats?: {
    totalGames: number;
    wantedGames: number;
    downloadingGames: number;
    downloadedGames: number;
  };
}

// GET /api/v1/system/status - Basic health check (fast)
system.get('/status', async (c) => {
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// GET /api/v1/system/health - Comprehensive health check with service status
system.get('/health', async (c) => {
  logger.info('GET /api/v1/system/health');

  const services: ServiceStatus[] = [];

  // Check Database
  const dbStatus = await checkDatabase();
  services.push(dbStatus);

  // Check IGDB (just config, not connectivity - to avoid rate limits)
  const igdbStatus = await checkIGDBConfig();
  services.push(igdbStatus);

  // Check Prowlarr
  const prowlarrStatus = await checkProwlarr();
  services.push(prowlarrStatus);

  // Check qBittorrent
  const qbittorrentStatus = await checkQBittorrent();
  services.push(qbittorrentStatus);

  // Get game stats
  const stats = await getGameStats();

  // Determine overall status
  const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length;
  const unconfiguredCount = services.filter((s) => s.status === 'unconfigured').length;

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0) {
    overallStatus = unhealthyCount >= 2 ? 'unhealthy' : 'degraded';
  } else if (unconfiguredCount > 0) {
    overallStatus = 'degraded';
  }

  const health: SystemHealth = {
    status: overallStatus,
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services,
    stats,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return c.json({ success: true, data: health }, statusCode);
});

// GET /api/v1/system/logs - Get recent logs
system.get('/logs', async (c) => {
  logger.info('GET /api/v1/system/logs');
  // TODO: Implement log retrieval
  return c.json({ success: true, data: [] });
});

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await db.select({ count: count() }).from(games);
    return {
      name: 'Database',
      status: 'healthy',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check IGDB configuration
 */
async function checkIGDBConfig(): Promise<ServiceStatus> {
  try {
    const clientId = await settingsService.getIGDBClientId();
    const clientSecret = await settingsService.getIGDBClientSecret();

    if (!clientId || !clientSecret) {
      return {
        name: 'IGDB',
        status: 'unconfigured',
        message: 'IGDB credentials not configured',
      };
    }

    return {
      name: 'IGDB',
      status: 'healthy',
      message: 'Configured',
    };
  } catch (error) {
    return {
      name: 'IGDB',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Prowlarr connectivity
 */
async function checkProwlarr(): Promise<ServiceStatus> {
  const start = Date.now();

  if (!prowlarrClient.isConfigured()) {
    return {
      name: 'Prowlarr',
      status: 'unconfigured',
      message: 'Prowlarr not configured',
    };
  }

  try {
    const connected = await prowlarrClient.testConnection();
    return {
      name: 'Prowlarr',
      status: connected ? 'healthy' : 'unhealthy',
      message: connected ? 'Connected' : 'Connection failed',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Prowlarr',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Check qBittorrent connectivity
 */
async function checkQBittorrent(): Promise<ServiceStatus> {
  const start = Date.now();

  if (!qbittorrentClient.isConfigured()) {
    return {
      name: 'qBittorrent',
      status: 'unconfigured',
      message: 'qBittorrent not configured',
    };
  }

  try {
    const connected = await qbittorrentClient.testConnection();
    return {
      name: 'qBittorrent',
      status: connected ? 'healthy' : 'unhealthy',
      message: connected ? 'Connected' : 'Connection failed',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'qBittorrent',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - start,
    };
  }
}

/**
 * Get game statistics
 */
async function getGameStats() {
  try {
    const allGames = await db.select().from(games);

    return {
      totalGames: allGames.length,
      wantedGames: allGames.filter((g) => g.status === 'wanted').length,
      downloadingGames: allGames.filter((g) => g.status === 'downloading').length,
      downloadedGames: allGames.filter((g) => g.status === 'downloaded').length,
    };
  } catch (error) {
    logger.error('Failed to get game stats:', error);
    return undefined;
  }
}

export default system;
