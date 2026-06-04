import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { notFound } from './lib/errors';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { availabilityRouter } from './modules/availability/availability.routes';
import { healthRouter } from './modules/health/health.routes';
import { meRouter } from './modules/me/me.routes';
import { reservarRouter, reservationsRouter } from './modules/reservations/reservations.routes';
import { tariffsRouter } from './modules/tariffs/tariffs.routes';

// Builds the Express app without listening — reused by server.ts and tests.
export function buildApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Health checks before the rate limiter so probes are never throttled.
  app.use('/', healthRouter);

  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

  app.use('/auth', authRouter);
  app.use('/availability', availabilityRouter);
  app.use('/tariffs', tariffsRouter);
  app.use('/me', meRouter);
  app.use('/reservar', reservarRouter);
  app.use('/reservations', reservationsRouter);
  app.use('/admin', adminRouter);

  // Unknown route -> 404, then the central error handler (must be last).
  app.use((req, _res, next) => next(notFound(`Ruta no encontrada: ${req.method} ${req.path}`)));
  app.use(errorHandler);

  return app;
}
