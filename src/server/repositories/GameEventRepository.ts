import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { gameEvents, type GameEvent, type NewGameEvent } from '../db/schema';
import { logger } from '../utils/logger';

// Event data types for each event type
export interface SteamImportEventData {
  steamAppId: number;
  steamName: string;
  matchedTitle: string;
  igdbId: number;
}

export interface GogImportEventData {
  gogId: number;
  gogTitle: string;
  matchedTitle: string;
  igdbId: number;
}

export interface IgdbRematchEventData {
  previousIgdbId: number;
  previousTitle: string;
  previousCoverUrl?: string;
  newIgdbId: number;
  newTitle: string;
  newCoverUrl?: string;
}

export interface FolderMatchedEventData {
  folderPath: string;
  folderName: string;
  matchedTitle: string;
  igdbId: number;
}

export interface ManualImportEventData {
  igdbId: number;
  title: string;
}

export type GameEventData =
  | SteamImportEventData
  | GogImportEventData
  | IgdbRematchEventData
  | FolderMatchedEventData
  | ManualImportEventData;

class GameEventRepository {
  /**
   * Create a new game event
   */
  async create(event: NewGameEvent): Promise<GameEvent> {
    const [created] = await db.insert(gameEvents).values(event).returning();
    logger.debug(`Created game event: ${event.eventType} for game ${event.gameId}`);
    return created;
  }

  /**
   * Create a Steam import event
   */
  async createSteamImportEvent(
    gameId: number,
    data: SteamImportEventData
  ): Promise<GameEvent> {
    return this.create({
      gameId,
      eventType: 'imported_steam',
      data: JSON.stringify(data),
    });
  }

  /**
   * Create a GOG import event
   */
  async createGogImportEvent(
    gameId: number,
    data: GogImportEventData
  ): Promise<GameEvent> {
    return this.create({
      gameId,
      eventType: 'imported_gog',
      data: JSON.stringify(data),
    });
  }

  /**
   * Create an IGDB rematch event
   */
  async createRematchEvent(
    gameId: number,
    data: IgdbRematchEventData
  ): Promise<GameEvent> {
    return this.create({
      gameId,
      eventType: 'igdb_rematch',
      data: JSON.stringify(data),
    });
  }

  /**
   * Create a folder matched event
   */
  async createFolderMatchedEvent(
    gameId: number,
    data: FolderMatchedEventData
  ): Promise<GameEvent> {
    return this.create({
      gameId,
      eventType: 'folder_matched',
      data: JSON.stringify(data),
    });
  }

  /**
   * Create a manual import event
   */
  async createManualImportEvent(
    gameId: number,
    data: ManualImportEventData
  ): Promise<GameEvent> {
    return this.create({
      gameId,
      eventType: 'imported_manual',
      data: JSON.stringify(data),
    });
  }

  /**
   * Get all events for a game, sorted by most recent first
   */
  async getByGameId(gameId: number): Promise<GameEvent[]> {
    return db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.gameId, gameId))
      .orderBy(desc(gameEvents.createdAt));
  }

  /**
   * Delete all events for a game
   */
  async deleteByGameId(gameId: number): Promise<void> {
    await db.delete(gameEvents).where(eq(gameEvents.gameId, gameId));
  }
}

export const gameEventRepository = new GameEventRepository();
