import { Hono } from 'hono';
import { GogClient, GogGame } from '../integrations/gog/GogClient';
import { settingsService } from '../services/SettingsService';
import { gameService } from '../services/GameService';
import { IGDBClient } from '../integrations/igdb/IGDBClient';
import type { NewGame } from '../db/schema';
import type { GogImportSSEEvent } from '../../shared/types';
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
 * Test GOG connection
 * GET /api/v1/gog/test
 */
router.get('/test', async (c) => {
  try {
    const refreshToken = await settingsService.getSetting('gog_refresh_token');

    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'GOG refresh token is required',
        code: ErrorCode.NOT_CONFIGURED,
      }, 400);
    }

    const client = new GogClient(refreshToken as string);
    const result = await client.testConnection();

    if (result.success) {
      return c.json({
        success: true,
        data: { connected: true, username: result.username },
      });
    } else {
      return c.json({
        success: false,
        error: result.error,
        code: ErrorCode.GOG_ERROR,
      }, 502);
    }
  } catch (error) {
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

/**
 * Get owned GOG games
 * GET /api/v1/gog/owned-games
 */
router.get('/owned-games', async (c) => {
  try {
    const refreshToken = await settingsService.getSetting('gog_refresh_token');

    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'GOG refresh token is required',
        code: ErrorCode.NOT_CONFIGURED,
      }, 400);
    }

    const client = new GogClient(refreshToken as string);
    const games = await client.getOwnedGames();

    // Get existing games to mark which ones are already in library
    const existingGames = await gameService.getAllGames();
    const existingNormalizedTitles = new Set(existingGames.map((g) => normalizeTitle(g.title)));

    // Enrich with import status (using normalized title matching)
    const enrichedGames = games.map((game) => ({
      ...game,
      alreadyInLibrary: existingNormalizedTitles.has(normalizeTitle(game.title)),
    }));

    // Sort alphabetically
    enrichedGames.sort((a, b) => a.title.localeCompare(b.title));

    return c.json({
      success: true,
      data: enrichedGames,
    });
  } catch (error) {
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

interface ImportRequest {
  gameIds: number[];
}

/**
 * Import selected GOG games
 * POST /api/v1/gog/import
 */
router.post('/import', async (c) => {
  try {
    const { gameIds } = await c.req.json<ImportRequest>();

    if (!gameIds || !gameIds.length) {
      return c.json({
        success: false,
        error: 'No games selected for import',
        code: ErrorCode.VALIDATION_ERROR,
      }, 400);
    }

    const refreshToken = await settingsService.getSetting('gog_refresh_token');

    if (!refreshToken) {
      return c.json({
        success: false,
        error: 'GOG refresh token is required',
        code: ErrorCode.GOG_NOT_CONFIGURED,
      }, 400);
    }

    // Get IGDB credentials for metadata lookup
    const igdbClientId = await settingsService.getSetting('igdb_client_id');
    const igdbClientSecret = await settingsService.getSetting('igdb_client_secret');

    if (!igdbClientId || !igdbClientSecret) {
      return c.json({
        success: false,
        error: 'IGDB credentials are required for GOG import',
        code: ErrorCode.NOT_CONFIGURED,
      }, 400);
    }

    const gogClient = new GogClient(refreshToken as string);
    const ownedGames = await gogClient.getOwnedGames();

    // Filter to selected games
    const selectedGames = ownedGames.filter((g) => gameIds.includes(g.id));

    // Get existing games to check for duplicates
    const existingGames = await gameService.getAllGames();
    const existingNormalizedTitles = new Set(existingGames.map((g) => normalizeTitle(g.title)));
    const existingIgdbIds = new Set(existingGames.map((g) => g.igdbId));

    // Filter out games that already exist by title
    const gamesToImport = selectedGames.filter(
      (g) => !existingNormalizedTitles.has(normalizeTitle(g.title))
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

    const gameNames = gamesToImport.map((g) => g.title);
    logger.info(`Batch searching ${gameNames.length} GOG games on IGDB...`);
    const igdbResults = await igdbClient.searchGamesBatch(gameNames, 5);
    logger.info(`IGDB batch search complete, got results for ${igdbResults.size} games`);

    let imported = 0;
    let skipped = selectedGames.length - gamesToImport.length;
    const errors: string[] = [];

    for (const gogGame of gamesToImport) {
      try {
        const searchResults = igdbResults.get(gogGame.title) || [];

        if (searchResults.length === 0) {
          errors.push(`Could not find "${gogGame.title}" on IGDB - skipping`);
          continue;
        }

        const exactMatch = searchResults.find(
          (r) => r.title.toLowerCase() === gogGame.title.toLowerCase()
        );
        const igdbData = exactMatch || searchResults[0];

        if (!igdbData?.igdbId) {
          errors.push(`Could not find "${gogGame.title}" on IGDB - skipping`);
          continue;
        }

        if (existingIgdbIds.has(igdbData.igdbId)) {
          skipped++;
          continue;
        }

        existingIgdbIds.add(igdbData.igdbId);

        const gameData: NewGame = {
          title: igdbData.title || gogGame.title,
          year: igdbData.year,
          igdbId: igdbData.igdbId,
          coverUrl: igdbData.coverUrl || gogGame.imageUrl,
          platform: 'PC',
          status: 'downloaded',
          monitored: false,
          updatePolicy: 'ignore',
          store: 'GOG',
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
        errors.push(`Failed to import ${gogGame.title}: ${gameError instanceof Error ? gameError.message : 'Unknown error'}`);
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
 * Import selected GOG games with SSE progress streaming
 * POST /api/v1/gog/import-stream
 */
router.post('/import-stream', async (c) => {
  const { gameIds } = await c.req.json<ImportRequest>();

  if (!gameIds || !gameIds.length) {
    return c.json({ success: false, error: 'No games selected for import', code: ErrorCode.VALIDATION_ERROR }, 400);
  }

  const refreshToken = await settingsService.getSetting('gog_refresh_token');
  if (!refreshToken) {
    return c.json({ success: false, error: 'GOG refresh token is required', code: ErrorCode.GOG_NOT_CONFIGURED }, 400);
  }

  const igdbClientId = await settingsService.getSetting('igdb_client_id');
  const igdbClientSecret = await settingsService.getSetting('igdb_client_secret');
  if (!igdbClientId || !igdbClientSecret) {
    return c.json({ success: false, error: 'IGDB credentials are required for GOG import', code: ErrorCode.NOT_CONFIGURED }, 400);
  }

  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: GogImportSSEEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const gogClient = new GogClient(refreshToken as string);
          const ownedGames = await gogClient.getOwnedGames();
          const selectedGames = ownedGames.filter((g) => gameIds.includes(g.id));

          const existingGames = await gameService.getAllGames();
          const existingNormalizedTitles = new Set(existingGames.map((g) => normalizeTitle(g.title)));
          const existingIgdbIds = new Set(existingGames.map((g) => g.igdbId));

          const gamesToImport = selectedGames.filter(
            (g) => !existingNormalizedTitles.has(normalizeTitle(g.title))
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

          for (let i = 0; i < gamesToImport.length; i++) {
            const gogGame = gamesToImport[i];
            const current = i + 1;

            send({ type: 'progress', current, total, game: gogGame.title, status: 'searching' });

            try {
              const searchName = gogGame.title.replace(/[™®©]/g, '').trim();
              const searchResults = await igdbClient.searchGames({ search: searchName, limit: 5 });

              if (searchResults.length === 0) {
                errors.push(`Could not find "${gogGame.title}" on IGDB`);
                send({ type: 'progress', current, total, game: gogGame.title, status: 'error' });
                continue;
              }

              const exactMatch = searchResults.find(
                (r) => r.title.toLowerCase() === gogGame.title.toLowerCase()
              );
              const igdbData = exactMatch || searchResults[0];

              if (!igdbData?.igdbId) {
                errors.push(`Could not find "${gogGame.title}" on IGDB`);
                send({ type: 'progress', current, total, game: gogGame.title, status: 'error' });
                continue;
              }

              if (existingIgdbIds.has(igdbData.igdbId)) {
                skipped++;
                send({ type: 'progress', current, total, game: gogGame.title, status: 'skipped' });
                continue;
              }

              existingIgdbIds.add(igdbData.igdbId);

              const gameData: NewGame = {
                title: igdbData.title || gogGame.title,
                year: igdbData.year,
                igdbId: igdbData.igdbId,
                coverUrl: igdbData.coverUrl || gogGame.imageUrl,
                platform: 'PC',
                status: 'downloaded',
                monitored: false,
                updatePolicy: 'ignore',
                store: 'GOG',
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
              errors.push(`Failed to import ${gogGame.title}: ${gameError instanceof Error ? gameError.message : 'Unknown error'}`);
              send({ type: 'progress', current, total, game: gogGame.title, status: 'error' });
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
