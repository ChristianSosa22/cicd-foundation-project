import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { stub } from '../../lib/stub';
import { dateString, idParam } from '../common/validators';

// POST /reservar (UC3, Fn1) — atomic create. 201; 409 double-book / one-active-per-day.
export const reservarRouter: Router = Router();
reservarRouter.post(
  '/',
  requireAuth,
  requireRole('driver'),
  validate({
    body: z.object({
      space_id: z.number().int().positive(),
      vehicle_id: z.number().int().positive(),
      reservation_date: dateString,
    }),
  }),
  stub('POST /reservar'),
);

// /reservations/* — lifecycle transitions (UC3, Fn4, Fn5).
export const reservationsRouter: Router = Router();
reservationsRouter.use(requireAuth);
reservationsRouter.get('/:id', validate({ params: idParam }), stub('GET /reservations/:id'));
reservationsRouter.post(
  '/:id/confirm',
  requireRole('driver'),
  validate({ params: idParam }),
  stub('POST /reservations/:id/confirm'),
);
reservationsRouter.post(
  '/:id/release',
  requireRole('driver'),
  validate({ params: idParam }),
  stub('POST /reservations/:id/release'),
);
reservationsRouter.post(
  '/:id/cancel',
  requireRole('driver'),
  validate({ params: idParam }),
  stub('POST /reservations/:id/cancel'),
);
reservationsRouter.get(
  '/:id/receipt',
  validate({ params: idParam }),
  stub('GET /reservations/:id/receipt'),
);
