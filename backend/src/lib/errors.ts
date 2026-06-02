// Typed HTTP errors. Thrown from anywhere; mapped to a JSON response by the
// central error handler (src/middleware/errorHandler.ts).
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message = 'Solicitud inválida', details?: unknown) =>
  new HttpError(400, message, 'BAD_REQUEST', details);

// Message matches the CU-02-05 contract: { "error": "Token inválido o no proporcionado" }
export const unauthorized = (message = 'Token inválido o no proporcionado') =>
  new HttpError(401, message, 'UNAUTHORIZED');

export const forbidden = (message = 'No autorizado para esta operación') =>
  new HttpError(403, message, 'FORBIDDEN');

export const notFound = (message = 'Recurso no encontrado') =>
  new HttpError(404, message, 'NOT_FOUND');

export const conflict = (message = 'Conflicto con el estado actual del recurso') =>
  new HttpError(409, message, 'CONFLICT');

export const unprocessable = (message = 'Regla de negocio no satisfecha', details?: unknown) =>
  new HttpError(422, message, 'UNPROCESSABLE', details);

export const notImplemented = (message = 'No implementado') =>
  new HttpError(501, message, 'NOT_IMPLEMENTED');
