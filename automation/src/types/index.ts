// Shared type definitions matching the application's API contracts

export type SystemRole = 'admin' | 'driver';
export type VehicleType = 'auto' | 'moto' | 'camioneta';
export type ReservationStatus = 'reservada' | 'ocupada' | 'liberada' | 'cancelada' | 'expirada';
export type SpaceEstado = 'Disponible' | 'Reservado' | 'Ocupado';
export type UserCategory = 'ejecutivo' | 'operativo' | 'visitante_frecuente';

export interface SessionUser {
  id: number;
  email?: string;
  full_name: string;
  system_role: SystemRole;
  category: UserCategory | null;
  is_active?: boolean;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  system_role: SystemRole;
  category: UserCategory | null;
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: number;
  plate: string;
  vehicle_type: VehicleType;
  is_approved: boolean;
}

export interface AdminVehicle extends Vehicle {
  created_at: string;
  user: { id: number; email: string; full_name: string };
}

export interface AvailabilitySpace {
  id_espacio: number;
  label: string;
  tipo_vehiculo: VehicleType;
  estado: SpaceEstado;
  ultima_actualizacion: string;
}

export interface Space {
  id: number;
  label: string;
  vehicle_type: VehicleType;
  is_active: boolean;
  allowed_categories: UserCategory[];
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

export interface Reservation {
  id: number;
  user_id?: number;
  vehicle_id: number;
  space_id: number;
  reservation_date: string;
  status: ReservationStatus;
  created_at: string;
  confirm_deadline: string | null;
  confirmed_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
  is_late_cancellation: boolean | null;
  receipt_s3_key?: string | null;
  space?: { label: string; vehicle_type: string } | null;
  vehicle?: { plate: string; vehicle_type: string } | null;
}

export interface AdminReservation {
  id: number;
  reservationDate: string;
  status: ReservationStatus;
  createdAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  isLateCancellation: boolean | null;
  user: { id: number; email: string; fullName: string };
  space: { id: number; label: string; vehicleType: string };
}

export interface Tariff {
  vehicle_type: VehicleType;
  price: string;
  currency: string;
  effective_from: string;
}

export interface AdminTariff extends Tariff {
  id: number;
  created_by: number;
  created_at: string;
}

export interface OccupancyRow {
  vehicle_type: string;
  estado: SpaceEstado;
  count: number;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  password: string;
  system_role: SystemRole;
  category?: UserCategory | null;
  phone?: string;
}
