import * as crypto from 'crypto';
import { userRepository, type PublicUser } from '../repositories/UserRepository';
import { sessionRepository, type SessionWithUser } from '../repositories/SessionRepository';
import { settingsRepository } from '../repositories/SettingsRepository';
import type { User, Session } from '../db/schema';
import { logger } from '../utils/logger';

// Auth settings keys
export const AUTH_SETTINGS = {
  AUTH_ENABLED: 'auth_enabled',
};

// Session duration: 7 days by default, 30 days for "remember me"
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_DURATION_EXTENDED_MS = 30 * 24 * 60 * 60 * 1000;

export interface LoginResult {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

export class AuthService {
  /**
   * Hash a password using Bun's built-in Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return Bun.password.hash(password, {
      algorithm: 'argon2id',
      memoryCost: 65536, // 64 MB
      timeCost: 3,
    });
  }

  /**
   * Verify a password against a hash using Bun's built-in verification
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await Bun.password.verify(password, hash);
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate a cryptographically secure session token
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate a cryptographically secure API key
   */
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Hash an API key using SHA-256 for storage
   */
  hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Check if authentication is enabled
   */
  async isAuthEnabled(): Promise<boolean> {
    const enabled = await settingsRepository.get(AUTH_SETTINGS.AUTH_ENABLED);
    return enabled === 'true';
  }

  /**
   * Enable authentication
   */
  async enableAuth(): Promise<void> {
    await settingsRepository.set(AUTH_SETTINGS.AUTH_ENABLED, 'true');
    logger.info('Authentication enabled');
  }

  /**
   * Disable authentication
   */
  async disableAuth(): Promise<void> {
    await settingsRepository.set(AUTH_SETTINGS.AUTH_ENABLED, 'false');
    logger.info('Authentication disabled');
  }

  /**
   * Check if any users exist
   */
  async hasAnyUsers(): Promise<boolean> {
    return userRepository.hasAnyUsers();
  }

  /**
   * Check if this is first-time setup (no users and auth not enabled)
   */
  async isFirstTimeSetup(): Promise<boolean> {
    const hasUsers = await this.hasAnyUsers();
    return !hasUsers;
  }

  /**
   * Create a new user
   */
  async createUser(
    username: string,
    password: string,
    role: 'admin' | 'user' | 'viewer' = 'user'
  ): Promise<PublicUser> {
    // Check if username already exists
    const existing = await userRepository.findByUsername(username);
    if (existing) {
      throw new Error('Username already exists');
    }

    const passwordHash = await this.hashPassword(password);
    const user = await userRepository.create(username, passwordHash, role);

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Create session for a user
   */
  async createSession(userId: number, rememberMe: boolean = false): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateSessionToken();
    const duration = rememberMe ? SESSION_DURATION_EXTENDED_MS : SESSION_DURATION_MS;
    const expiresAt = new Date(Date.now() + duration);

    await sessionRepository.create(userId, token, expiresAt);

    return { token, expiresAt };
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string, rememberMe: boolean = false): Promise<LoginResult | null> {
    const user = await userRepository.findByUsername(username);
    if (!user) {
      logger.warn(`Login failed: user not found - ${username}`);
      return null;
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      logger.warn(`Login failed: invalid password - ${username}`);
      return null;
    }

    // Update last login time
    await userRepository.updateLastLogin(user.id);

    // Create session
    const session = await this.createSession(user.id, rememberMe);

    logger.info(`User logged in: ${username}`);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: new Date(),
      },
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Validate a session token and return the user
   */
  async validateSession(token: string): Promise<PublicUser | null> {
    const sessionWithUser = await sessionRepository.findValidSessionWithUser(token);
    if (!sessionWithUser) {
      return null;
    }

    return sessionWithUser.user;
  }

  /**
   * Logout - delete session
   */
  async logout(token: string): Promise<void> {
    await sessionRepository.delete(token);
    logger.info('User logged out');
  }

  /**
   * Logout all sessions for a user
   */
  async logoutAll(userId: number): Promise<void> {
    await sessionRepository.deleteAllForUser(userId);
    logger.info(`All sessions deleted for user ID: ${userId}`);
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await userRepository.findById(userId);
    if (!user) {
      return false;
    }

    const isValid = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      logger.warn(`Password change failed: invalid current password for user ID: ${userId}`);
      return false;
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await userRepository.updatePassword(userId, newPasswordHash);

    // Optionally invalidate all other sessions (security best practice)
    // await sessionRepository.deleteAllForUser(userId);

    logger.info(`Password changed for user ID: ${userId}`);
    return true;
  }

  /**
   * Reset user password (admin action, no current password required)
   * Should only be used when auth is disabled or by admins
   */
  async resetPassword(userId: number, newPassword: string): Promise<boolean> {
    const user = await userRepository.findById(userId);
    if (!user) {
      return false;
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await userRepository.updatePassword(userId, newPasswordHash);

    logger.info(`Password reset for user ID: ${userId}`);
    return true;
  }

  /**
   * Generate a new API key for a user
   * Returns the plaintext key (only shown once!)
   */
  async generateUserApiKey(userId: number): Promise<string> {
    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashApiKey(apiKey);

    await userRepository.updateApiKeyHash(userId, apiKeyHash);

    logger.info(`API key generated for user ID: ${userId}`);
    return apiKey;
  }

  /**
   * Revoke a user's API key
   */
  async revokeUserApiKey(userId: number): Promise<void> {
    await userRepository.updateApiKeyHash(userId, null);
    logger.info(`API key revoked for user ID: ${userId}`);
  }

  /**
   * Validate an API key and return the user
   */
  async validateApiKey(apiKey: string): Promise<PublicUser | null> {
    const apiKeyHash = this.hashApiKey(apiKey);
    const user = await userRepository.findByApiKeyHash(apiKeyHash);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<PublicUser[]> {
    return userRepository.getAll();
  }

  /**
   * Delete a user (admin only)
   */
  async deleteUser(userId: number): Promise<void> {
    // Sessions will be deleted via cascade
    await userRepository.delete(userId);
    logger.info(`User deleted: ${userId}`);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<PublicUser | null> {
    const user = await userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Check if user has an API key
   */
  async userHasApiKey(userId: number): Promise<boolean> {
    const user = await userRepository.findById(userId);
    return user?.apiKeyHash != null;
  }
}

// Singleton instance
export const authService = new AuthService();
