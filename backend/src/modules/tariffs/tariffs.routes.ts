import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { stub } from '../../lib/stub';

// Public (authenticated) current price per vehicle type — view current_tariffs (UC8).
export const tariffsRouter: Router = Router();
tariffsRouter.get('/', requireAuth, stub('GET /tariffs'));
