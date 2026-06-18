'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createBlackout,
  createSpace,
  deleteBlackout,
  getAdminSpaces,
  getBlackouts,
  setSpaceActive,
  updateSpace,
  type Blackout,
  type Space,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

type VehicleType = 'auto' | 'moto' | 'camioneta';
type Category = 'ejecutivo' | 'operativo' | 'visitante_frecuente';

const ALL_CATEGORIES: Category[] = ['ejecutivo', 'operativo', 'visitante_frecuente'];
const CATEGORY_LABELS: Record<string, string> = {
  ejecutivo: 'Ejecutivo',
  operativo: 'Operativo',
  visitante_frecuente: 'Visitante Frecuente',
};
const TIPO_LABELS: Record<string, string> = { auto: 'Auto', moto: 'Moto', camioneta: 'Camioneta' };

function CategoryCheckboxes({
  selected,
  onChange,
}: {
  selected: Category[];
  onChange: (cats: Category[]) => void;
}) {
  function toggle(cat: Category) {
    onChange(
      selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat],
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {ALL_CATEGORIES.map((cat) => (
        <label key={cat} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(cat)}
            onChange={() => toggle(cat)}
            className="rounded border-slate-300"
            data-testid={`category-${cat}`}
          />
          {CATEGORY_LABELS[cat]}
        </label>
      ))}
    </div>
  );
}

function BlackoutPanel({ spaceId, token }: { spaceId: number; token: string }) {
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchBlackouts = useCallback(async () => {
    try {
      const data = await getBlackouts(token, spaceId);
      setBlackouts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, spaceId]);

  useEffect(() => {
    fetchBlackouts();
  }, [fetchBlackouts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (endDate < startDate) {
      setFormError('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      await createBlackout(token, spaceId, { start_date: startDate, end_date: endDate, reason: reason || undefined });
      setStartDate('');
      setEndDate('');
      setReason('');
      await fetchBlackouts();
    } catch (err) {
      setFormError(extractError(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteBlackout(token, id);
      await fetchBlackouts();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      data-testid="blackout-panel"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Períodos de bloqueo
      </h3>

      {loading ? (
        <p className="text-xs text-slate-400" data-testid="blackouts-loading">Cargando…</p>
      ) : blackouts.length === 0 ? (
        <p className="mb-3 text-xs text-slate-400" data-testid="blackouts-empty">
          Sin bloqueos activos.
        </p>
      ) : (
        <div className="mb-4 space-y-2">
          {blackouts.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200 text-sm"
              data-testid={`blackout-item-${b.id}`}
            >
              <div>
                <span className="font-medium tabular-nums">
                  {b.start_date} → {b.end_date}
                </span>
                {b.reason && <span className="ml-2 text-xs text-slate-500">{b.reason}</span>}
              </div>
              <button
                onClick={() => handleDelete(b.id)}
                disabled={deletingId === b.id}
                className="ml-4 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                data-testid="blackout-delete-btn"
              >
                {deletingId === b.id ? '…' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Desde</span>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-900 focus:outline-none"
            data-testid="blackout-start-date"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Hasta</span>
          <input
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-900 focus:outline-none"
            data-testid="blackout-end-date"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Motivo (opcional)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mantenimiento…"
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-slate-900 focus:outline-none"
            data-testid="blackout-reason"
          />
        </label>
        <div className="flex flex-col gap-1">
          {formError && (
            <span className="text-xs text-red-600" data-testid="blackout-form-error">
              {formError}
            </span>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            data-testid="blackout-add-btn"
          >
            {creating ? '…' : '+ Agregar bloqueo'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SpaceCard({
  space,
  token,
  onRefresh,
}: {
  space: Space;
  token: string;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showBlackouts, setShowBlackouts] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [label, setLabel] = useState(space.label);
  const [vehicleType, setVehicleType] = useState<VehicleType>(space.vehicle_type);
  const [categories, setCategories] = useState<Category[]>(space.allowed_categories as Category[]);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (categories.length === 0) {
      setEditError('Debes seleccionar al menos una categoría.');
      return;
    }
    setEditError(null);
    setSaving(true);
    try {
      await updateSpace(token, space.id, {
        label,
        vehicle_type: vehicleType,
        allowed_categories: categories,
      });
      setEditing(false);
      onRefresh();
    } catch (err) {
      setEditError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setToggling(true);
    try {
      await setSpaceActive(token, space.id, !space.is_active);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      data-testid={`space-card-${space.id}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold" data-testid="space-label">
              {space.label}
            </span>
            <span className="text-sm capitalize text-slate-500" data-testid="space-vehicle-type">
              {TIPO_LABELS[space.vehicle_type] ?? space.vehicle_type}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                space.is_active
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
              data-testid="space-status-badge"
            >
              {space.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Categorías: {space.allowed_categories.map((c) => CATEGORY_LABELS[c] ?? c).join(', ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            data-testid="space-edit-btn"
          >
            {editing ? 'Cancelar edición' : 'Editar'}
          </button>
          <button
            onClick={toggleActive}
            disabled={toggling}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
              space.is_active
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
            data-testid="space-toggle-active-btn"
          >
            {toggling ? '…' : space.is_active ? 'Desactivar' : 'Activar'}
          </button>
          <button
            onClick={() => setShowBlackouts((v) => !v)}
            className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
            data-testid="space-blackouts-btn"
          >
            {showBlackouts ? 'Ocultar bloqueos' : 'Bloqueos'}
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="mt-4 space-y-4 border-t border-slate-100 pt-4"
          data-testid="space-edit-form"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Etiqueta</span>
              <input
                type="text"
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                data-testid="edit-label-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">Tipo de vehículo</span>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                data-testid="edit-vehicle-type"
              >
                <option value="auto">Auto</option>
                <option value="moto">Moto</option>
                <option value="camioneta">Camioneta</option>
              </select>
            </label>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-600">Categorías permitidas</span>
            <CategoryCheckboxes selected={categories} onChange={setCategories} />
          </div>
          {editError && (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="edit-space-error"
            >
              {editError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              data-testid="edit-save-btn"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              data-testid="edit-cancel-btn"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showBlackouts && (
        <BlackoutPanel spaceId={space.id} token={token} />
      )}
    </div>
  );
}

function CreateSpaceForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [label, setLabel] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('auto');
  const [categories, setCategories] = useState<Category[]>(['ejecutivo']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (categories.length === 0) {
      setError('Debes seleccionar al menos una categoría.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createSpace(token, { label, vehicle_type: vehicleType, allowed_categories: categories });
      setLabel('');
      setVehicleType('auto');
      setCategories(['ejecutivo']);
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      data-testid="create-space-form"
    >
      <h2 className="text-sm font-semibold text-slate-700">Crear espacio</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Etiqueta (única)</span>
          <input
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value.toUpperCase())}
            placeholder="E-001"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-slate-900 focus:outline-none"
            data-testid="create-label-input"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Tipo de vehículo</span>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as VehicleType)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            data-testid="create-vehicle-type"
          >
            <option value="auto">Auto</option>
            <option value="moto">Moto</option>
            <option value="camioneta">Camioneta</option>
          </select>
        </label>
      </div>
      <div className="space-y-1">
        <span className="text-xs font-medium text-slate-600">Categorías permitidas</span>
        <CategoryCheckboxes selected={categories} onChange={setCategories} />
      </div>
      {error && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          data-testid="create-space-error"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        data-testid="create-space-submit"
      >
        {loading ? 'Creando…' : 'Crear espacio'}
      </button>
    </form>
  );
}

export default function SpacesPage() {
  const { token } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchSpaces = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAdminSpaces(token);
      setSpaces(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold" data-testid="spaces-heading">
          Gestión de parqueos
        </h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          data-testid="toggle-create-btn"
        >
          {showCreate ? 'Cancelar' : '+ Crear espacio'}
        </button>
      </div>

      {showCreate && token && (
        <CreateSpaceForm
          token={token}
          onSuccess={() => { setShowCreate(false); fetchSpaces(); }}
        />
      )}

      {loading ? (
        <div className="space-y-3" data-testid="spaces-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"
          data-testid="spaces-empty"
        >
          <p className="text-slate-500">No hay espacios registrados.</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="spaces-list">
          {spaces.map((s) => (
            <SpaceCard key={s.id} space={s} token={token!} onRefresh={fetchSpaces} />
          ))}
        </div>
      )}
    </main>
  );
}
