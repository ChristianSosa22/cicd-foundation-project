'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
  type Vehicle,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

type VehicleType = 'auto' | 'moto' | 'camioneta';

const TIPO_LABELS: Record<string, string> = {
  auto: 'Auto',
  moto: 'Moto',
  camioneta: 'Camioneta',
};

function RegisterForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createVehicle(token, plate.trim().toUpperCase(), vehicleType);
      setPlate('');
      setVehicleType('auto');
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      <h2 className="text-sm font-semibold text-slate-700">Registrar nuevo vehículo</h2>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Placa</span>
        <input
          type="text"
          required
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="ABC-1234"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase tracking-wider focus:border-slate-900 focus:outline-none"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tipo de vehículo</span>
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="auto">Auto</option>
          <option value="moto">Moto</option>
          <option value="camioneta">Camioneta</option>
        </select>
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? 'Registrando…' : 'Registrar vehículo'}
      </button>
    </form>
  );
}

function EditForm({
  vehicle,
  token,
  onSuccess,
  onCancel,
}: {
  vehicle: Vehicle;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [plate, setPlate] = useState(vehicle.plate);
  const [vehicleType, setVehicleType] = useState<VehicleType>(vehicle.vehicle_type);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateVehicle(token, vehicle.id, {
        plate: plate.trim().toUpperCase(),
        vehicle_type: vehicleType,
      });
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <div className="flex gap-2">
        <input
          type="text"
          required
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm uppercase tracking-wider focus:border-slate-900 focus:outline-none"
        />
        <select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="auto">Auto</option>
          <option value="moto">Moto</option>
          <option value="camioneta">Camioneta</option>
        </select>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function VehicleCard({
  vehicle,
  token,
  onRefresh,
}: {
  vehicle: Vehicle;
  token: string;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteVehicle(token, vehicle.id);
      onRefresh();
    } catch (err) {
      setDeleteError(extractError(err));
      setConfirmDelete(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
            {vehicle.vehicle_type === 'auto' ? '🚗' : vehicle.vehicle_type === 'moto' ? '🏍' : '🚐'}
          </div>
          <div>
            <p className="font-semibold tracking-widest">{vehicle.plate}</p>
            <p className="text-xs text-slate-500">{TIPO_LABELS[vehicle.vehicle_type] ?? vehicle.vehicle_type}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              vehicle.is_approved
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {vehicle.is_approved ? 'Aprobado' : 'Pendiente'}
          </span>
          <div className="flex gap-1.5">
            {!vehicle.is_approved && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                Editar
              </button>
            )}
            {vehicle.is_approved && (
              <span
                title="Los vehículos aprobados no pueden modificarse."
                className="cursor-help rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-400"
              >
                Aprobado ·no editable
              </span>
            )}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Eliminar
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteLoading ? '…' : '¿Confirmar?'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteError && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{deleteError}</p>
      )}

      {editing && (
        <EditForm
          vehicle={vehicle}
          token={token}
          onSuccess={() => { setEditing(false); onRefresh(); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export default function VehiclesPage() {
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchVehicles = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getVehicles(token);
      setVehicles(data);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mis Vehículos</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? 'Cancelar' : '+ Registrar vehículo'}
        </button>
      </div>

      {showForm && token && (
        <div className="mb-6">
          <RegisterForm
            token={token}
            onSuccess={() => { setShowForm(false); fetchVehicles(); }}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-slate-500">No tienes vehículos registrados.</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm font-medium text-slate-900 underline underline-offset-2 hover:no-underline"
            >
              Registrar un vehículo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <VehicleCard key={v.id} vehicle={v} token={token!} onRefresh={fetchVehicles} />
          ))}
          <p className="pt-2 text-xs text-slate-400">
            Los vehículos pendientes de aprobación no pueden usarse para reservar.
          </p>
        </div>
      )}
    </main>
  );
}
