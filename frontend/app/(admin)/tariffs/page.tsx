'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Tariff {
  id: number;
  vehicle_type: string;
  price: number;
}

type VehicleType = 'auto' | 'moto' | 'camioneta';

export default function TariffsPage() {
  const { token } = useAuth();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchTariffs = useCallback(async () => {
    try {
      const data = await apiFetch<Tariff[]>('/tariffs', {}, token ?? undefined);
      setTariffs(data);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFormLoading(true);
    try {
      await apiFetch('/admin/tariffs', {
        method: 'POST',
        body: JSON.stringify({ vehicle_type: vehicleType, price: parseFloat(price) }),
      }, token ?? undefined);
      setPrice('');
      await fetchTariffs();
    } catch (err) {
      setError((err as ApiError)?.error ?? 'Error al guardar la tarifa');
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold">Gestión de tarifas</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Tarifas actuales
          </h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-700">
                    Tipo de vehículo
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">
                    Precio / hora
                  </th>
                </tr>
              </thead>
              <tbody>
                {tariffs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      Sin tarifas registradas
                    </td>
                  </tr>
                ) : (
                  tariffs.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-3 capitalize">{t.vehicle_type}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        Q {t.price.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Nueva tarifa
          </h2>
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
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

            <label className="block space-y-1">
              <span className="text-sm font-medium">Precio por hora (Q)</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {formLoading ? 'Guardando…' : 'Guardar tarifa'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
