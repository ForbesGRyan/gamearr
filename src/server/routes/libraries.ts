import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { libraryService } from '../services/LibraryService';
import { logger } from '../utils/logger';
import { formatErrorResponse, getHttpStatusCode } from '../utils/errors';

// Validation schemas
const createLibrarySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required'),
  platform: z.string().optional(),
  monitored: z.boolean().optional(),
  downloadEnabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

const updateLibrarySchema = z.object({
  name: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  platform: z.string().nullable().optional(),
  monitored: z.boolean().optional(),
  downloadEnabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

const testPathSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

const librariesRouter = new Hono();

// GET /api/v1/libraries - Get all libraries
librariesRouter.get('/', async (c) => {
  logger.info('GET /api/v1/libraries');

  try {
    const libraries = await libraryService.getAllLibraries();
    return c.json({ success: true, data: libraries });
  } catch (error) {
    logger.error('Failed to get libraries:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/libraries/platforms - Get unique platforms
librariesRouter.get('/platforms', async (c) => {
  logger.info('GET /api/v1/libraries/platforms');

  try {
    const platforms = await libraryService.getUniquePlatforms();
    return c.json({ success: true, data: platforms });
  } catch (error) {
    logger.error('Failed to get platforms:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/libraries/test-path - Test if a path is valid
librariesRouter.post('/test-path', zValidator('json', testPathSchema), async (c) => {
  logger.info('POST /api/v1/libraries/test-path');

  try {
    const { path } = c.req.valid('json');
    const result = await libraryService.testPath(path);
    return c.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to test path:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// POST /api/v1/libraries - Create a new library
librariesRouter.post('/', zValidator('json', createLibrarySchema), async (c) => {
  logger.info('POST /api/v1/libraries');

  try {
    const input = c.req.valid('json');
    const library = await libraryService.createLibrary(input);
    return c.json({ success: true, data: library }, 201);
  } catch (error) {
    logger.error('Failed to create library:', error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// GET /api/v1/libraries/:id - Get library by ID
librariesRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  logger.info(`GET /api/v1/libraries/${id}`);

  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid library ID' }, 400);
  }

  try {
    const library = await libraryService.getLibrary(id);
    if (!library) {
      return c.json({ success: false, error: 'Library not found' }, 404);
    }
    return c.json({ success: true, data: library });
  } catch (error) {
    logger.error(`Failed to get library ${id}:`, error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// PUT /api/v1/libraries/:id - Update a library
librariesRouter.put('/:id', zValidator('json', updateLibrarySchema), async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  logger.info(`PUT /api/v1/libraries/${id}`);

  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid library ID' }, 400);
  }

  try {
    const input = c.req.valid('json');
    const library = await libraryService.updateLibrary(id, input);
    if (!library) {
      return c.json({ success: false, error: 'Library not found' }, 404);
    }
    return c.json({ success: true, data: library });
  } catch (error) {
    logger.error(`Failed to update library ${id}:`, error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

// DELETE /api/v1/libraries/:id - Delete a library
librariesRouter.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  logger.info(`DELETE /api/v1/libraries/${id}`);

  if (isNaN(id)) {
    return c.json({ success: false, error: 'Invalid library ID' }, 400);
  }

  try {
    const deleted = await libraryService.deleteLibrary(id);
    if (!deleted) {
      return c.json({ success: false, error: 'Library not found' }, 404);
    }
    return c.json({ success: true, message: 'Library deleted successfully' });
  } catch (error) {
    logger.error(`Failed to delete library ${id}:`, error);
    return c.json(formatErrorResponse(error), getHttpStatusCode(error));
  }
});

export default librariesRouter;
