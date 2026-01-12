import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { gameEmbeddings, type GameEmbedding, type NewGameEmbedding } from '../db/schema';

// Explicit field selection to avoid SELECT *
const embeddingFields = {
  id: gameEmbeddings.id,
  gameId: gameEmbeddings.gameId,
  titleHash: gameEmbeddings.titleHash,
  embedding: gameEmbeddings.embedding,
  updatedAt: gameEmbeddings.updatedAt,
};

export class GameEmbeddingRepository {
  /**
   * Get embedding by game ID
   */
  async findByGameId(gameId: number): Promise<GameEmbedding | null> {
    const results = await db
      .select(embeddingFields)
      .from(gameEmbeddings)
      .where(eq(gameEmbeddings.gameId, gameId));

    return results[0] || null;
  }

  /**
   * Get all embeddings
   */
  async findAll(): Promise<GameEmbedding[]> {
    return db.select(embeddingFields).from(gameEmbeddings);
  }

  /**
   * Upsert embedding for a game
   * If the game already has an embedding, update it
   */
  async upsert(gameId: number, titleHash: string, embedding: number[]): Promise<void> {
    const embeddingJson = JSON.stringify(embedding);

    await db
      .insert(gameEmbeddings)
      .values({
        gameId,
        titleHash,
        embedding: embeddingJson,
      })
      .onConflictDoUpdate({
        target: gameEmbeddings.gameId,
        set: {
          titleHash,
          embedding: embeddingJson,
          updatedAt: sql`(unixepoch())`,
        },
      });
  }

  /**
   * Delete embedding by game ID
   */
  async deleteByGameId(gameId: number): Promise<void> {
    await db.delete(gameEmbeddings).where(eq(gameEmbeddings.gameId, gameId));
  }

  /**
   * Delete all embeddings
   */
  async deleteAll(): Promise<void> {
    await db.delete(gameEmbeddings);
  }

  /**
   * Get count of embeddings
   */
  async count(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(gameEmbeddings);
    return result[0]?.count || 0;
  }

  /**
   * Parse embedding JSON to number array
   */
  parseEmbedding(embeddingJson: string): number[] {
    return JSON.parse(embeddingJson);
  }
}

// Singleton instance
export const gameEmbeddingRepository = new GameEmbeddingRepository();
