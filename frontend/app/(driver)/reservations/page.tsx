'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  getReservation,
  getReceiptUrl,
  myReservations,
  reservationAction,
  type MeReservation,
  type Reservation,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

const TERMINAL = new Set<string>(['liberada', 'cancelada', 'expirada']);

const STATUS_BADGE: Record<string, string> = {
  reservada: 'bg-amber-100 text-amber-700',
  ocupada: 'bg-blue-100 text-blue-700',
  liberada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-red-100 text-red-600',
  expirada: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  reservada: 'Reservada',
  ocupada: 'Ocupada',
  liberada: 'Liberada',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
};

function useCountdown(deadline: string | null): string | null {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expirado');
        return;
      }
      const m = Math.floor(diff / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [deadline]);

  return remaining;
}

function Skeleton() {
  return (
    <div className="space-y-3" data-testid="active-loading">
      {[1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}

function ActiveCard({
  reservation,
  detail,
  onRefresh,
}: {
  reservation: MeReservation;
  detail: Reservation | null;
  onRefresh: () => Promise<void>;
}) {
  const { token } = useAuth();
  const countdown = useCountdown(
    reservation.status === 'reservada' ? reservation.confirm_deadline : null,
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lateCancelWarning, setLateCancelWarning] = useState(false);

  async function handleAction(action: 'confirm' | 'release' | 'cancel') {
    if (!token) return;
    setActionError(null);
    setActionLoading(action);
    try {
      const result = await reservationAction(token, reservation.id, action);
      if (action === 'cancel' && result.is_late_cancellation) {
        setLateCancelWarning(true);
      }
      await onRefresh();
    } catch (err) {
      setActionError(extractError(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function openReceipt() {
    if (!token) return;
    try {
      const { url } = await getReceiptUrl(token, reservation.id);
      window.open(url, '_blank', 'noopener');
    } catch {
      // receipt not available
    }
  }

  const spaceLabel = detail?.space?.label ?? `Espacio #${reservation.space_id}`;
  const plate = detail?.vehicle?.plate ?? `Vehículo #${reservation.vehicle_id}`;

  return (
    <div
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      data-testid={`reservation-card-${reservation.id}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            {spaceLabel}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{plate}</span>
              {detail?.vehicle?.vehicle_type && (
                <span className="text-xs capitalize text-slate-400">{detail.vehicle.vehicle_type}</span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {new Date(reservation.reservation_date + 'T00:00:00').toLocaleDateString('es-GT')}
            </p>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_BADGE[reservation.status] ?? 'bg-slate-100 text-slate-600'
              }`}
              data-testid="reservation-status"
            >
              {STATUS_LABELS[reservation.status] ?? reservation.status}
            </span>
            {reservation.status === 'reservada' && countdown && (
              <p
                className={`text-xs font-medium ${countdown === 'Expirado' ? 'text-red-600' : 'text-amber-600'}`}
                data-testid="reservation-countdown"
              >
                Confirmar en: {countdown}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {reservation.status === 'reservada' && (
            <>
              <button
                onClick={() => handleAction('confirm')}
                disabled={!!actionLoading}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                data-testid="confirm-btn"
              >
                {actionLoading === 'confirm' ? 'Procesando…' : 'Confirmar llegada'}
              </button>
              <button
                onClick={() => handleAction('cancel')}
                disabled={!!actionLoading}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                data-testid="cancel-btn"
              >
                {actionLoading === 'cancel' ? 'Cancelando…' : 'Cancelar'}
              </button>
            </>
          )}
          {reservation.status === 'ocupada' && (
            <button
              onClick={() => handleAction('release')}
              disabled={!!actionLoading}
              className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
              data-testid="release-btn"
            >
              {actionLoading === 'release' ? 'Procesando…' : 'Liberar espacio'}
            </button>
          )}
          {detail?.receipt_s3_key && (
            <button
              onClick={openReceipt}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
              data-testid="receipt-btn"
            >
              Ver comprobante
            </button>
          )}
          <Link
            href={`/receipt?id=${reservation.id}`}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            data-testid="detail-link"
          >
            Ver detalle
          </Link>
        </div>
      </div>

      {actionError && (
        <p
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
          data-testid="action-error"
        >
          {actionError}
        </p>
      )}
      {lateCancelWarning && (
        <p
          className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700"
          data-testid="late-cancel-warning"
        >
          Esta cancelación es tardía. Ten en cuenta que cancelaciones tardías repetidas pueden afectar tu cuenta.
        </p>
      )}
    </div>
  );
}

export default function ReservationsPage() {
  const { token } = useAuth();
  const [meReservations, setMeReservations] = useState<MeReservation[]>([]);
  const [details, setDetails] = useState<Map<number, Reservation>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await myReservations(token);
      setMeReservations(rows);

      // Enrich active reservations with space/vehicle detail
      const active = rows.filter((r) => !TERMINAL.has(r.status));
      const enriched = await Promise.allSettled(
        active.map((r) =>
          getReservation(token, r.id).then((d) => [r.id, d] as [number, Reservation]),
        ),
      );
      const map = new Map<number, Reservation>();
      for (const result of enriched) {
        if (result.status === 'fulfilled') {
          const [id, detail] = result.value;
          map.set(id, detail);
        }
      }
      setDetails(map);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const active = meReservations.filter((r) => !TERMINAL.has(r.status));
  const history = meReservations.filter((r) => TERMINAL.has(r.status));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold" data-testid="reservations-heading">
        Mis Reservas
      </h1>

      <section className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Reservas activas
        </h2>

        {loading ? (
          <Skeleton />
        ) : active.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
            data-testid="active-empty"
          >
            <p className="text-slate-500">No tienes reservas activas.</p>
            <a
              href="/availability"
              className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2 hover:no-underline"
            >
              Buscar un espacio disponible
            </a>
          </div>
        ) : (
          <div className="space-y-3" data-testid="active-list">
            {active.map((r) => (
              <ActiveCard
                key={r.id}
                reservation={r}
                detail={details.get(r.id) ?? null}
                onRefresh={fetchAll}
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
            <table className="w-full text-sm" data-testid="history-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-700">Fecha</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Estado</th>
                  <th className="px-4 py-3 font-medium text-slate-700"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0"
                    data-testid={`history-row-${r.id}`}
                  >
                    <td className="px-4 py-3 tabular-nums">
                      {new Date(r.reservation_date + 'T00:00:00').toLocaleDateString('es-GT')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                        data-testid="history-status"
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                      {r.is_late_cancellation && (
                        <span
                          className="ml-2 text-xs text-amber-600"
                          data-testid="late-badge"
                        >
                          Cancelación tardía
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/receipt?id=${r.id}`}
                        className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800"
                        data-testid="history-detail-link"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}