'use client';

import { useCallback, useEffect, useState } from 'react';
import { exportReservationsCsv, getAdminReservations, type AdminReservation } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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

export default function HistoryPage() {
  const { token } = useAuth();
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  const buildFilters = () => ({
    from: filterFrom || undefined,
    to: filterTo || undefined,
    status: filterStatus || undefined,
    user_id: filterUserId ? Number(filterUserId) : undefined,
  });

  const fetchReservations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminReservations(token, {
        from: filterFrom || undefined,
        to: filterTo || undefined,
        status: filterStatus || undefined,
        user_id: filterUserId ? Number(filterUserId) : undefined,
      });
      setReservations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterFrom, filterTo, filterStatus, filterUserId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      await exportReservationsCsv(token, buildFilters());
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setFilterFrom('');
    setFilterTo('');
    setFilterStatus('');
    setFilterUserId('');
  }

  const hasFilters = filterFrom || filterTo || filterStatus || filterUserId;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold">Historial de reservas</h1>
        <button
          onClick={handleExport}
          disabled={exporting || reservations.length === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Desde</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Hasta</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Estado</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="reservada">Reservada</option>
            <option value="ocupada">Ocupada</option>
            <option value="liberada">Liberada</option>
            <option value="cancelada">Cancelada</option>
            <option value="expirada">Expirada</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">ID de usuario</span>
          <input
            type="number"
            min="1"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            placeholder="Ej. 2"
            className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-400 underline hover:text-slate-700"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              {['#', 'Usuario', 'Espacio', 'Tipo', 'Fecha', 'Estado', 'Creada'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-slate-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-slate-400">Cargando…</td>
              </tr>
            ) : reservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-slate-400">
                  No hay reservas para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 tabular-nums text-slate-400">{r.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.user.fullName}</p>
                    <p className="text-xs text-slate-400">{r.user.email}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.space.label}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{r.space.vehicleType}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {new Date(r.reservationDate + 'T00:00:00').toLocaleDateString('es-GT')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[r.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    {r.isLateCancellation && (
                      <span className="ml-1 text-xs text-amber-600">tardía</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleString('es-GT')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
