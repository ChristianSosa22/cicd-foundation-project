'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

type VehicleType = 'auto' | 'moto' | 'camioneta';

export default function OnboardingPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      await createVehicle(token, plate.trim().toUpperCase(), vehicleType);
      router.push('/vehicles');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <div className="mb-8 space-y-1">
        <h1 className="text-xl font-semibold">Registrar vehículo</h1>
        <p className="text-sm text-slate-500">
          Agrega tu vehículo para poder realizar reservas de parqueo.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Placa</span>
          <input
            type="text"
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="ABC-1234"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase tracking-wider focus:border-slate-900 focus:outline-none"
          />
        </label>

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

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Registrando…' : 'Registrar vehículo'}
        </button>
      </form>
    </main>
  );
}
