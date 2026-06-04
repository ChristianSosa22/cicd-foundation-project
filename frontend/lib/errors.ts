import type { ApiError } from './api';

export function extractError(
  err: unknown,
  opts?: { endpoint?: string; hasActiveReservation?: boolean },
): string {
  const apiErr = err as ApiError;
  const code = apiErr?.code;

  if (code === 'UNAUTHORIZED') {
    return 'Sesión expirada. Por favor, inicia sesión nuevamente.';
  }
  if (code === 'FORBIDDEN') {
    return apiErr?.error ?? 'No tienes permiso para esta acción.';
  }
  if (code === 'NOT_FOUND') {
    return apiErr?.error ?? 'Recurso no encontrado.';
  }
  if (code === 'CONFLICT') {
    if (opts?.endpoint === '/reservar') {
      if (opts?.hasActiveReservation) {
        return 'Ya tienes una reserva activa para esta fecha.';
      }
      return 'Este espacio ya fue reservado por otro usuario. Elige un espacio diferente.';
    }
    return apiErr?.error ?? 'Ya existe un recurso con esos datos.';
  }
  if (code === 'UNPROCESSABLE') {
    return apiErr?.error ?? 'La solicitud no pudo procesarse.';
  }
  if (code === 'BAD_REQUEST') {
    const fieldErrors = (apiErr?.details as { fieldErrors?: Record<string, string[]> } | undefined)
      ?.fieldErrors;
    if (fieldErrors) {
      const messages = Object.values(fieldErrors).flat();
      if (messages.length > 0) return messages.join(' ');
    }
    return apiErr?.error ?? 'Solicitud inválida.';
  }
  return apiErr?.error ?? 'Error del servidor. Intenta de nuevo.';
}
