const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export interface ApiError {
  error: string;
  code?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw data as ApiError;
  return data as T;
}

// ─── Types (snake_case matches backend) ───────────────────────────────────────

export interface SessionUser {
  id: number;
  email?: string;
  full_name: string;
  system_role: 'admin' | 'driver';
  category: string | null;
  is_active?: boolean;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface Vehicle {
  id: number;
  plate: string;
  vehicle_type: 'auto' | 'moto' | 'camioneta';
  is_approved: boolean;
}

export interface AvailabilitySpace {
  id_espacio: number;
  label: string;
  tipo_vehiculo: 'auto' | 'moto' | 'camioneta';
  estado: 'Disponible' | 'Reservado' | 'Ocupado';
  ultima_actualizacion: string;
}

export interface Reservation {
  id: number;
  user_id?: number;
  vehicle_id: number;
  space_id: number;
  reservation_date: string;
  status: 'reservada' | 'ocupada' | 'liberada' | 'cancelada' | 'expirada';
  created_at: string;
  confirm_deadline: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
  is_late_cancellation: boolean | null;
  receipt_s3_key?: string | null;
  updated_at?: string;
  space?: { label: string; vehicle_type: string } | null;
  user_category?: string | null;
  vehicle?: { plate: string; vehicle_type: string } | null;
}

export interface MeReservation {
  id: number;
  space_id: number;
  vehicle_id: number;
  reservation_date: string;
  status: 'reservada' | 'ocupada' | 'liberada' | 'cancelada' | 'expirada';
  created_at: string;
  confirm_deadline: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
  is_late_cancellation: boolean | null;
}

export interface Tariff {
  vehicle_type: 'auto' | 'moto' | 'camioneta';
  price: string;
  currency: string;
  effective_from: string;
}

export interface AdminTariff extends Tariff {
  id: number;
  created_by: number;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  system_role: 'admin' | 'driver';
  category: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminVehicle {
  id: number;
  plate: string;
  vehicle_type: 'auto' | 'moto' | 'camioneta';
  is_approved: boolean;
  created_at: string;
  user: { id: number; email: string; full_name: string };
}

export interface Space {
  id: number;
  label: string;
  vehicle_type: 'auto' | 'moto' | 'camioneta';
  is_active: boolean;
  allowed_categories: string[];
  created_at: string;
  updated_at: string;
}

export interface Blackout {
  id: number;
  space_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_by: number;
  created_at: string;
}

export interface OccupancyRow {
  vehicle_type: string;
  estado: 'Disponible' | 'Reservado' | 'Ocupado';
  count: number;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}

// /admin/reservations returns raw Drizzle camelCase nested objects (documented inconsistency)
export interface AdminReservation {
  id: number;
  reservationDate: string;
  status: 'reservada' | 'ocupada' | 'liberada' | 'cancelada' | 'expirada';
  createdAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  isLateCancellation: boolean | null;
  user: { id: number; email: string; fullName: string };
  space: { id: number; label: string; vehicleType: string };
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getMe(token: string): Promise<SessionUser & { email: string; is_active: boolean }> {
  return apiFetch('/auth/me', {}, token);
}

export function changePassword(token: string, current_password: string, new_password: string): Promise<void> {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  }, token);
}

// ─── Vehicles (driver) ────────────────────────────────────────────────────────

export function getVehicles(token: string): Promise<Vehicle[]> {
  return apiFetch('/me/vehicles', {}, token);
}

export function createVehicle(token: string, plate: string, vehicle_type: string): Promise<Vehicle> {
  return apiFetch('/me/vehicles', { method: 'POST', body: JSON.stringify({ plate, vehicle_type }) }, token);
}

export function updateVehicle(token: string, id: number, data: { plate?: string; vehicle_type?: string }): Promise<Vehicle> {
  return apiFetch(`/me/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
}

export function deleteVehicle(token: string, id: number): Promise<void> {
  return apiFetch(`/me/vehicles/${id}`, { method: 'DELETE' }, token);
}

// ─── Availability ─────────────────────────────────────────────────────────────

export function getAvailability(token: string, fecha: string, tipo_vehiculo?: string): Promise<AvailabilitySpace[]> {
  const params = new URLSearchParams({ fecha });
  if (tipo_vehiculo) params.set('tipo_vehiculo', tipo_vehiculo);
  return apiFetch(`/availability?${params}`, {}, token);
}

// ─── Reservations (driver) ────────────────────────────────────────────────────

export function createReservation(
  token: string,
  space_id: number,
  vehicle_id: number,
  reservation_date: string,
): Promise<Reservation> {
  return apiFetch('/reservar', {
    method: 'POST',
    body: JSON.stringify({ space_id, vehicle_id, reservation_date }),
  }, token);
}

export function myReservations(token: string): Promise<MeReservation[]> {
  return apiFetch('/me/reservations', {}, token);
}

export function getReservation(token: string, id: number): Promise<Reservation> {
  return apiFetch(`/reservations/${id}`, {}, token);
}

export function reservationAction(
  token: string,
  id: number,
  action: 'confirm' | 'release' | 'cancel',
): Promise<Reservation> {
  return apiFetch(`/reservations/${id}/${action}`, { method: 'POST' }, token);
}

export function getReceiptUrl(token: string, id: number): Promise<{ url: string }> {
  return apiFetch(`/reservations/${id}/receipt`, {}, token);
}

// ─── Tariffs ──────────────────────────────────────────────────────────────────

export function getTariffs(token: string): Promise<Tariff[]> {
  return apiFetch('/tariffs', {}, token);
}

export function getAdminTariffs(token: string): Promise<AdminTariff[]> {
  return apiFetch('/admin/tariffs', {}, token);
}

export function createTariff(
  token: string,
  vehicle_type: string,
  price: number,
  currency?: string,
): Promise<AdminTariff> {
  return apiFetch('/admin/tariffs', {
    method: 'POST',
    body: JSON.stringify({ vehicle_type, price, ...(currency ? { currency } : {}) }),
  }, token);
}

// ─── Admin: Users ─────────────────────────────────────────────────────────────

export function getAdminUsers(
  token: string,
  filters?: { is_active?: boolean; system_role?: string; category?: string },
): Promise<AdminUser[]> {
  const params = new URLSearchParams();
  if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));
  if (filters?.system_role) params.set('system_role', filters.system_role);
  if (filters?.category) params.set('category', filters.category);
  const qs = params.toString();
  return apiFetch(`/admin/users${qs ? `?${qs}` : ''}`, {}, token);
}

export function createAdminUser(
  token: string,
  data: { email: string; full_name: string; password: string; system_role: string; category?: string | null; phone?: string },
): Promise<AdminUser> {
  return apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function updateAdminUser(
  token: string,
  id: number,
  data: { full_name?: string; system_role?: string; category?: string | null; phone?: string },
): Promise<AdminUser> {
  return apiFetch(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
}

export function setUserActive(
  token: string,
  id: number,
  active: boolean,
): Promise<{ id: number; is_active: boolean }> {
  return apiFetch(`/admin/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' }, token);
}

// ─── Admin: Vehicles ──────────────────────────────────────────────────────────

export function getAdminVehicles(token: string, approved?: boolean): Promise<AdminVehicle[]> {
  const params = new URLSearchParams();
  if (approved !== undefined) params.set('approved', String(approved));
  const qs = params.toString();
  return apiFetch(`/admin/vehicles${qs ? `?${qs}` : ''}`, {}, token);
}

export function approveVehicle(token: string, id: number): Promise<{ id: number; is_approved: boolean }> {
  return apiFetch(`/admin/vehicles/${id}/approve`, { method: 'PATCH' }, token);
}

// ─── Admin: Spaces ────────────────────────────────────────────────────────────

export function getAdminSpaces(token: string): Promise<Space[]> {
  return apiFetch('/admin/spaces', {}, token);
}

export function createSpace(
  token: string,
  data: { label: string; vehicle_type: string; allowed_categories: string[] },
): Promise<Space> {
  return apiFetch('/admin/spaces', { method: 'POST', body: JSON.stringify(data) }, token);
}

export function updateSpace(
  token: string,
  id: number,
  data: { label?: string; vehicle_type?: string; allowed_categories?: string[] },
): Promise<Space> {
  return apiFetch(`/admin/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
}

export function setSpaceActive(
  token: string,
  id: number,
  active: boolean,
): Promise<{ id: number; is_active: boolean }> {
  return apiFetch(`/admin/spaces/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' }, token);
}

export function getBlackouts(token: string, spaceId: number): Promise<Blackout[]> {
  return apiFetch(`/admin/spaces/${spaceId}/blackouts`, {}, token);
}

export function createBlackout(
  token: string,
  spaceId: number,
  data: { start_date: string; end_date: string; reason?: string },
): Promise<Blackout> {
  return apiFetch(`/admin/spaces/${spaceId}/blackouts`, { method: 'POST', body: JSON.stringify(data) }, token);
}

export function deleteBlackout(token: string, id: number): Promise<void> {
  return apiFetch(`/admin/blackouts/${id}`, { method: 'DELETE' }, token);
}

// ─── Admin: Dashboard ─────────────────────────────────────────────────────────

export function getOccupancy(token: string): Promise<OccupancyRow[]> {
  return apiFetch('/admin/dashboard/occupancy', {}, token);
}

// ─── Admin: Reservations ──────────────────────────────────────────────────────

export function getAdminReservations(
  token: string,
  filters?: { user_id?: number; from?: string; to?: string; status?: string },
): Promise<AdminReservation[]> {
  const params = new URLSearchParams();
  if (filters?.user_id) params.set('user_id', String(filters.user_id));
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiFetch(`/admin/reservations${qs ? `?${qs}` : ''}`, {}, token);
}

export async function exportReservationsCsv(
  token: string,
  filters?: { user_id?: number; from?: string; to?: string; status?: string },
): Promise<void> {
  const params = new URLSearchParams();
  if (filters?.user_id) params.set('user_id', String(filters.user_id));
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();

  const res = await fetch(`${API_URL}/admin/reservations/export${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw (await res.json().catch(() => ({ error: 'Export failed' })));

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Admin: Settings ──────────────────────────────────────────────────────────

export function getSettings(token: string): Promise<Setting[]> {
  return apiFetch('/admin/settings', {}, token);
}

export function updateSetting(token: string, key: string, value: unknown): Promise<{ key: string; value: unknown }> {
  return apiFetch(`/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }, token);
}
