import { Router } from 'express';
import { pool } from '../../db';

export const healthRouter: Router = Router();

// Liveness — no auth, no DB (ECS health check).
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Readiness — verifies DB connectivity.
healthRouter.get('/ready', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
