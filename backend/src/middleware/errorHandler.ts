import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validación fallida',
      code: 'BAD_REQUEST',
      details: err.flatten(),
    });
    return;
  }

  // Postgres unique violation -> 409 (e.g. the partial unique indexes that
  // prevent double-booking, data-model.md §5).
  if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
    res.status(409).json({
      error: 'Conflicto: el recurso ya existe o el espacio ya está reservado',
      code: 'CONFLICT',
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL' });
};
