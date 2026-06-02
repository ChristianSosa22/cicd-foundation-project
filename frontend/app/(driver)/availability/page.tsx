'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface ParkingSpace {
  id: number;
  code: string;
  estado: 'Disponible' | 'Reservado' | 'Ocupado';
  tipo_vehiculo: string;
}

const ESTADO_CLASSES: Record<string, string> = {
  Disponible: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer ring-emerald-200',
  Reservado: 'bg-amber-100 text-amber-800 cursor-not-allowed opacity-70',
  Ocupado: 'bg-red-100 text-red-800 cursor-not-allowed opacity-70',
};

const LEGEND: Array<{ label: string; color: string }> = [
  { label: 'Disponible', color: 'bg-emerald-200' },
  { label: 'Reservado', color: 'bg-amber-200' },
  { label: 'Ocupado', color: 'bg-red-200' },
];

export default function AvailabilityPage() {
  const { token } = useAuth();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [fecha, setFecha] = useState(today);
  const [tipoVehiculo, setTipoVehiculo] = useState('');
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSpaces = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams({ fecha });
      if (tipoVehiculo) params.set('tipo_vehiculo', tipoVehiculo);
      const data = await apiFetch<ParkingSpace[]>(
        `/availability?${params}`,
        {},
        token ?? undefined,
      );
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

  function handleClick(space: ParkingSpace) {
    if (space.estado !== 'Disponible') return;
    router.push(`/reserve?space=${space.id}`);
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

      <div className="mb-5 flex items-center gap-5">
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

      {spaces.length === 0 && !fetching ? (
        <p className="py-24 text-center text-slate-400">
          No hay espacios para los filtros seleccionados.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => handleClick(space)}
              disabled={space.estado !== 'Disponible'}
              title={space.estado}
              className={`rounded-xl p-3 text-center text-sm ring-1 ring-inset transition-colors ${
                ESTADO_CLASSES[space.estado] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              <span className="block font-semibold">{space.code}</span>
              <span className="block text-xs opacity-70 capitalize">{space.tipo_vehiculo}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
