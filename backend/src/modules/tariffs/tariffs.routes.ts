import { Router } from 'express';
import { db } from '../../db';
import { currentTariffs } from '../../db/schema';
import { requireAuth } from '../../middleware/auth';

// Public (authenticated) current price per vehicle type — view current_tariffs (UC8).
export const tariffsRouter: Router = Router();
tariffsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(currentTariffs);
    res.json(rows.map((r) => ({ vehicle_type: r.vehicleType, price: r.price, currency: r.currency, effective_from: r.effectiveFrom })));
  } catch (err) {
    next(err);
  }
});
