import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { db } from '../../db';
import { users } from '../../db/schema';
import { badRequest, notFound, unauthorized } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

export const authRouter: Router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// UC1 — login. Returns { token, user }. 401 on bad credentials.
authRouter.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof loginSchema>;
    const [row] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);

    if (!row || !row.isActive) return next(unauthorized('Credenciales inválidas'));
    if (row.blockedUntil && row.blockedUntil > new Date()) return next(unauthorized('Cuenta bloqueada'));
    if (!bcrypt.compareSync(body.password, row.passwordHash)) return next(unauthorized('Credenciales inválidas'));

    const token = jwt.sign(
      { id: row.id, email: row.email, system_role: row.systemRole, category: row.category },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
    );

    res.json({ token, user: { id: row.id, full_name: row.fullName, system_role: row.systemRole, category: row.category } });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [row] = await db
      .select({ id: users.id, email: users.email, fullName: users.fullName, systemRole: users.systemRole, category: users.category, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!row) return next(notFound());
    res.json({ id: row.id, email: row.email, full_name: row.fullName, system_role: row.systemRole, category: row.category, is_active: row.isActive });
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: z.object({ current_password: z.string().min(1), new_password: z.string().min(8) }) }),
  async (req, res, next) => {
    try {
      const body = req.body as { current_password: string; new_password: string };
      const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, req.user!.id)).limit(1);

      if (!row) return next(notFound());
      if (!bcrypt.compareSync(body.current_password, row.passwordHash)) return next(badRequest('Contraseña actual incorrecta'));

      const newHash = bcrypt.hashSync(body.new_password, env.BCRYPT_ROUNDS);
      await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, req.user!.id));

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
