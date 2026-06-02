import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { stub } from '../../lib/stub';

export const authRouter: Router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// UC1 — login. Returns { token, user }. 401 on bad credentials.
authRouter.post('/login', validate({ body: loginSchema }), stub('POST /auth/login'));

authRouter.get('/me', requireAuth, stub('GET /auth/me'));

authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: z.object({ current_password: z.string().min(1), new_password: z.string().min(8) }) }),
  stub('POST /auth/change-password'),
);
