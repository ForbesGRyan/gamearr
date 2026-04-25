import { Hono } from 'hono';
import { taskRepository } from '../queue/TaskRepository';
import { logger } from '../utils/logger';
import type { TaskStatus } from '../queue/types';

const router = new Hono();

const VALID_STATUS: ReadonlyArray<TaskStatus> = ['pending', 'running', 'done', 'dead'];

router.get('/', (c) => {
  const statusParam = c.req.query('status');
  const kind = c.req.query('kind');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100', 10) || 100, 500);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

  const status =
    statusParam && (VALID_STATUS as readonly string[]).includes(statusParam)
      ? (statusParam as TaskStatus)
      : undefined;

  try {
    const tasks = taskRepository.list({ status, kind, limit, offset });
    return c.json({ success: true, data: tasks });
  } catch (err) {
    logger.error('GET /tasks error:', err);
    return c.json({ success: false, error: 'Failed to list tasks' }, 500);
  }
});

router.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400);
  const task = taskRepository.findById(id);
  if (!task) return c.json({ success: false, error: 'Task not found' }, 404);
  return c.json({ success: true, data: task });
});

router.post('/:id/retry', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400);
  const ok = taskRepository.requeue(id);
  if (!ok) {
    return c.json(
      { success: false, error: 'Task not found, or not in dead status' },
      409
    );
  }
  return c.json({ success: true, data: taskRepository.findById(id) });
});

router.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400);
  const task = taskRepository.findById(id);
  if (!task) return c.json({ success: false, error: 'Task not found' }, 404);
  if (task.status === 'done') {
    return c.json(
      { success: false, error: 'Cannot delete completed tasks (kept as audit log; archived after 7 days)' },
      409
    );
  }
  if (task.status === 'running') {
    return c.json(
      { success: false, error: 'Cannot delete running tasks; wait for them to finish' },
      409
    );
  }
  const ok = taskRepository.delete(id);
  if (!ok) return c.json({ success: false, error: 'Task not found' }, 404);
  return c.json({ success: true });
});

export default router;
