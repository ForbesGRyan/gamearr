import { Hono } from 'hono';
import { SteamClient, SteamGame } from '../integrations/steam/SteamClient';
import { settingsService } from '../services/SettingsService';
import { gameService } from '../services/GameService';
import { IGDBClient } from '../integrations/igdb/IGDBClient';
import type { NewGame } from '../db/schema';
import type { SteamImportSSEEvent } from '../../shared/types';
import { formatErrorResponse, getHttpStatusCode, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

const router = new Hono();

/**
 * Normalize a game title for comparison
 * Handles: Roman numerals, punctuation, case, whitespace
 */
function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase();

  // Convert Roman numerals to Arabic numbers (common in game titles)
  const romanToArabic: [RegExp, string][] = [
    [/\bxiii\b/g, '13'],
    [/\bxii\b/g, '12'],
    [/\bxi\b/g, '11'],
    [/\bviii\b/g, '8'],
    [/\bvii\b/g, '7'],
    [/\bvi\b/g, '6'],
    [/\biv\b/g, '4'],
    [/\bix\b/g, '9'],
    [/\biii\b/g, '3'],
    [/\bii\b/g, '2'],
    [/\bx\b/g, '10'],
    [/\bv\b/g, '5'],
  ];

  for (const [pattern, replacement] of romanToArabic) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Remove punctuation, special characters, and trademark/copyright symbols
  normalized = normalized.replace(/[''`:;,.\-_!?()[\]{}™®©]/g, '');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Test Steam connection
 * GET /api/v1/steam/test
 */
router.get('/test', async (c) => {
  try {
    const apiKey = await settingsService.getSetting('steam_api_key');
    const steamId = await settingsService.getSetting('steam_id');

    if (!apiKey || !steamId) {
      return c.json({
        success: false,
        error: 'Steam API key and Steam ID are required',
        code: ErrorCode.NOT_CONFIGURED,
      }, 400);
    }

    const client = new SteamClient(apiKey as string, steamId as string);
    const result = await client.testConnection();

    if (result.success) {
      return c.json({
        success: true,
        data: { connected: true, playerName: result.playerName },
      });
    } else {
      return c.json({
        success: false,
        error: result.error,
        code: ErrorCode.STEAM_ERROR,
      }, 502);
    }
  } catch (error) {
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * Get owned Steam games
 * GET /api/v1/steam/owned-games
 */
router.get('/owned-games', async (c) => {
  try {
    const apiKey = await settingsService.getSetting('steam_api_key');
    const steamId = await settingsService.getSetting('steam_id');

    if (!apiKey || !steamId) {
      return c.json({
        success: false,
        error: 'Steam API key and Steam ID are required',
        code: ErrorCode.NOT_CONFIGURED,
      }, 400);
    }

    const client = new SteamClient(apiKey as string, steamId as string);
    const games = await client.getOwnedGames();

    // Get existing games to mark which ones are already in library
    const existingGames = await gameService.getAllGames();
    const existingNormalizedTitles = new Set(existingGames.map((g) => normalizeTitle(g.title)));

    // Enrich with import status (using normalized title matching)
    const enrichedGames = games.map((game) => ({
      ...game,
      alreadyInLibrary: existingNormalizedTitles.has(normalizeTitle(game.name)),
      headerImageUrl: SteamClient.getHeaderImageUrl(game.appId),
    }));

    // Sort by playtime (most played first)
    enrichedGames.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);

    return c.json({
      success: true,
      data: enrichedGames,
    });
  } catch (error) {
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

interface ImportRequest {
  appIds: number[];
}

/**
 * Import selected Steam games
 * POST /api/v1/steam/import
 *
 * Uses IGDB multiquery to batch search games (10 at a time) for faster imports.
 */
router.post('/import', async (c) => {
  try {
    const { appIds } = await c.req.json<ImportRequest>();

    if (!appIds || !appIds.length) {
      return c.json({
        success: false,
        error: 'No games selected for import',
        code: ErrorCode.VALIDATION_ERROR,
      }, 400);
    }

    const apiKey = await settingsService.getSetting('steam_api_key');
    const steamId = await settingsService.getSetting('steam_id');

    if (!apiKey || !steamId) {
      return c.json({
        success: false,
        error: 'Steam API key and Steam ID are required',
        code: ErrorCode.STEAM_NOT_CONFIGURED,
      }, 400);
    }

    // Get IGDB credentials for metadata lookup
    const igdbClientId = await settingsService.getSetting('igdb_client_id');
    const igdbClientSecret = await settingsService.getSetting('igdb_client_secret');

    if (!igdbClientId || !igdbClientSecret) {
      return c.json({
        success: false,
        error: 'IGDB credentials are required for Steam import',
        code: ErrorCode.NOT_CONFIGURED,
      }, 400);
    }

    const steamClient = new SteamClient(apiKey as string, steamId as string);
    const ownedGames = await steamClient.getOwnedGames();

    // Filter to selected games
    const selectedGames = ownedGames.filter((g) => appIds.includes(g.appId));

    // Get existing games to check for duplicates
    const existingGames = await gameService.getAllGames();
    const existingNormalizedTitles = new Set(existingGames.map((g) => normalizeTitle(g.title)));
    const existingIgdbIds = new Set(existingGames.map((g) => g.igdbId));

    // Filter out games that already exist by title
    const gamesToImport = selectedGames.filter(
      (g) => !existingNormalizedTitles.has(normalizeTitle(g.name))
    );

    if (gamesToImport.length === 0) {
      return c.json({
        success: true,
        data: {
          imported: 0,
          skipped: selectedGames.length,
          errors: undefined,
        },
      });
    }

    // Batch search all game names on IGDB using multiquery
    const igdbClient = new IGDBClient(
      igdbClientId as string,
      igdbClientSecret as string
    );

    const gameNames = gamesToImport.map((g) => g.name);
    logger.info(`Batch searching ${gameNames.length} games on IGDB...`);
    const igdbResults = await igdbClient.searchGamesBatch(gameNames, 5);
    logger.info(`IGDB batch search complete, got results for ${igdbResults.size} games`);

    let imported = 0;
    let skipped = selectedGames.length - gamesToImport.length; // Already skipped by title
    const errors: string[] = [];

    // Now process each game with pre-fetched IGDB data
    for (const steamGame of gamesToImport) {
      try {
        const searchResults = igdbResults.get(steamGame.name) || [];

        if (searchResults.length === 0) {
          errors.push(`Could not find "${steamGame.name}" on IGDB - skipping`);
          continue;
        }

        // Find best match (exact or close title match)
        const exactMatch = searchResults.find(
          (r) => r.title.toLowerCase() === steamGame.name.toLowerCase()
        );
        const igdbData = exactMatch || searchResults[0];

        if (!igdbData?.igdbId) {
          errors.push(`Could not find "${steamGame.name}" on IGDB - skipping`);
          continue;
        }

        // Check if game already exists by IGDB ID
        if (existingIgdbIds.has(igdbData.igdbId)) {
          skipped++;
          continue;
        }

        // Add to existing set to prevent duplicates within this import
        existingIgdbIds.add(igdbData.igdbId);

        // Create game in database
        const gameData: NewGame = {
          title: igdbData.title || steamGame.name,
          year: igdbData.year,
          igdbId: igdbData.igdbId,
          coverUrl: igdbData.coverUrl || SteamClient.getHeaderImageUrl(steamGame.appId),
          platform: 'PC',
          status: 'downloaded', // Steam games are already owned
          monitored: false, // Don't monitor Steam games for updates (Steam handles it)
          updatePolicy: 'ignore', // Don't check for updates (Steam handles it)
          store: 'Steam',
          // Store original Steam name if it differs from IGDB title (for diagnostics)
          steamName: steamGame.name !== igdbData.title ? steamGame.name : null,
          summary: igdbData.summary,
          genres: igdbData.genres ? JSON.stringify(igdbData.genres) : null,
          totalRating: igdbData.totalRating ? Math.round(igdbData.totalRating) : null,
          developer: igdbData.developer,
          publisher: igdbData.publisher,
          gameModes: igdbData.gameModes ? JSON.stringify(igdbData.gameModes) : null,
        };

        await gameService.createGame(gameData);
        imported++;
      } catch (gameError) {
        errors.push(`Failed to import ${steamGame.name}: ${gameError instanceof Error ? gameError.message : 'Unknown error'}`);
      }
    }

    return c.json({
      success: true,
      data: {
        imported,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * Import selected Steam games with SSE progress streaming
 * POST /api/v1/steam/import-stream
 *
 * Returns Server-Sent Events with progress updates:
 * - { type: 'progress', current: 1, total: 10, game: 'Game Name', status: 'searching' | 'imported' | 'skipped' | 'error' }
 * - { type: 'complete', imported: 10, skipped: 2, errors: [...] }
 * - { type: 'error', message: '...' }
 */
router.post('/import-stream', async (c) => {
  const { appIds } = await c.req.json<ImportRequest>();

  // Validation
  if (!appIds || !appIds.length) {
    return c.json({ success: false, error: 'No games selected for import', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  const apiKey = await settingsService.getSetting('steam_api_key');
  const steamId = await settingsService.getSetting('steam_id');
  if (!apiKey || !steamId) {
    return c.json({ success: false, error: 'Steam API key and Steam ID are required', code: ErrorCode.STEAM_NOT_CONFIGURED }, 400);
  }

  const igdbClientId = await settingsService.getSetting('igdb_client_id');
  const igdbClientSecret = await settingsService.getSetting('igdb_client_secret');
  if (!igdbClientId || !igdbClientSecret) {
    return c.json({ success: false, error: 'IGDB credentials are required for Steam import', code: ErrorCode.NOT_CONFIGURED }, 400);
  }

  // Set up SSE response
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: SteamImportSSEEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const steamClient = new SteamClient(apiKey as string, steamId as string);
          const ownedGames = await steamClient.getOwnedGames();
          const selectedGames = ownedGames.filter((g) => appIds.includes(g.appId));

          // Get existing games to check for duplicates
          const existingGames = await gameService.getAllGames();
          const existingNormalizedTitles = new Set(existingGames.map((g) => normalizeTitle(g.title)));
          const existingIgdbIds = new Set(existingGames.map((g) => g.igdbId));

          // Filter out games that already exist by title
          const gamesToImport = selectedGames.filter(
            (g) => !existingNormalizedTitles.has(normalizeTitle(g.name))
          );

          if (gamesToImport.length === 0) {
            send({ type: 'complete', imported: 0, skipped: selectedGames.length });
            controller.close();
            return;
          }

          const igdbClient = new IGDBClient(igdbClientId as string, igdbClientSecret as string);
          const total = gamesToImport.length;
          let imported = 0;
          let skipped = selectedGames.length - gamesToImport.length;
          const errors: string[] = [];

          // Process games one by one with progress updates
          for (let i = 0; i < gamesToImport.length; i++) {
            const steamGame = gamesToImport[i];
            const current = i + 1;

            // Send searching progress
            send({ type: 'progress', current, total, game: steamGame.name, status: 'searching' });

            try {
              // Search IGDB for this game (strip trademark symbols for better matching)
              const searchName = steamGame.name.replace(/[™®©]/g, '').trim();
              const searchResults = await igdbClient.searchGames({ search: searchName, limit: 5 });

              if (searchResults.length === 0) {
                errors.push(`Could not find "${steamGame.name}" on IGDB`);
                send({ type: 'progress', current, total, game: steamGame.name, status: 'error' });
                continue;
              }

              // Find best match (exact or close title match)
              const exactMatch = searchResults.find(
                (r) => r.title.toLowerCase() === steamGame.name.toLowerCase()
              );
              const igdbData = exactMatch || searchResults[0];

              if (!igdbData?.igdbId) {
                errors.push(`Could not find "${steamGame.name}" on IGDB`);
                send({ type: 'progress', current, total, game: steamGame.name, status: 'error' });
                continue;
              }

              // Check if already exists by IGDB ID
              if (existingIgdbIds.has(igdbData.igdbId)) {
                skipped++;
                send({ type: 'progress', current, total, game: steamGame.name, status: 'skipped' });
                continue;
              }

              existingIgdbIds.add(igdbData.igdbId);

              const gameData: NewGame = {
                title: igdbData.title || steamGame.name,
                year: igdbData.year,
                igdbId: igdbData.igdbId,
                coverUrl: igdbData.coverUrl || SteamClient.getHeaderImageUrl(steamGame.appId),
                platform: 'PC',
                status: 'downloaded',
                monitored: false,
                updatePolicy: 'ignore',
                store: 'Steam',
                steamName: steamGame.name !== igdbData.title ? steamGame.name : null,
                summary: igdbData.summary,
                genres: igdbData.genres ? JSON.stringify(igdbData.genres) : null,
                totalRating: igdbData.totalRating ? Math.round(igdbData.totalRating) : null,
                developer: igdbData.developer,
                publisher: igdbData.publisher,
                gameModes: igdbData.gameModes ? JSON.stringify(igdbData.gameModes) : null,
              };

              await gameService.createGame(gameData);
              imported++;
              send({ type: 'progress', current, total, game: igdbData.title, status: 'imported' });
            } catch (gameError) {
              errors.push(`Failed to import ${steamGame.name}: ${gameError instanceof Error ? gameError.message : 'Unknown error'}`);
              send({ type: 'progress', current, total, game: steamGame.name, status: 'error' });
            }
          }

          send({ type: 'complete', imported, skipped, errors: errors.length > 0 ? errors : undefined });
        } catch (error) {
          send({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }
  );
});

export default router;
