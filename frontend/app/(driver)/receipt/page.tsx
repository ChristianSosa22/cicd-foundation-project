'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, type ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Reservation {
  id: number;
  parking_space: { code: string; tipo_vehiculo: string };
  vehicle: { plate: string; vehicle_type: string };
  date: string;
  estado: string;
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={valueClass ?? 'font-medium'}>{value}</span>
    </div>
  );
}

const ESTADO_CLASS: Record<string, string> = {
  Confirmado: 'text-emerald-600 font-semibold',
  Cancelado: 'text-red-600 font-semibold',
  Reservado: 'text-amber-600 font-semibold',
};

function ReceiptContent() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'confirm' | 'cancel' | null>(null);

  useEffect(() => {
    if (!id || !token) return;
    apiFetch<Reservation>(`/reservations/${id}`, {}, token)
      .then(setReservation)
      .catch(() => {});
  }, [id, token]);

  async function handleAction(action: 'confirm' | 'cancel') {
    if (!id) return;
    setError(null);
    setActionLoading(action);
    try {
      await apiFetch(
        `/reservations/${id}/${action}`,
        { method: 'POST' },
        token ?? undefined,
      );
      if (action === 'cancel') {
        router.push('/availability');
      } else {
        const updated = await apiFetch<Reservation>(
          `/reservations/${id}`,
          {},
          token ?? undefined,
        );
        setReservation(updated);
      }
    } catch (err) {
      setError((err as ApiError)?.error ?? 'Error al procesar la acción');
    } finally {
      setActionLoading(null);
    }
  }

  if (!reservation) {
    return (
      <div className="px-6 py-20 text-center text-slate-400">
        Cargando comprobante…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Comprobante de reserva</h1>

      <div className="mb-6 divide-y divide-slate-100 rounded-2xl bg-white px-6 shadow-sm ring-1 ring-slate-200">
        <Row label="Reserva #" value={String(reservation.id)} />
        <Row label="Espacio" value={reservation.parking_space.code} />
        <Row
          label="Tipo de vehículo"
          value={reservation.parking_space.tipo_vehiculo}
        />
        <Row label="Placa" value={reservation.vehicle.plate} />
        <Row label="Tipo de auto" value={reservation.vehicle.vehicle_type} />
        <Row label="Fecha" value={reservation.date} />
        <Row
          label="Estado"
          value={reservation.estado}
          valueClass={ESTADO_CLASS[reservation.estado] ?? 'font-medium'}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {reservation.estado !== 'Cancelado' && (
        <div className="space-y-3">
          {reservation.estado !== 'Confirmado' && (
            <button
              onClick={() => handleAction('confirm')}
              disabled={!!actionLoading}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {actionLoading === 'confirm' ? 'Procesando…' : 'Ocupar Parqueo'}
            </button>
          )}
          <button
            onClick={() => handleAction('cancel')}
            disabled={!!actionLoading}
            className="w-full rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {actionLoading === 'cancel' ? 'Cancelando…' : 'Cancelar reserva'}
          </button>
        </div>
      )}

      {reservation.estado === 'Cancelado' && (
        <button
          onClick={() => router.push('/availability')}
          className="w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Buscar otro espacio
        </button>
      )}
    </main>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-20 text-center text-slate-400">Cargando…</div>
      }
    >
      <ReceiptContent />
    </Suspense>
  );
}
