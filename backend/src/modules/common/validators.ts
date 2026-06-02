import { z } from 'zod';

export const vehicleTypeEnum = z.enum(['auto', 'moto', 'camioneta']);
export const categoryEnum = z.enum(['ejecutivo', 'operativo', 'visitante_frecuente']);
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD');
export const idParam = z.object({ id: z.coerce.number().int().positive() });
