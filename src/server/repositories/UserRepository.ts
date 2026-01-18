import { eq, count } from 'drizzle-orm';
import { db } from '../db';
import { users, type User, type NewUser } from '../db/schema';
import { logger } from '../utils/logger';

// Explicit field selection to avoid SELECT *
const userFields = {
  id: users.id,
  username: users.username,
  passwordHash: users.passwordHash,
  role: users.role,
  apiKeyHash: users.apiKeyHash,
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
};

// Public user fields (excludes password hash and API key hash)
const publicUserFields = {
  id: users.id,
  username: users.username,
  role: users.role,
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
};

export type PublicUser = {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'viewer';
  createdAt: Date;
  lastLoginAt: Date | null;
};

export class UserRepository {
  /**
   * Create a new user
   */
  async create(username: string, passwordHash: string, role: 'admin' | 'user' | 'viewer' = 'user'): Promise<User> {
    logger.info(`Creating user: ${username}`);

    const result = await db
      .insert(users)
      .values({ username, passwordHash, role })
      .returning(userFields);

    return result[0];
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<User | null> {
    const results = await db
      .select(userFields)
      .from(users)
      .where(eq(users.id, id));

    return results[0] || null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const results = await db
      .select(userFields)
      .from(users)
      .where(eq(users.username, username));

    return results[0] || null;
  }

  /**
   * Find user by API key hash
   */
  async findByApiKeyHash(hash: string): Promise<User | null> {
    const results = await db
      .select(userFields)
      .from(users)
      .where(eq(users.apiKeyHash, hash));

    return results[0] || null;
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  /**
   * Update user's password hash
   */
  async updatePassword(id: number, passwordHash: string): Promise<void> {
    logger.info(`Updating password for user ID: ${id}`);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id));
  }

  /**
   * Update user's API key hash
   */
  async updateApiKeyHash(id: number, apiKeyHash: string | null): Promise<void> {
    logger.info(`Updating API key for user ID: ${id}`);
    await db
      .update(users)
      .set({ apiKeyHash })
      .where(eq(users.id, id));
  }

  /**
   * Get all users (public fields only)
   */
  async getAll(): Promise<PublicUser[]> {
    return db.select(publicUserFields).from(users);
  }

  /**
   * Delete user by ID
   */
  async delete(id: number): Promise<void> {
    logger.info(`Deleting user ID: ${id}`);
    await db.delete(users).where(eq(users.id, id));
  }

  /**
   * Count total users
   */
  async count(): Promise<number> {
    const result = await db.select({ count: count() }).from(users);
    return result[0]?.count ?? 0;
  }

  /**
   * Check if any users exist
   */
  async hasAnyUsers(): Promise<boolean> {
    const userCount = await this.count();
    return userCount > 0;
  }
}

// Singleton instance
export const userRepository = new UserRepository();
