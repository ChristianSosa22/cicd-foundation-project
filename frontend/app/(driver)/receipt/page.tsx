'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getReservation,
  getReceiptUrl,
  reservationAction,
  type Reservation,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

const STATUS_LABELS: Record<string, string> = {
  reservada: 'Reservada',
  ocupada: 'Ocupada',
  liberada: 'Liberada',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
};

const STATUS_CLASS: Record<string, string> = {
  reservada: 'text-amber-600 font-semibold',
  ocupada: 'text-blue-600 font-semibold',
  liberada: 'text-emerald-600 font-semibold',
  cancelada: 'text-red-600 font-semibold',
  expirada: 'text-slate-400 font-semibold',
};

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={valueClass ?? 'font-medium text-slate-900'}>{value}</span>
    </div>
  );
}

function DetailContent() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const id = Number(params.get('id'));

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lateCancelWarning, setLateCancelWarning] = useState(false);

  useEffect(() => {
    if (!id || !token) return;
    getReservation(token, id)
      .then(setReservation)
      .catch(() => setError('No se pudo cargar la reserva.'));
  }, [id, token]);

  if (!id) {
    return (
      <main className="px-6 py-20 text-center text-slate-500">
        ID de reserva no especificado.{' '}
        <button onClick={() => router.push('/reservations')} className="underline">
          Volver
        </button>
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-6 py-20 text-center">
        <p className="text-slate-500">{error}</p>
        <button onClick={() => router.push('/reservations')} className="mt-4 underline text-sm">
          Volver a mis reservas
        </button>
      </main>
    );
  }

  if (!reservation) {
    return (
      <div className="px-6 py-20 text-center text-slate-400">Cargando detalle…</div>
    );
  }

  async function handleAction(action: 'confirm' | 'release' | 'cancel') {
    if (!token) return;
    setError(null);
    setActionLoading(action);
    try {
      const updated = await reservationAction(token, id, action);
      if (action === 'cancel' && updated.is_late_cancellation) {
        setLateCancelWarning(true);
      }
      setReservation(updated);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function openReceipt() {
    if (!token) return;
    try {
      const { url } = await getReceiptUrl(token, id);
      window.open(url, '_blank', 'noopener');
    } catch {
      setError('Comprobante no disponible.');
    }
  }

  const status = reservation.status;
  const isTerminal = ['liberada', 'cancelada', 'expirada'].includes(status);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/reservations')}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← Mis Reservas
        </button>
      </div>

      <h1 className="mb-6 text-2xl font-semibold">Detalle de reserva</h1>

      <div className="mb-6 divide-y divide-slate-100 rounded-2xl bg-white px-6 shadow-sm ring-1 ring-slate-200">
        <Row label="Reserva #" value={String(reservation.id)} />
        {reservation.space && (
          <>
            <Row label="Espacio" value={reservation.space.label} />
            <Row label="Tipo de espacio" value={reservation.space.vehicle_type} />
          </>
        )}
        {reservation.vehicle && (
          <>
            <Row label="Placa" value={reservation.vehicle.plate} />
            <Row label="Tipo de vehículo" value={reservation.vehicle.vehicle_type} />
          </>
        )}
        <Row label="Fecha" value={reservation.reservation_date} />
        <Row
          label="Estado"
          value={STATUS_LABELS[status] ?? status}
          valueClass={STATUS_CLASS[status] ?? 'font-medium'}
        />
        {reservation.confirm_deadline && status === 'reservada' && (
          <Row
            label="Confirmar antes de"
            value={new Date(reservation.confirm_deadline).toLocaleTimeString('es-GT')}
          />
        )}
        {reservation.confirmed_at && (
          <Row
            label="Confirmada"
            value={new Date(reservation.confirmed_at).toLocaleString('es-GT')}
          />
        )}
        {reservation.released_at && (
          <Row
            label="Liberada"
            value={new Date(reservation.released_at).toLocaleString('es-GT')}
          />
        )}
        {reservation.cancelled_at && (
          <Row
            label="Cancelada"
            value={new Date(reservation.cancelled_at).toLocaleString('es-GT')}
          />
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {lateCancelWarning && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Esta cancelación es tardía. Cancelaciones repetidas fuera del plazo pueden afectar tu cuenta.
        </p>
      )}

      {!isTerminal && (
        <div className="space-y-3">
          {status === 'reservada' && (
            <button
              onClick={() => handleAction('confirm')}
              disabled={!!actionLoading}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {actionLoading === 'confirm' ? 'Procesando…' : 'Confirmar llegada'}
            </button>
          )}
          {status === 'ocupada' && (
            <button
              onClick={() => handleAction('release')}
              disabled={!!actionLoading}
              className="w-full rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
            >
              {actionLoading === 'release' ? 'Procesando…' : 'Liberar espacio'}
            </button>
          )}
          {status === 'reservada' && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={!!actionLoading}
              className="w-full rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {actionLoading === 'cancel' ? 'Cancelando…' : 'Cancelar reserva'}
            </button>
          )}
        </div>
      )}

      {reservation.receipt_s3_key && (
        <button
          onClick={openReceipt}
          className="mt-3 w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Descargar comprobante
        </button>
      )}

      {isTerminal && (
        <button
          onClick={() => router.push('/availability')}
          className="mt-4 w-full rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Buscar otro espacio
        </button>
      )}
    </main>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<div className="px-6 py-20 text-center text-slate-400">Cargando…</div>}>
      <DetailContent />
    </Suspense>
  );
}
