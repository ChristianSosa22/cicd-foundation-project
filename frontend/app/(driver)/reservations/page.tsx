'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Reservation {
  id: number;
  parking_space: { code: string; tipo_vehiculo: string };
  vehicle: { plate: string; vehicle_type: string };
  date: string;
  estado: string;
}

const ACTIVE_STATES = new Set(['reservada', 'ocupada', 'Reservado', 'Confirmado']);
function isActive(r: Reservation) {
  return ACTIVE_STATES.has(r.estado);
}

const BADGE: Record<string, string> = {
  reservada: 'bg-amber-100 text-amber-700',
  Reservado: 'bg-amber-100 text-amber-700',
  ocupada: 'bg-blue-100 text-blue-700',
  Confirmado: 'bg-blue-100 text-blue-700',
  cancelada: 'bg-red-100 text-red-600',
  Cancelado: 'bg-red-100 text-red-600',
  liberada: 'bg-slate-100 text-slate-500',
  expirada: 'bg-slate-100 text-slate-500',
};

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl bg-slate-200"
        />
      ))}
    </div>
  );
}

function ReservationCard({
  reservation,
  onAction,
}: {
  reservation: Reservation;
  onAction: (id: number, action: 'confirm' | 'release') => Promise<void>;
}) {
  const [loading, setLoading] = useState<'confirm' | 'release' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estado = reservation.estado.toLowerCase();
  const isReservada = estado === 'reservada' || reservation.estado === 'Reservado';
  const isOcupada = estado === 'ocupada' || reservation.estado === 'Confirmado';

  async function handleAction(action: 'confirm' | 'release') {
    setError(null);
    setLoading(action);
    try {
      await onAction(reservation.id, action);
    } catch (err) {
      setError((err as ApiError)?.error ?? 'Error al procesar la acción');
    } finally {
      setLoading(null);
    }
  }

  const receiptUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}/reservations/${reservation.id}/receipt`;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg font-bold text-slate-700">
            {reservation.parking_space.code}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {reservation.vehicle.plate}
              </span>
              <span className="text-xs capitalize text-slate-400">
                {reservation.vehicle.vehicle_type}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {reservation.parking_space.tipo_vehiculo} · {reservation.date}
            </p>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                BADGE[reservation.estado] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {reservation.estado}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {isReservada && (
            <button
              onClick={() => handleAction('confirm')}
              disabled={!!loading}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading === 'confirm' ? 'Procesando…' : 'Ocupar Parqueo'}
            </button>
          )}
          {isOcupada && (
            <button
              onClick={() => handleAction('release')}
              disabled={!!loading}
              className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
            >
              {loading === 'release' ? 'Procesando…' : 'Liberar anticipadamente'}
            </button>
          )}
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            Ver comprobante
          </a>
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function HistoryRow({ reservation }: { reservation: Reservation }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2.5 font-medium">{reservation.parking_space.code}</td>
      <td className="px-4 py-2.5 text-slate-600">{reservation.vehicle.plate}</td>
      <td className="px-4 py-2.5 text-slate-500">{reservation.date}</td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
            BADGE[reservation.estado] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {reservation.estado}
        </span>
      </td>
    </tr>
  );
}

export default function ReservationsPage() {
  const { token } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservations = useCallback(async () => {
    try {
      const data = await apiFetch<Reservation[]>(
        '/me/reservations',
        {},
        token ?? undefined,
      );
      setReservations(data);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  async function handleAction(id: number, action: 'confirm' | 'release') {
    await apiFetch(
      `/reservations/${id}/${action}`,
      { method: 'POST' },
      token ?? undefined,
    );
    await fetchReservations();
  }

  const active = reservations.filter(isActive);
  const history = reservations.filter((r) => !isActive(r));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold">Mis Reservas</h1>

      <section className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Reservas activas
        </h2>

        {loading ? (
          <Skeleton />
        ) : active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-slate-500">No tienes reservas activas</p>
            <a
              href="/availability"
              className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2 hover:no-underline"
            >
              Buscar un espacio disponible
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </section>

      {!loading && history.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Historial
          </h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-700">Espacio</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Placa</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Fecha</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <HistoryRow key={r.id} reservation={r} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
