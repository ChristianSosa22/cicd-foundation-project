'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createReservation, getVehicles, myReservations, type ApiError, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

function ReserveContent() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const spaceId = Number(params.get('space'));
  const spaceLabel = params.get('label') ?? '';
  const spaceTipo = params.get('tipo') ?? '';

  const today = new Date().toISOString().slice(0, 10);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fecha, setFecha] = useState(today);
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const TIPO_LABELS: Record<string, string> = {
    auto: 'Auto',
    moto: 'Moto',
    camioneta: 'Camioneta',
  };

  useEffect(() => {
    if (!token || !spaceId) return;
    getVehicles(token)
      .then((all) => {
        // Only approved vehicles whose type matches the space
        const eligible = all.filter((v) => v.is_approved && v.vehicle_type === spaceTipo);
        setVehicles(eligible);
        if (eligible.length > 0) setVehicleId(eligible[0].id);
      })
      .catch(() => {});
  }, [token, spaceId, spaceTipo]);

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

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId || !token) return;
    setError(null);
    setLoading(true);
    try {
      await createReservation(token, spaceId, Number(vehicleId), fecha);
      router.push('/reservations');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'CONFLICT') {
        // Disambiguate: check if driver already has an active reservation for this date
        try {
          const myRes = await myReservations(token);
          const hasActive = myRes.some(
            (r) => r.reservation_date === fecha && ['reservada', 'ocupada'].includes(r.status),
          );
          setError(
            hasActive
              ? 'Ya tienes una reserva activa para esta fecha.'
              : 'Este espacio ya fue reservado por otro usuario. Elige un espacio diferente.',
          );
        } catch {
          setError('Este espacio ya no está disponible.');
        }
      } else {
        setError(extractError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  const hasNoEligibleVehicles = vehicles.length === 0;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Reservar espacio</h1>

      <div className="mb-6 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <p className="text-xs text-slate-500">Espacio seleccionado</p>
        <p className="mt-0.5 text-3xl font-bold tracking-tight">{spaceLabel}</p>
        <p className="mt-0.5 text-sm capitalize text-slate-500">{TIPO_LABELS[spaceTipo] ?? spaceTipo}</p>
      </div>

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
          <span className="block text-sm font-medium">Vehículo</span>
          {hasNoEligibleVehicles ? (
            <div className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-700">
              <p>No tienes vehículos aprobados de tipo <strong>{TIPO_LABELS[spaceTipo] ?? spaceTipo}</strong> para reservar este espacio.</p>
              <a href="/vehicles" className="mt-1 inline-block underline">
                Administrar vehículos
              </a>
            </div>
          ) : (
            <select
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {TIPO_LABELS[v.vehicle_type] ?? v.vehicle_type}
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
          disabled={loading || hasNoEligibleVehicles}
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
    <Suspense fallback={<div className="px-6 py-20 text-center text-slate-400">Cargando…</div>}>
      <ReserveContent />
    </Suspense>
  );
}
