import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';

export type Role = 'admin' | 'driver';

export interface AuthUser {
  id: number;
  email: string;
  system_role: Role;
  category: 'ejecutivo' | 'operativo' | 'visitante_frecuente' | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next(unauthorized());
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
    req.user = {
      id: payload.id,
      email: payload.email,
      system_role: payload.system_role,
      category: payload.category ?? null,
    };
    next();
  } catch {
    next(unauthorized());
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.system_role)) return next(forbidden());
    next();
  };
}
