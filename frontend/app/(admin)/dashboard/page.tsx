'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface OccupancyRow {
  estado: string;
  tipo_vehiculo: string;
  count: number;
}

const TIPOS = ['auto', 'moto', 'camioneta'] as const;
const ESTADOS = ['Disponible', 'Reservado', 'Ocupado'] as const;

const ESTADO_CARD: Record<string, string> = {
  Disponible: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  Reservado: 'bg-amber-50 border-amber-200 text-amber-800',
  Ocupado: 'bg-red-50 border-red-200 text-red-800',
};

export default function DashboardPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<OccupancyRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOccupancy = useCallback(async () => {
    try {
      const data = await apiFetch<OccupancyRow[]>(
        '/admin/dashboard/occupancy',
        {},
        token ?? undefined,
      );
      setRows(data);
      setLastUpdated(new Date());
    } catch {
      // keep previous data on poll failure
    }
  }, [token]);

  useEffect(() => {
    fetchOccupancy();
    const id = setInterval(fetchOccupancy, 30_000);
    return () => clearInterval(id);
  }, [fetchOccupancy]);

  function getCount(estado: string, tipo: string) {
    return rows.find((r) => r.estado === estado && r.tipo_vehiculo === tipo)?.count ?? 0;
  }

  function totalByEstado(estado: string) {
    return rows.filter((r) => r.estado === estado).reduce((s, r) => s + r.count, 0);
  }

  const grandTotal = rows.reduce((s, r) => s + r.count, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Dashboard de ocupación</h1>
        {lastUpdated && (
          <span className="text-xs text-slate-400">
            Actualizado {lastUpdated.toLocaleTimeString('es-GT')}
          </span>
        )}
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        {ESTADOS.map((estado) => {
          const count = totalByEstado(estado);
          const pct = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0;
          return (
            <div
              key={estado}
              className={`rounded-xl border p-5 ${ESTADO_CARD[estado] ?? 'bg-slate-50 border-slate-200'}`}
            >
              <p className="text-sm font-medium">{estado}</p>
              <p className="mt-1 text-4xl font-bold tabular-nums">{count}</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-current opacity-40"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs opacity-60">{pct}% del total</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-2/6" />
            <col className="w-1/6" />
            <col className="w-1/6" />
            <col className="w-1/6" />
            <col className="w-1/6" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-700">Estado</th>
              {TIPOS.map((t) => (
                <th key={t} className="px-4 py-3 text-center font-medium capitalize text-slate-700">
                  {t}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-medium text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {ESTADOS.map((estado) => (
              <tr key={estado} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium">{estado}</td>
                {TIPOS.map((tipo) => (
                  <td key={tipo} className="px-4 py-3 text-center tabular-nums">
                    {getCount(estado, tipo)}
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-semibold tabular-nums">
                  {totalByEstado(estado)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-700">Total</td>
              {TIPOS.map((tipo) => (
                <td key={tipo} className="px-4 py-3 text-center font-semibold tabular-nums">
                  {ESTADOS.reduce((s, e) => s + getCount(e, tipo), 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-center font-bold tabular-nums">{grandTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
