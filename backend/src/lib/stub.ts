import type { RequestHandler } from 'express';

// Placeholder handler for endpoints whose business logic lands in the next
// increment. Returns 501 so the route surface is exercisable end-to-end now
// (auth/validation middleware still runs before this).
export const stub =
  (endpoint: string): RequestHandler =>
  (_req, res) => {
    res.status(501).json({ error: 'No implementado', code: 'NOT_IMPLEMENTED', endpoint });
  };
