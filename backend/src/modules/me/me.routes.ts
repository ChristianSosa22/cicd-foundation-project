import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { stub } from '../../lib/stub';
import { idParam, vehicleTypeEnum } from '../common/validators';

// Driver self-service — mounted at /me. All routes require auth.
export const meRouter: Router = Router();
meRouter.use(requireAuth);

// Vehicles / plates (Fn1, Pantalla 1)
meRouter.get('/vehicles', stub('GET /me/vehicles'));
meRouter.post(
  '/vehicles',
  validate({ body: z.object({ plate: z.string().min(1), vehicle_type: vehicleTypeEnum }) }),
  stub('POST /me/vehicles'),
);
meRouter.patch('/vehicles/:id', validate({ params: idParam }), stub('PATCH /me/vehicles/:id'));
meRouter.delete('/vehicles/:id', validate({ params: idParam }), stub('DELETE /me/vehicles/:id'));

// Own reservations (active + history)
meRouter.get('/reservations', stub('GET /me/reservations'));
