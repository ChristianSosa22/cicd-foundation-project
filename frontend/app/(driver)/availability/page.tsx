'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAvailability, type AvailabilitySpace } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const ESTADO_CLASSES: Record<string, string> = {
  Disponible: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer ring-emerald-200',
  Reservado: 'bg-amber-100 text-amber-800 cursor-not-allowed opacity-70 ring-amber-200',
  Ocupado: 'bg-red-100 text-red-800 cursor-not-allowed opacity-70 ring-red-200',
};

const LEGEND = [
  { label: 'Disponible', color: 'bg-emerald-200' },
  { label: 'Reservado', color: 'bg-amber-200' },
  { label: 'Ocupado', color: 'bg-red-200' },
];

const TIPO_LABELS: Record<string, string> = {
  auto: 'Auto',
  moto: 'Moto',
  camioneta: 'Camioneta',
};

export default function AvailabilityPage() {
  const { token } = useAuth();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [fecha, setFecha] = useState(today);
  const [tipoVehiculo, setTipoVehiculo] = useState('');
  const [spaces, setSpaces] = useState<AvailabilitySpace[]>([]);
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSpaces = useCallback(async () => {
    if (!token) return;
    setFetching(true);
    try {
      const data = await getAvailability(token, fecha, tipoVehiculo || undefined);
      setSpaces(data);
      setLastUpdated(new Date());
    } catch {
      // keep previous data on poll failure
    } finally {
      setFetching(false);
    }
  }, [fecha, tipoVehiculo, token]);

  useEffect(() => {
    fetchSpaces();
    const id = setInterval(fetchSpaces, 30_000);
    return () => clearInterval(id);
  }, [fetchSpaces]);

  function handleClick(space: AvailabilitySpace) {
    if (space.estado !== 'Disponible') return;
    const params = new URLSearchParams({
      space: String(space.id_espacio),
      label: space.label,
      tipo: space.tipo_vehiculo,
    });
    router.push(`/reserve?${params}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold">Disponibilidad</h1>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Fecha</span>
            <input
              type="date"
              value={fecha}
              min={today}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Tipo de vehículo</span>
            <select
              value={tipoVehiculo}
              onChange={(e) => setTipoVehiculo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="auto">Auto</option>
              <option value="moto">Moto</option>
              <option value="camioneta">Camioneta</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-5">
        {LEGEND.map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5 text-sm text-slate-600">
            <span className={`h-3 w-3 rounded ${color}`} />
            {label}
          </span>
        ))}
        {lastUpdated && (
          <span className="ml-auto text-xs text-slate-400">
            {fetching ? 'Actualizando…' : `Actualizado ${lastUpdated.toLocaleTimeString('es-GT')}`}
          </span>
        )}
      </div>

      {fetching && spaces.length === 0 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
          <p className="text-slate-500">No hay espacios disponibles para esta categoría o fecha.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {spaces.map((space) => (
            <button
              key={space.id_espacio}
              onClick={() => handleClick(space)}
              disabled={space.estado !== 'Disponible'}
              title={space.estado}
              className={`rounded-xl p-3 text-center text-sm ring-1 ring-inset transition-colors ${
                ESTADO_CLASSES[space.estado] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
            >
              <span className="block font-semibold">{space.label}</span>
              <span className="block text-xs opacity-70">{TIPO_LABELS[space.tipo_vehiculo] ?? space.tipo_vehiculo}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
