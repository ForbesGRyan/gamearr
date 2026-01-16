import { eq, gt, and, lt } from 'drizzle-orm';
import { db } from '../db';
import { sessions, users, type Session, type User } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const sessionFields = {
  id: sessions.id,
  userId: sessions.userId,
  token: sessions.token,
  expiresAt: sessions.expiresAt,
  createdAt: sessions.createdAt,
};

// User fields for joins (excluding sensitive data)
const userFields = {
  id: users.id,
  username: users.username,
  role: users.role,
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
};

export type SessionWithUser = Session & {
  user: {
    id: number;
    username: string;
    role: 'admin' | 'user';
    createdAt: Date;
    lastLoginAt: Date | null;
  };
};

export class SessionRepository {
  /**
   * Create a new session
   */
  async create(userId: number, token: string, expiresAt: Date): Promise<Session> {
    logger.info(`Creating session for user ID: ${userId}`);

    const result = await db
      .insert(sessions)
      .values({ userId, token, expiresAt })
      .returning(sessionFields);

    return result[0];
  }

  /**
   * Find session by token
   */
  async findByToken(token: string): Promise<Session | null> {
    const results = await db
      .select(sessionFields)
      .from(sessions)
      .where(eq(sessions.token, token));

    return results[0] || null;
  }

  /**
   * Find valid (non-expired) session by token with user data
   */
  async findValidSessionWithUser(token: string): Promise<SessionWithUser | null> {
    const results = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        token: sessions.token,
        expiresAt: sessions.expiresAt,
        createdAt: sessions.createdAt,
        user: userFields,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date())
        )
      );

    if (!results[0]) return null;

    const row = results[0];
    return {
      id: row.id,
      userId: row.userId,
      token: row.token,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      user: row.user,
    };
  }

  /**
   * Delete session by token
   */
  async delete(token: string): Promise<void> {
    logger.info('Deleting session');
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: number): Promise<void> {
    logger.info(`Deleting all sessions for user ID: ${userId}`);
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  /**
   * Delete all expired sessions
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });

    const deletedCount = result.length;
    if (deletedCount > 0) {
      logger.info(`Deleted ${deletedCount} expired sessions`);
    }
    return deletedCount;
  }

  /**
   * Get all sessions for a user
   */
  async getAllForUser(userId: number): Promise<Session[]> {
    return db
      .select(sessionFields)
      .from(sessions)
      .where(eq(sessions.userId, userId));
  }
}

// Singleton instance
export const sessionRepository = new SessionRepository();
