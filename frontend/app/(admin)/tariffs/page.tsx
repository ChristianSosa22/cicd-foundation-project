'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createTariff,
  getAdminTariffs,
  getTariffs,
  type AdminTariff,
  type Tariff,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

type VehicleType = 'auto' | 'moto' | 'camioneta';

const TIPO_LABELS: Record<string, string> = {
  auto: 'Auto',
  moto: 'Moto',
  camioneta: 'Camioneta',
};

function formatPrice(price: string): string {
  return parseFloat(price).toFixed(2);
}

export default function TariffsPage() {
  const { token } = useAuth();
  const [current, setCurrent] = useState<Tariff[]>([]);
  const [history, setHistory] = useState<AdminTariff[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('GTQ');
  const [error, setError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchTariffs = useCallback(async () => {
    if (!token) return;
    try {
      const [cur, hist] = await Promise.all([getTariffs(token), getAdminTariffs(token)]);
      setCurrent(cur);
      setHistory(hist);
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSuccess(false);
    setFormLoading(true);
    try {
      await createTariff(token, vehicleType, parseFloat(price), currency);
      setPrice('');
      setSuccess(true);
      await fetchTariffs();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold" data-testid="tariffs-heading">
        Gestión de tarifas
      </h1>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Current tariffs */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Tarifas actuales
          </h2>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm" data-testid="current-tariffs-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-700">Tipo</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Precio</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-700">Moneda</th>
                </tr>
              </thead>
              <tbody>
                {current.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-slate-400"
                      data-testid="current-tariffs-empty"
                    >
                      Sin tarifas registradas
                    </td>
                  </tr>
                ) : (
                  current.map((t) => (
                    <tr
                      key={t.vehicle_type}
                      className="border-b border-slate-100 last:border-0"
                      data-testid={`current-row-${t.vehicle_type}`}
                    >
                      <td className="px-4 py-3">{TIPO_LABELS[t.vehicle_type] ?? t.vehicle_type}</td>
                      <td
                        className="px-4 py-3 text-right font-medium tabular-nums"
                        data-testid="tariff-price"
                      >
                        {formatPrice(t.price)}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-slate-500"
                        data-testid="tariff-currency"
                      >
                        {t.currency}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* New tariff form */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Nueva tarifa
          </h2>
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
            data-testid="create-tariff-form"
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">Tipo de vehículo</span>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                data-testid="tariff-vehicle-type"
              >
                <option value="auto">Auto</option>
                <option value="moto">Moto</option>
                <option value="camioneta">Camioneta</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Precio</span>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                data-testid="tariff-price-input"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Moneda (3 letras)</span>
              <input
                type="text"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-slate-900 focus:outline-none"
                data-testid="tariff-currency-input"
              />
            </label>

            {error && (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                data-testid="create-tariff-error"
              >
                {error}
              </p>
            )}
            {success && (
              <p
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                data-testid="create-tariff-success"
              >
                Tarifa creada correctamente.
              </p>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              data-testid="create-tariff-submit"
            >
              {formLoading ? 'Guardando…' : 'Guardar tarifa'}
            </button>
            <p className="text-xs text-slate-400">
              Las tarifas son de sólo adición — no se pueden editar ni eliminar.
            </p>
          </form>
        </section>
      </div>

      {/* Tariff history */}
      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Historial de tarifas
          </h2>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-sm" data-testid="tariff-history-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-700">Tipo</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Precio</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Moneda</th>
                  <th className="px-4 py-3 font-medium text-slate-700">Vigente desde</th>
                </tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 last:border-0"
                    data-testid={`history-row-${t.id}`}
                  >
                    <td className="px-4 py-3">{TIPO_LABELS[t.vehicle_type] ?? t.vehicle_type}</td>
                    <td className="px-4 py-3 tabular-nums">{formatPrice(t.price)}</td>
                    <td className="px-4 py-3 text-slate-500">{t.currency}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.effective_from).toLocaleString('es-GT')}
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