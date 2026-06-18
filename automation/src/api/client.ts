import { type APIRequestContext } from '@playwright/test';
import type * as T from '../types';
import { ENDPOINTS } from './endpoints';

/**
 * Typed API client for direct API calls in test setup/teardown.
 * Use .withToken() to create an authenticated copy: const authed = client.withToken(token).
 */
export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token?: string,
  ) {}

  withToken(token: string): ApiClient {
    return new ApiClient(this.request, token);
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  private async send<TRes>(
    method: 'get' | 'post' | 'patch' | 'put' | 'delete',
    path: string,
    data?: unknown,
  ): Promise<TRes> {
    const response = await this.request[method](path, {
      headers: this.authHeaders(),
      ...(data !== undefined ? { data } : {}),
    });
    if (!response.ok()) {
      const body = await response.text().catch(() => '');
      throw new Error(`${method.toUpperCase()} ${path} → HTTP ${response.status()}: ${body}`);
    }
    if (response.status() === 204) return undefined as TRes;
    return response.json() as Promise<TRes>;
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  login(email: string, password: string): Promise<T.LoginResponse> {
    return this.send('post', ENDPOINTS.auth.login, { email, password });
  }

  me(): Promise<T.SessionUser & { email: string; is_active: boolean }> {
    return this.send('get', ENDPOINTS.auth.me);
  }

  // ─── Admin: Users ──────────────────────────────────────────────────────────

  createUser(payload: T.CreateUserPayload): Promise<T.AdminUser> {
    return this.send('post', ENDPOINTS.admin.users, payload);
  }

  getUsers(filters?: { is_active?: boolean; system_role?: string; category?: string }): Promise<T.AdminUser[]> {
    const qs = new URLSearchParams();
    if (filters?.is_active !== undefined) qs.set('is_active', String(filters.is_active));
    if (filters?.system_role) qs.set('system_role', filters.system_role);
    if (filters?.category) qs.set('category', filters.category);
    const query = qs.toString();
    return this.send('get', query ? `${ENDPOINTS.admin.users}?${query}` : ENDPOINTS.admin.users);
  }

  activateUser(id: number): Promise<{ id: number; is_active: boolean }> {
    return this.send('patch', ENDPOINTS.admin.userActivate(id));
  }

  deactivateUser(id: number): Promise<{ id: number; is_active: boolean }> {
    return this.send('patch', ENDPOINTS.admin.userDeactivate(id));
  }

  // ─── Admin: Vehicles ───────────────────────────────────────────────────────

  getAdminVehicles(approved?: boolean): Promise<T.AdminVehicle[]> {
    const qs = approved !== undefined ? `?approved=${approved}` : '';
    return this.send('get', `${ENDPOINTS.admin.vehicles}${qs}`);
  }

  approveVehicle(id: number): Promise<{ id: number; is_approved: boolean }> {
    return this.send('patch', ENDPOINTS.admin.vehicleApprove(id));
  }

  // ─── Admin: Spaces ─────────────────────────────────────────────────────────

  createSpace(data: { label: string; vehicle_type: string; allowed_categories: string[] }): Promise<T.Space> {
    return this.send('post', ENDPOINTS.admin.spaces, data);
  }

  getSpaces(): Promise<T.Space[]> {
    return this.send('get', ENDPOINTS.admin.spaces);
  }

  // ─── Admin: Tariffs ────────────────────────────────────────────────────────

  createTariff(vehicle_type: string, price: number, currency?: string): Promise<T.AdminTariff> {
    return this.send('post', ENDPOINTS.tariffs.admin, { vehicle_type, price, ...(currency ? { currency } : {}) });
  }

  // ─── Admin: Reservations ───────────────────────────────────────────────────

  getAdminReservations(filters?: {
    user_id?: number;
    from?: string;
    to?: string;
    status?: string;
  }): Promise<T.AdminReservation[]> {
    const qs = new URLSearchParams();
    if (filters?.user_id) qs.set('user_id', String(filters.user_id));
    if (filters?.from) qs.set('from', filters.from);
    if (filters?.to) qs.set('to', filters.to);
    if (filters?.status) qs.set('status', filters.status);
    const query = qs.toString();
    return this.send('get', query ? `${ENDPOINTS.admin.reservations}?${query}` : ENDPOINTS.admin.reservations);
  }

  // ─── Driver: Vehicles ──────────────────────────────────────────────────────

  createVehicle(plate: string, vehicle_type: string): Promise<T.Vehicle> {
    return this.send('post', ENDPOINTS.driver.vehicles, { plate, vehicle_type });
  }

  getVehicles(): Promise<T.Vehicle[]> {
    return this.send('get', ENDPOINTS.driver.vehicles);
  }

  deleteVehicle(id: number): Promise<void> {
    return this.send('delete', ENDPOINTS.driver.vehicle(id));
  }

  // ─── Reservations ──────────────────────────────────────────────────────────

  createReservation(space_id: number, vehicle_id: number, reservation_date: string): Promise<T.Reservation> {
    return this.send('post', ENDPOINTS.reservations.create, { space_id, vehicle_id, reservation_date });
  }

  getReservation(id: number): Promise<T.Reservation> {
    return this.send('get', ENDPOINTS.reservations.get(id));
  }

  confirmReservation(id: number): Promise<T.Reservation> {
    return this.send('post', ENDPOINTS.reservations.confirm(id));
  }

  cancelReservation(id: number): Promise<T.Reservation> {
    return this.send('post', ENDPOINTS.reservations.cancel(id));
  }

  releaseReservation(id: number): Promise<T.Reservation> {
    return this.send('post', ENDPOINTS.reservations.release(id));
  }

  // ─── Health ────────────────────────────────────────────────────────────────

  healthCheck(): Promise<unknown> {
    return this.send('get', ENDPOINTS.health);
  }
}
