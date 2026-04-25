import { Hono } from 'hono';
import { jobRegistry } from '../jobs/JobRegistry';

const router = new Hono();

router.get('/', (c) => {
  return c.json({ success: true, data: jobRegistry.list() });
});

router.post('/:name/run', async (c) => {
  const name = c.req.param('name');
  const result = await jobRegistry.trigger(name);
  if (!result.ok) {
    const status = result.reason === 'Job not found' ? 404 : 409;
    return c.json({ success: false, error: result.reason }, status);
  }
  return c.json({ success: true });
});

export default router;
