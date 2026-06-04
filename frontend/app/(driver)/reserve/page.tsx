'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, type ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Vehicle {
  id: number;
  plate: string;
  vehicle_type: string;
}

interface SpaceInfo {
  id: number;
  code: string;
  tipo_vehiculo: string;
}

interface ReserveResponse {
  id: number;
}

function ReserveContent() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const spaceId = params.get('space');

  const today = new Date().toISOString().slice(0, 10);
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fecha, setFecha] = useState(today);
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!spaceId || !token) return;
    Promise.all([
      apiFetch<SpaceInfo>(`/spaces/${spaceId}`, {}, token),
      apiFetch<Vehicle[]>('/me/vehicles', {}, token),
    ])
      .then(([s, v]) => {
        setSpace(s);
        setVehicles(v);
        if (v.length > 0) setVehicleId(v[0].id);
      })
      .catch(() => {});
  }, [spaceId, token]);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<ReserveResponse>('/reservar', {
        method: 'POST',
        body: JSON.stringify({
          parking_space_id: Number(spaceId),
          vehicle_id: vehicleId,
          date: fecha,
        }),
      }, token ?? undefined);
      router.push(`/receipt?id=${res.id}`);
    } catch (err) {
      setError((err as ApiError)?.error ?? 'No se pudo crear la reserva');
    } finally {
      setLoading(false);
    }
  }

  if (!spaceId) {
    return (
      <main className="px-6 py-20 text-center text-slate-500">
        Espacio no especificado.{' '}
        <button onClick={() => router.push('/availability')} className="underline">
          Volver
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Reservar espacio</h1>

      {space && (
        <div className="mb-6 rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs text-slate-500">Espacio seleccionado</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight">{space.code}</p>
          <p className="mt-0.5 text-sm capitalize text-slate-500">{space.tipo_vehiculo}</p>
        </div>
      )}

      <form
        onSubmit={onConfirm}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Fecha</span>
          <input
            type="date"
            required
            value={fecha}
            min={today}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>

        <div className="space-y-1">
          <span className="text-sm font-medium">Vehículo</span>
          {vehicles.length === 0 ? (
            <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No tienes vehículos registrados.{' '}
              <a href="/onboarding" className="underline">
                Registrar uno
              </a>
            </p>
          ) : (
            <select
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.vehicle_type}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || vehicles.length === 0}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Reservando…' : 'Confirmar reserva'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Volver
        </button>
      </form>
    </main>
  );
}

export default function ReservePage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-20 text-center text-slate-400">Cargando…</div>
      }
    >
      <ReserveContent />
    </Suspense>
  );
}
