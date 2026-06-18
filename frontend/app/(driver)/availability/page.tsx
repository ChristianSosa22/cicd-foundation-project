'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAvailability, type AvailabilitySpace } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const ESTADO_CLASSES: Record<string, string> = {
  Disponible:
    'bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer',
  Reservado:
    'bg-amber-50 text-amber-800 ring-amber-200 cursor-not-allowed opacity-60',
  Ocupado:
    'bg-red-50 text-red-800 ring-red-200 cursor-not-allowed opacity-60',
};

const LEGEND = [
  { label: 'Disponible', color: 'bg-emerald-400' },
  { label: 'Reservado', color: 'bg-amber-400' },
  { label: 'Ocupado', color: 'bg-red-400' },
];

const TIPO_EMOJI: Record<string, string> = {
  auto: '🚗',
  moto: '🏍️',
  camioneta: '🚐',
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
        <h1 className="text-2xl font-semibold" data-testid="availability-heading">
          Disponibilidad
        </h1>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Fecha</span>
            <input
              type="date"
              value={fecha}
              min={today}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              data-testid="date-filter"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Tipo de vehículo</span>
            <select
              value={tipoVehiculo}
              onChange={(e) => setTipoVehiculo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
              data-testid="vehicle-type-filter"
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
          <span className="ml-auto text-xs text-slate-400" data-testid="last-updated">
            {fetching ? 'Actualizando…' : `Actualizado ${lastUpdated.toLocaleTimeString('es-GT')}`}
          </span>
        )}
      </div>

      {fetching && spaces.length === 0 ? (
        <div
          className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
          data-testid="spaces-loading"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center"
          data-testid="spaces-empty"
        >
          <p className="text-slate-500">No hay espacios disponibles para esta categoría o fecha.</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
          data-testid="spaces-grid"
        >
          {spaces.map((space) => (
            <button
              key={space.id_espacio}
              onClick={() => handleClick(space)}
              disabled={space.estado !== 'Disponible'}
              title={`${space.label} · ${space.estado}`}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-4 text-center ring-1 ring-inset transition-all ${
                ESTADO_CLASSES[space.estado] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
              data-testid={`space-btn-${space.id_espacio}`}
            >
              <span className="text-2xl leading-none">
                {TIPO_EMOJI[space.tipo_vehiculo] ?? '🅿️'}
              </span>
              <span className="text-sm font-bold tracking-wide">{space.label}</span>
              <span className="sr-only" data-testid="space-status">{space.estado}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}