import { createHash } from 'crypto';
import { embeddingService, type ScoredMatch } from './EmbeddingService';
import { gameEmbeddingRepository } from '../repositories/GameEmbeddingRepository';
import { gameRepository } from '../repositories/GameRepository';
import { logger } from '../utils/logger';
import type { GameSearchResult } from '../integrations/igdb/types';

// In-memory cache of embeddings for fast similarity search
interface EmbeddingCache {
  gameId: number;
  title: string;
  titleHash: string;
  embedding: number[];
}

export class SemanticSearchService {
  private cache: Map<number, EmbeddingCache> = new Map();
  private cacheWarmed = false;
  private warmingPromise: Promise<void> | null = null;

  /**
   * Generate SHA256 hash of title for cache invalidation
   */
  private hashTitle(title: string): string {
    return createHash('sha256').update(title.toLowerCase()).digest('hex');
  }

  /**
   * Warm the cache by loading all embeddings from database
   * Called on first semantic search request
   */
  async warmCache(): Promise<void> {
    if (this.cacheWarmed) return;

    if (this.warmingPromise) {
      return this.warmingPromise;
    }

    this.warmingPromise = this.doWarmCache();
    return this.warmingPromise;
  }

  private async doWarmCache(): Promise<void> {
    try {
      logger.info('Warming semantic search cache...');
      const startTime = Date.now();

      // Load all games
      const games = await gameRepository.findAll();

      // Load existing embeddings from database
      const existingEmbeddings = await gameEmbeddingRepository.findAll();
      const embeddingsByGameId = new Map(
        existingEmbeddings.map((e) => [e.gameId, e])
      );

      // Check which games need embeddings generated
      const gamesToEmbed: Array<{ id: number; title: string; titleHash: string }> = [];

      for (const game of games) {
        const titleHash = this.hashTitle(game.title);
        const existing = embeddingsByGameId.get(game.id);

        if (existing && existing.titleHash === titleHash) {
          // Use existing embedding
          this.cache.set(game.id, {
            gameId: game.id,
            title: game.title,
            titleHash,
            embedding: gameEmbeddingRepository.parseEmbedding(existing.embedding),
          });
        } else {
          // Need to generate new embedding
          gamesToEmbed.push({ id: game.id, title: game.title, titleHash });
        }
      }

      // Generate missing embeddings
      if (gamesToEmbed.length > 0) {
        logger.info(`Generating embeddings for ${gamesToEmbed.length} games...`);

        // Process in batches
        const batchSize = 50;
        for (let i = 0; i < gamesToEmbed.length; i += batchSize) {
          const batch = gamesToEmbed.slice(i, i + batchSize);
          const titles = batch.map((g) => g.title);

          const embeddings = await embeddingService.embedBatch(titles);

          // Save to database and cache
          for (let j = 0; j < batch.length; j++) {
            const game = batch[j];
            const embedding = embeddings[j];

            // Save to database
            await gameEmbeddingRepository.upsert(game.id, game.titleHash, embedding);

            // Add to cache
            this.cache.set(game.id, {
              gameId: game.id,
              title: game.title,
              titleHash: game.titleHash,
              embedding,
            });
          }

          logger.info(`Processed ${Math.min(i + batchSize, gamesToEmbed.length)}/${gamesToEmbed.length} embeddings`);
        }
      }

      this.cacheWarmed = true;
      const duration = Date.now() - startTime;
      logger.info(`Semantic search cache warmed in ${duration}ms (${this.cache.size} games)`);
    } catch (error) {
      logger.error('Failed to warm semantic search cache:', error);
      // Don't throw - allow the service to work without cache
      this.cacheWarmed = true;
    }
  }

  /**
   * Get or generate embedding for a game title
   * Caches the result in memory and database
   */
  async getOrCreateEmbedding(gameId: number, title: string): Promise<number[]> {
    const titleHash = this.hashTitle(title);

    // Check memory cache first
    const cached = this.cache.get(gameId);
    if (cached && cached.titleHash === titleHash) {
      return cached.embedding;
    }

    // Check database
    const dbEmbedding = await gameEmbeddingRepository.findByGameId(gameId);
    if (dbEmbedding && dbEmbedding.titleHash === titleHash) {
      const embedding = gameEmbeddingRepository.parseEmbedding(dbEmbedding.embedding);
      this.cache.set(gameId, {
        gameId,
        title,
        titleHash,
        embedding,
      });
      return embedding;
    }

    // Generate new embedding
    const embedding = await embeddingService.embed(title);

    // Save to database
    await gameEmbeddingRepository.upsert(gameId, titleHash, embedding);

    // Update cache
    this.cache.set(gameId, {
      gameId,
      title,
      titleHash,
      embedding,
    });

    return embedding;
  }

  /**
   * Re-rank IGDB search results by semantic similarity to the query
   * Returns results sorted by combined IGDB rank + semantic similarity
   */
  async rerankIGDBResults(
    query: string,
    results: GameSearchResult[]
  ): Promise<GameSearchResult[]> {
    if (results.length === 0) return [];

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.embed(query);

      // Generate embeddings for all result titles
      const titles = results.map((r) => r.title);
      const embeddings = await embeddingService.embedBatch(titles);

      // Calculate similarity scores
      const scored = results.map((result, index) => {
        const similarity = embeddingService.cosineSimilarity(queryEmbedding, embeddings[index]);
        // Normalize to 0-1 range
        const normalizedSimilarity = (similarity + 1) / 2;
        return {
          result,
          similarity: normalizedSimilarity,
          // Combined score: 70% semantic + 30% original rank (inverted)
          combinedScore: normalizedSimilarity * 0.7 + (1 - index / results.length) * 0.3,
        };
      });

      // Sort by combined score descending
      scored.sort((a, b) => b.combinedScore - a.combinedScore);

      logger.debug(
        `Re-ranked ${results.length} results. Top: "${scored[0]?.result.title}" (sim: ${scored[0]?.similarity.toFixed(3)})`
      );

      return scored.map((s) => s.result);
    } catch (error) {
      logger.error('Failed to re-rank IGDB results, returning original order:', error);
      return results;
    }
  }

  /**
   * Find the best IGDB match for a game name
   * Returns the result with highest semantic similarity, or null if no good match
   */
  async findBestMatch(
    gameName: string,
    igdbResults: GameSearchResult[],
    minSimilarity = 0.7
  ): Promise<{ result: GameSearchResult; similarity: number } | null> {
    if (igdbResults.length === 0) return null;

    try {
      const queryEmbedding = await embeddingService.embed(gameName);
      const titles = igdbResults.map((r) => r.title);
      const embeddings = await embeddingService.embedBatch(titles);

      let bestMatch: { result: GameSearchResult; similarity: number } | null = null;

      for (let i = 0; i < igdbResults.length; i++) {
        const rawSimilarity = embeddingService.cosineSimilarity(queryEmbedding, embeddings[i]);
        const similarity = (rawSimilarity + 1) / 2; // Normalize to 0-1

        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { result: igdbResults[i], similarity };
        }
      }

      if (bestMatch && bestMatch.similarity >= minSimilarity) {
        logger.debug(
          `Best match for "${gameName}": "${bestMatch.result.title}" (similarity: ${bestMatch.similarity.toFixed(3)})`
        );
        return bestMatch;
      }

      logger.debug(
        `No good match for "${gameName}" (best: ${bestMatch?.similarity.toFixed(3) || 'none'})`
      );
      return null;
    } catch (error) {
      logger.error('Failed to find best match:', error);
      return null;
    }
  }

  /**
   * Score release title similarity against game title
   * Returns a value between 0 and 1 (1 = perfect match)
   */
  async scoreReleaseSimilarity(
    releaseTitle: string,
    gameTitle: string
  ): Promise<number> {
    try {
      return await embeddingService.similarity(releaseTitle, gameTitle);
    } catch (error) {
      logger.error('Failed to score release similarity:', error);
      return 0.5; // Neutral score on failure
    }
  }

  /**
   * Invalidate cache for a specific game
   * Called when a game is deleted or title changes
   */
  invalidateGame(gameId: number): void {
    this.cache.delete(gameId);
  }

  /**
   * Clear all cached embeddings
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    await gameEmbeddingRepository.deleteAll();
    this.cacheWarmed = false;
    logger.info('Semantic search cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cached: number; warmed: boolean } {
    return {
      cached: this.cache.size,
      warmed: this.cacheWarmed,
    };
  }
}

// Singleton instance
export const semanticSearchService = new SemanticSearchService();
