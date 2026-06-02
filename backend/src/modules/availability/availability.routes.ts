import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { stub } from '../../lib/stub';
import { dateString, vehicleTypeEnum } from '../common/validators';

export const availabilityRouter: Router = Router();

// UC2 / CU-02 — mounted at /availability.
// Invalid tipo_vehiculo (e.g. "barco") -> 400; missing token -> 401.
const querySchema = z.object({
  tipo_vehiculo: vehicleTypeEnum.optional(),
  fecha: dateString.optional(),
});

availabilityRouter.get('/', requireAuth, validate({ query: querySchema }), stub('GET /availability'));
