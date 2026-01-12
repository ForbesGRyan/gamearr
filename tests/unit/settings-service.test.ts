import { describe, expect, test, beforeEach, mock } from 'bun:test';

// =============================================================================
// Mock Dependencies
// =============================================================================

// Mock settings repository
const mockSettingsRepository = {
  get: mock(() => Promise.resolve(null as string | null)),
  set: mock(() => Promise.resolve()),
  getJSON: mock(() => Promise.resolve(null)),
  setJSON: mock(() => Promise.resolve()),
  getAll: mock(() => Promise.resolve([])),
  delete: mock(() => Promise.resolve()),
};

// Mock logger
const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
};

// =============================================================================
// SettingsService Test Implementation
// =============================================================================

/**
 * This is a test implementation of the SettingsService migrateSettings logic
 * that mirrors the actual implementation for testing purposes
 */
class TestSettingsService {
  private cache = new Map<string, { value: string | null; expiresAt: number }>();

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Migrate settings from old keys to new keys
   */
  async migrateSettings(
    keyMigrations: Array<{
      oldKey: string;
      newKey: string;
      transform?: (value: string) => string;
    }>
  ): Promise<{
    migrated: number;
    failed: number;
    details: Array<{ oldKey: string; newKey: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ oldKey: string; newKey: string; success: boolean; error?: string }> = [];
    let migrated = 0;
    let failed = 0;

    for (const migration of keyMigrations) {
      try {
        // Check if old key exists
        const oldValue = await mockSettingsRepository.get(migration.oldKey);
        if (oldValue === null) {
          // Old key doesn't exist, no migration needed
          continue;
        }

        // Check if new key already exists (don't overwrite)
        const newValue = await mockSettingsRepository.get(migration.newKey);
        if (newValue !== null) {
          mockLogger.info(
            `Migration skipped: ${migration.oldKey} -> ${migration.newKey} (new key already exists)`
          );
          results.push({
            oldKey: migration.oldKey,
            newKey: migration.newKey,
            success: true,
            error: 'New key already exists, migration skipped',
          });
          continue;
        }

        // Apply transformation if provided
        const valueToMigrate = migration.transform ? migration.transform(oldValue) : oldValue;

        // Set new key with migrated value
        await mockSettingsRepository.set(migration.newKey, valueToMigrate);

        // Delete old key
        await mockSettingsRepository.delete(migration.oldKey);

        // Invalidate cache for both keys
        this.invalidateCache(migration.oldKey);
        this.invalidateCache(migration.newKey);

        mockLogger.info(`Migrated setting: ${migration.oldKey} -> ${migration.newKey}`);
        results.push({
          oldKey: migration.oldKey,
          newKey: migration.newKey,
          success: true,
        });
        migrated++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        mockLogger.error(
          `Failed to migrate setting ${migration.oldKey} -> ${migration.newKey}:`,
          error
        );
        results.push({
          oldKey: migration.oldKey,
          newKey: migration.newKey,
          success: false,
          error: errorMessage,
        });
        failed++;
      }
    }

    mockLogger.info(`Settings migration complete: ${migrated} migrated, ${failed} failed`);
    return { migrated, failed, details: results };
  }

  /**
   * Migrate a single setting from old key to new key
   */
  async migrateSingleSetting(
    oldKey: string,
    newKey: string,
    transform?: (value: string) => string
  ): Promise<boolean> {
    // Check if old key exists
    const oldValue = await mockSettingsRepository.get(oldKey);
    if (oldValue === null) {
      mockLogger.info(`Migration skipped: ${oldKey} does not exist`);
      return false;
    }

    // Check if new key already exists (don't overwrite)
    const newValue = await mockSettingsRepository.get(newKey);
    if (newValue !== null) {
      mockLogger.info(`Migration skipped: ${newKey} already exists`);
      return false;
    }

    // Apply transformation if provided
    const valueToMigrate = transform ? transform(oldValue) : oldValue;

    // Set new key with migrated value
    await mockSettingsRepository.set(newKey, valueToMigrate);

    // Delete old key
    await mockSettingsRepository.delete(oldKey);

    // Invalidate cache for both keys
    this.invalidateCache(oldKey);
    this.invalidateCache(newKey);

    mockLogger.info(`Migrated setting: ${oldKey} -> ${newKey}`);
    return true;
  }
}

// =============================================================================
// Tests for migrateSettings
// =============================================================================

describe('SettingsService.migrateSettings', () => {
  let settingsService: TestSettingsService;

  beforeEach(() => {
    // Reset all mocks before each test
    mockSettingsRepository.get.mockClear();
    mockSettingsRepository.set.mockClear();
    mockSettingsRepository.delete.mockClear();
    mockSettingsRepository.getAll.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();

    // Reset mock implementations to default
    mockSettingsRepository.get.mockImplementation(() => Promise.resolve(null));
    mockSettingsRepository.set.mockImplementation(() => Promise.resolve());
    mockSettingsRepository.delete.mockImplementation(() => Promise.resolve());

    settingsService = new TestSettingsService();
    settingsService.clearCache();
  });

  describe('with empty migration list', () => {
    test('should return zero counts with no migrations', async () => {
      const result = await settingsService.migrateSettings([]);

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toEqual([]);
    });
  });

  describe('when old key does not exist', () => {
    test('should skip migration when old key is not found', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      const result = await settingsService.migrateSettings([
        { oldKey: 'old_setting', newKey: 'new_setting' },
      ]);

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details).toEqual([]);
      expect(mockSettingsRepository.set).not.toHaveBeenCalled();
      expect(mockSettingsRepository.delete).not.toHaveBeenCalled();
    });

    test('should not call delete when old key does not exist', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      await settingsService.migrateSettings([
        { oldKey: 'nonexistent_key', newKey: 'new_key' },
      ]);

      expect(mockSettingsRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('when new key already exists', () => {
    test('should skip migration and not overwrite existing new key', async () => {
      // First call returns old value, second call returns existing new value
      let callCount = 0;
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_setting') return Promise.resolve('old_value');
        if (key === 'new_setting') return Promise.resolve('existing_new_value');
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSettings([
        { oldKey: 'old_setting', newKey: 'new_setting' },
      ]);

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.details.length).toBe(1);
      expect(result.details[0].success).toBe(true);
      expect(result.details[0].error).toBe('New key already exists, migration skipped');
      expect(mockSettingsRepository.set).not.toHaveBeenCalled();
      expect(mockSettingsRepository.delete).not.toHaveBeenCalled();
    });

    test('should preserve existing value when new key exists', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('old_value');
        if (key === 'new_key') return Promise.resolve('preserved_value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([{ oldKey: 'old_key', newKey: 'new_key' }]);

      // set should not be called since new key exists
      expect(mockSettingsRepository.set).not.toHaveBeenCalled();
    });
  });

  describe('successful migration', () => {
    test('should migrate value from old key to new key', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_setting') return Promise.resolve('test_value');
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSettings([
        { oldKey: 'old_setting', newKey: 'new_setting' },
      ]);

      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.details.length).toBe(1);
      expect(result.details[0].success).toBe(true);
      expect(result.details[0].oldKey).toBe('old_setting');
      expect(result.details[0].newKey).toBe('new_setting');
    });

    test('should call set with correct key and value', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'prowlarr_host') return Promise.resolve('http://localhost:9696');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        { oldKey: 'prowlarr_host', newKey: 'prowlarr_url' },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith(
        'prowlarr_url',
        'http://localhost:9696'
      );
    });

    test('should delete old key after migration', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([{ oldKey: 'old_key', newKey: 'new_key' }]);

      expect(mockSettingsRepository.delete).toHaveBeenCalledWith('old_key');
    });
  });

  describe('with value transformation', () => {
    test('should apply transform function to value', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_url') return Promise.resolve('localhost:9696');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'old_url',
          newKey: 'new_url',
          transform: (value) => `http://${value}`,
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('new_url', 'http://localhost:9696');
    });

    test('should handle complex transformations', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'categories_csv') return Promise.resolve('4050,4000,1000');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'categories_csv',
          newKey: 'categories_json',
          transform: (value) => JSON.stringify(value.split(',').map(Number)),
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('categories_json', '[4050,4000,1000]');
    });

    test('should not transform when transform is undefined', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'simple_key') return Promise.resolve('simple_value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([{ oldKey: 'simple_key', newKey: 'new_simple_key' }]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('new_simple_key', 'simple_value');
    });
  });

  describe('multiple migrations', () => {
    test('should process multiple migrations in order', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key_1') return Promise.resolve('value1');
        if (key === 'old_key_2') return Promise.resolve('value2');
        if (key === 'old_key_3') return Promise.resolve('value3');
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSettings([
        { oldKey: 'old_key_1', newKey: 'new_key_1' },
        { oldKey: 'old_key_2', newKey: 'new_key_2' },
        { oldKey: 'old_key_3', newKey: 'new_key_3' },
      ]);

      expect(result.migrated).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.details.length).toBe(3);
    });

    test('should handle mixed results (some migrations, some skips)', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'exists_old') return Promise.resolve('value');
        if (key === 'exists_new') return Promise.resolve('existing_value'); // new key exists
        if (key === 'missing_old') return Promise.resolve(null); // old key doesn't exist
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSettings([
        { oldKey: 'exists_old', newKey: 'target_1' }, // Should migrate
        { oldKey: 'exists_old', newKey: 'exists_new' }, // Should skip (new exists)
        { oldKey: 'missing_old', newKey: 'target_2' }, // Should skip (old doesn't exist)
      ]);

      expect(result.migrated).toBe(1);
      expect(result.details.filter((d) => d.success && !d.error).length).toBe(1);
    });
  });

  describe('error handling', () => {
    test('should continue processing after an error', async () => {
      let setCallCount = 0;
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'key_1' || key === 'key_2' || key === 'key_3')
          return Promise.resolve('value');
        return Promise.resolve(null);
      });
      mockSettingsRepository.set.mockImplementation((key: string) => {
        setCallCount++;
        if (key === 'new_key_2') {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve();
      });

      const result = await settingsService.migrateSettings([
        { oldKey: 'key_1', newKey: 'new_key_1' },
        { oldKey: 'key_2', newKey: 'new_key_2' }, // This will fail
        { oldKey: 'key_3', newKey: 'new_key_3' },
      ]);

      expect(result.migrated).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.details.find((d) => d.newKey === 'new_key_2')?.success).toBe(false);
      expect(result.details.find((d) => d.newKey === 'new_key_2')?.error).toBe('Database error');
    });

    test('should capture error message in details', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'failing_key') return Promise.resolve('value');
        return Promise.resolve(null);
      });
      mockSettingsRepository.set.mockRejectedValue(new Error('Connection failed'));

      const result = await settingsService.migrateSettings([
        { oldKey: 'failing_key', newKey: 'new_failing_key' },
      ]);

      expect(result.failed).toBe(1);
      expect(result.details[0].error).toBe('Connection failed');
    });

    test('should handle non-Error exceptions', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'key') return Promise.resolve('value');
        return Promise.resolve(null);
      });
      mockSettingsRepository.set.mockRejectedValue('String error');

      const result = await settingsService.migrateSettings([{ oldKey: 'key', newKey: 'new_key' }]);

      expect(result.failed).toBe(1);
      expect(result.details[0].error).toBe('Unknown error');
    });
  });

  describe('cache invalidation', () => {
    test('should invalidate cache for both old and new keys on successful migration', async () => {
      const service = new TestSettingsService();
      // Pre-populate cache
      (service as any).cache.set('old_key', { value: 'cached_old', expiresAt: Date.now() + 60000 });
      (service as any).cache.set('new_key', { value: 'cached_new', expiresAt: Date.now() + 60000 });

      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('db_value');
        return Promise.resolve(null);
      });

      await service.migrateSettings([{ oldKey: 'old_key', newKey: 'new_key' }]);

      expect((service as any).cache.has('old_key')).toBe(false);
      expect((service as any).cache.has('new_key')).toBe(false);
    });
  });

  describe('logging', () => {
    test('should log successful migration', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([{ oldKey: 'old_key', newKey: 'new_key' }]);

      expect(mockLogger.info).toHaveBeenCalledWith('Migrated setting: old_key -> new_key');
    });

    test('should log skip when new key exists', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('old_value');
        if (key === 'new_key') return Promise.resolve('new_value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([{ oldKey: 'old_key', newKey: 'new_key' }]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Migration skipped: old_key -> new_key (new key already exists)'
      );
    });

    test('should log error on failure', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('value');
        return Promise.resolve(null);
      });
      mockSettingsRepository.set.mockRejectedValue(new Error('DB Error'));

      await settingsService.migrateSettings([{ oldKey: 'old_key', newKey: 'new_key' }]);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should log completion summary', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      await settingsService.migrateSettings([]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Settings migration complete: 0 migrated, 0 failed'
      );
    });
  });
});

// =============================================================================
// Tests for migrateSingleSetting
// =============================================================================

describe('SettingsService.migrateSingleSetting', () => {
  let settingsService: TestSettingsService;

  beforeEach(() => {
    mockSettingsRepository.get.mockClear();
    mockSettingsRepository.set.mockClear();
    mockSettingsRepository.delete.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();

    mockSettingsRepository.get.mockImplementation(() => Promise.resolve(null));
    mockSettingsRepository.set.mockImplementation(() => Promise.resolve());
    mockSettingsRepository.delete.mockImplementation(() => Promise.resolve());

    settingsService = new TestSettingsService();
    settingsService.clearCache();
  });

  describe('when old key does not exist', () => {
    test('should return false when old key is not found', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      const result = await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(result).toBe(false);
    });

    test('should not modify anything when old key is not found', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(mockSettingsRepository.set).not.toHaveBeenCalled();
      expect(mockSettingsRepository.delete).not.toHaveBeenCalled();
    });

    test('should log skip message', async () => {
      mockSettingsRepository.get.mockResolvedValue(null);

      await settingsService.migrateSingleSetting('nonexistent', 'new_key');

      expect(mockLogger.info).toHaveBeenCalledWith('Migration skipped: nonexistent does not exist');
    });
  });

  describe('when new key already exists', () => {
    test('should return false when new key exists', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('old_value');
        if (key === 'new_key') return Promise.resolve('existing_value');
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(result).toBe(false);
    });

    test('should not overwrite existing new key', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('old_value');
        if (key === 'new_key') return Promise.resolve('existing_value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(mockSettingsRepository.set).not.toHaveBeenCalled();
    });

    test('should log skip message when new key exists', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('old_value');
        if (key === 'new_key') return Promise.resolve('existing_value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(mockLogger.info).toHaveBeenCalledWith('Migration skipped: new_key already exists');
    });
  });

  describe('successful migration', () => {
    test('should return true on successful migration', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('value');
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(result).toBe(true);
    });

    test('should set new key with value', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('migrated_value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('new_key', 'migrated_value');
    });

    test('should delete old key', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(mockSettingsRepository.delete).toHaveBeenCalledWith('old_key');
    });

    test('should log success message', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(mockLogger.info).toHaveBeenCalledWith('Migrated setting: old_key -> new_key');
    });
  });

  describe('with transformation', () => {
    test('should apply transform function', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_url') return Promise.resolve('localhost:8080');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_url', 'new_url', (value) => `http://${value}`);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('new_url', 'http://localhost:8080');
    });

    test('should handle JSON transformation', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_list') return Promise.resolve('item1,item2,item3');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_list', 'new_list', (value) =>
        JSON.stringify(value.split(','))
      );

      expect(mockSettingsRepository.set).toHaveBeenCalledWith(
        'new_list',
        '["item1","item2","item3"]'
      );
    });

    test('should pass through value when no transform provided', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('original_value');
        return Promise.resolve(null);
      });

      await settingsService.migrateSingleSetting('old_key', 'new_key');

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('new_key', 'original_value');
    });
  });

  describe('cache invalidation', () => {
    test('should invalidate both old and new keys in cache', async () => {
      const service = new TestSettingsService();
      (service as any).cache.set('old_key', { value: 'cached', expiresAt: Date.now() + 60000 });
      (service as any).cache.set('new_key', { value: 'cached', expiresAt: Date.now() + 60000 });

      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_key') return Promise.resolve('db_value');
        return Promise.resolve(null);
      });

      await service.migrateSingleSetting('old_key', 'new_key');

      expect((service as any).cache.has('old_key')).toBe(false);
      expect((service as any).cache.has('new_key')).toBe(false);
    });
  });
});

// =============================================================================
// Real-world Migration Scenarios
// =============================================================================

describe('SettingsService Migration Scenarios', () => {
  let settingsService: TestSettingsService;

  beforeEach(() => {
    mockSettingsRepository.get.mockClear();
    mockSettingsRepository.set.mockClear();
    mockSettingsRepository.delete.mockClear();
    mockLogger.info.mockClear();

    mockSettingsRepository.get.mockImplementation(() => Promise.resolve(null));
    mockSettingsRepository.set.mockImplementation(() => Promise.resolve());
    mockSettingsRepository.delete.mockImplementation(() => Promise.resolve());

    settingsService = new TestSettingsService();
    settingsService.clearCache();
  });

  describe('Prowlarr settings migration', () => {
    test('should migrate prowlarr_host to prowlarr_url', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'prowlarr_host') return Promise.resolve('http://localhost:9696');
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSettings([
        { oldKey: 'prowlarr_host', newKey: 'prowlarr_url' },
      ]);

      expect(result.migrated).toBe(1);
      expect(mockSettingsRepository.set).toHaveBeenCalledWith(
        'prowlarr_url',
        'http://localhost:9696'
      );
    });
  });

  describe('qBittorrent settings migration', () => {
    test('should migrate shortened qbit keys to full keys', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'qbit_host') return Promise.resolve('http://localhost:8080');
        if (key === 'qbit_user') return Promise.resolve('admin');
        if (key === 'qbit_pass') return Promise.resolve('password123');
        return Promise.resolve(null);
      });

      const result = await settingsService.migrateSettings([
        { oldKey: 'qbit_host', newKey: 'qbittorrent_host' },
        { oldKey: 'qbit_user', newKey: 'qbittorrent_username' },
        { oldKey: 'qbit_pass', newKey: 'qbittorrent_password' },
      ]);

      expect(result.migrated).toBe(3);
    });
  });

  describe('Category format migration', () => {
    test('should migrate CSV categories to JSON format', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'indexer_categories_csv') return Promise.resolve('4050,4000,1000');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'indexer_categories_csv',
          newKey: 'prowlarr_categories',
          transform: (value) => JSON.stringify(value.split(',').map(Number)),
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith(
        'prowlarr_categories',
        '[4050,4000,1000]'
      );
    });
  });

  describe('Boolean format migration', () => {
    test('should migrate string boolean to JSON boolean', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'dry_run_string') return Promise.resolve('true');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'dry_run_string',
          newKey: 'dry_run',
          transform: (value) => JSON.stringify(value === 'true'),
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('dry_run', 'true');
    });

    test('should handle false boolean migration', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'enabled_string') return Promise.resolve('false');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'enabled_string',
          newKey: 'enabled',
          transform: (value) => JSON.stringify(value === 'true'),
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('enabled', 'false');
    });
  });

  describe('URL normalization migration', () => {
    test('should add protocol to URL without one', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_url') return Promise.resolve('localhost:9696');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'old_url',
          newKey: 'new_url',
          transform: (value) => (value.startsWith('http') ? value : `http://${value}`),
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('new_url', 'http://localhost:9696');
    });

    test('should preserve existing protocol in URL', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'old_url') return Promise.resolve('https://secure.example.com');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'old_url',
          newKey: 'new_url',
          transform: (value) => (value.startsWith('http') ? value : `http://${value}`),
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith(
        'new_url',
        'https://secure.example.com'
      );
    });
  });

  describe('Numeric string migration', () => {
    test('should migrate string number to JSON number', async () => {
      mockSettingsRepository.get.mockImplementation((key: string) => {
        if (key === 'interval_string') return Promise.resolve('30');
        return Promise.resolve(null);
      });

      await settingsService.migrateSettings([
        {
          oldKey: 'interval_string',
          newKey: 'rss_sync_interval',
          transform: (value) => JSON.stringify(parseInt(value, 10)),
        },
      ]);

      expect(mockSettingsRepository.set).toHaveBeenCalledWith('rss_sync_interval', '30');
    });
  });
});
