'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface AdminReservation {
  id: number;
  user: { full_name: string; email: string };
  parking_space: { code: string };
  vehicle: { plate: string; vehicle_type: string };
  date: string;
  estado: string;
  created_at: string;
}

const ESTADO_BADGE: Record<string, string> = {
  Confirmado: 'bg-emerald-100 text-emerald-700',
  Cancelado: 'bg-red-100 text-red-700',
  Reservado: 'bg-amber-100 text-amber-700',
};

export default function HistoryPage() {
  const { token } = useAuth();
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set('date', filterDate);
      if (filterUser) params.set('user', filterUser);
      const data = await apiFetch<AdminReservation[]>(
        `/admin/reservations?${params}`,
        {},
        token ?? undefined,
      );
      setReservations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterUser, token]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  function exportCsv() {
    const header = 'ID,Usuario,Email,Espacio,Placa,Tipo,Fecha,Estado,Registrado\n';
    const rowLines = reservations.map((r) =>
      [
        r.id,
        `"${r.user.full_name.replace(/"/g, '""')}"`,
        r.user.email,
        r.parking_space.code,
        r.vehicle.plate,
        r.vehicle.vehicle_type,
        r.date,
        r.estado,
        r.created_at,
      ].join(','),
    );
    const blob = new Blob([header + rowLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold">Historial de reservas</h1>
        <button
          onClick={exportCsv}
          disabled={reservations.length === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Exportar CSV
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Fecha</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Usuario</span>
          <input
            type="text"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder="Nombre o email"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <button
          onClick={fetchReservations}
          className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
        {filterDate || filterUser ? (
          <button
            onClick={() => { setFilterDate(''); setFilterUser(''); }}
            className="text-sm text-slate-400 hover:text-slate-600 underline"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              {['#', 'Usuario', 'Espacio', 'Vehículo', 'Fecha', 'Estado', 'Registrado'].map(
                (h) => (
                  <th key={h} className="px-4 py-3 font-medium text-slate-700">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-slate-400">
                  {loading
                    ? 'Cargando…'
                    : 'No hay reservas para los filtros seleccionados.'}
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-400 tabular-nums">{r.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.user.full_name}</p>
                    <p className="text-xs text-slate-400">{r.user.email}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.parking_space.code}</td>
                  <td className="px-4 py-3">
                    <p>{r.vehicle.plate}</p>
                    <p className="text-xs capitalize text-slate-400">
                      {r.vehicle.vehicle_type}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        ESTADO_BADGE[r.estado] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.created_at).toLocaleString('es-GT')}
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
