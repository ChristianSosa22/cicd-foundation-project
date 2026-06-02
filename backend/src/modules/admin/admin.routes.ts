import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { stub } from '../../lib/stub';
import { categoryEnum, dateString, idParam, vehicleTypeEnum } from '../common/validators';

// All /admin/* routes require an authenticated admin.
export const adminRouter: Router = Router();
adminRouter.use(requireAuth, requireRole('admin'));

// --- Users (UC4) ---
adminRouter.get('/users', stub('GET /admin/users'));
adminRouter.post(
  '/users',
  validate({
    body: z.object({
      email: z.string().email(),
      full_name: z.string().min(1),
      password: z.string().min(8),
      system_role: z.enum(['admin', 'driver']),
      category: categoryEnum.nullish(),
      phone: z.string().optional(),
    }),
  }),
  stub('POST /admin/users'),
);
adminRouter.patch('/users/:id', validate({ params: idParam }), stub('PATCH /admin/users/:id'));
adminRouter.patch('/users/:id/deactivate', validate({ params: idParam }), stub('PATCH /admin/users/:id/deactivate'));
adminRouter.patch('/users/:id/activate', validate({ params: idParam }), stub('PATCH /admin/users/:id/activate'));

// --- Vehicle approval (Fn1) ---
adminRouter.get('/vehicles', stub('GET /admin/vehicles'));
adminRouter.patch('/vehicles/:id/approve', validate({ params: idParam }), stub('PATCH /admin/vehicles/:id/approve'));

// --- Spaces & blackouts (UC5) ---
adminRouter.get('/spaces', stub('GET /admin/spaces'));
adminRouter.post(
  '/spaces',
  validate({
    body: z.object({
      label: z.string().min(1),
      vehicle_type: vehicleTypeEnum,
      allowed_categories: z.array(categoryEnum).min(1),
    }),
  }),
  stub('POST /admin/spaces'),
);
adminRouter.patch('/spaces/:id', validate({ params: idParam }), stub('PATCH /admin/spaces/:id'));
adminRouter.patch('/spaces/:id/deactivate', validate({ params: idParam }), stub('PATCH /admin/spaces/:id/deactivate'));
adminRouter.patch('/spaces/:id/activate', validate({ params: idParam }), stub('PATCH /admin/spaces/:id/activate'));
adminRouter.get('/spaces/:id/blackouts', validate({ params: idParam }), stub('GET /admin/spaces/:id/blackouts'));
adminRouter.post(
  '/spaces/:id/blackouts',
  validate({
    params: idParam,
    body: z.object({ start_date: dateString, end_date: dateString, reason: z.string().optional() }),
  }),
  stub('POST /admin/spaces/:id/blackouts'),
);
adminRouter.delete('/blackouts/:id', validate({ params: idParam }), stub('DELETE /admin/blackouts/:id'));

// --- Dashboard (UC7) ---
adminRouter.get('/dashboard/occupancy', stub('GET /admin/dashboard/occupancy'));

// --- Tariffs (UC8, append-only) ---
adminRouter.get('/tariffs', stub('GET /admin/tariffs'));
adminRouter.post(
  '/tariffs',
  validate({
    body: z.object({
      vehicle_type: vehicleTypeEnum,
      price: z.number().positive(),
      currency: z.string().length(3).default('GTQ'),
    }),
  }),
  stub('POST /admin/tariffs'),
);

// --- Reservations history / attendance (Fn3, Pantalla 7) — immutable ---
adminRouter.get(
  '/reservations',
  validate({
    query: z.object({
      user_id: z.coerce.number().int().positive().optional(),
      from: dateString.optional(),
      to: dateString.optional(),
      status: z.enum(['reservada', 'ocupada', 'liberada', 'cancelada', 'expirada']).optional(),
    }),
  }),
  stub('GET /admin/reservations'),
);
adminRouter.get('/reservations/export', stub('GET /admin/reservations/export'));

// --- Settings (Fn5 policy) ---
adminRouter.get('/settings', stub('GET /admin/settings'));
adminRouter.put('/settings/:key', stub('PUT /admin/settings/:key'));
