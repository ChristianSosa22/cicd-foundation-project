'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSettings, updateSetting, type Setting } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

function CancellationWindowControl({
  currentValue,
  token,
  onSuccess,
}: {
  currentValue: number;
  token: string;
  onSuccess: () => void;
}) {
  const [hours, setHours] = useState(String(currentValue));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(hours);
    if (isNaN(value) || value < 0) {
      setError('Debe ser un número positivo.');
      return;
    }
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      await updateSetting(token, 'cancellation_window_hours', value);
      setSaved(true);
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Horas de anticipación para cancelación</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={hours}
            onChange={(e) => { setHours(e.target.value); setSaved(false); }}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
          <span className="text-sm text-slate-500">horas</span>
        </div>
        <p className="text-xs text-slate-400">
          Las cancelaciones dentro de este plazo antes de la fecha de reserva se marcan como tardías.
        </p>
      </label>
      <div className="flex flex-col gap-1 pb-0.5">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {saved && <span className="text-xs text-emerald-600">Guardado.</span>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

function GenericSettingRow({
  setting,
  token,
  onSuccess,
}: {
  setting: Setting;
  token: string;
  onSuccess: () => void;
}) {
  const [value, setValue] = useState(JSON.stringify(setting.value));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError('Valor JSON inválido.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updateSetting(token, setting.key, parsed);
      setEditing(false);
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-mono text-sm">{setting.key}</td>
      <td className="px-4 py-3 text-sm">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm font-mono focus:border-slate-900 focus:outline-none"
            />
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              onClick={save}
              disabled={loading}
              className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? '…' : 'Guardar'}
            </button>
            <button
              onClick={() => { setEditing(false); setValue(JSON.stringify(setting.value)); }}
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <span className="font-mono">{JSON.stringify(setting.value)}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {new Date(setting.updated_at).toLocaleString('es-GT')}
      </td>
      <td className="px-4 py-3">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            Editar
          </button>
        )}
      </td>
    </tr>
  );
}

export default function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getSettings(token);
      setSettings(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const cancellationSetting = settings.find((s) => s.key === 'cancellation_window_hours');
  const otherSettings = settings.filter((s) => s.key !== 'cancellation_window_hours');

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold">Configuración del sistema</h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <>
          {/* First-class control for cancellation window */}
          {cancellationSetting && token && (
            <section className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Política de cancelación
              </h2>
              <CancellationWindowControl
                currentValue={Number(cancellationSetting.value)}
                token={token}
                onSuccess={fetchSettings}
              />
            </section>
          )}

          {/* Generic settings table for other keys */}
          {otherSettings.length > 0 && token && (
            <section>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Otras configuraciones
              </h2>
              <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-4 py-3 font-medium text-slate-700">Clave</th>
                      <th className="px-4 py-3 font-medium text-slate-700">Valor</th>
                      <th className="px-4 py-3 font-medium text-slate-700">Actualizado</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherSettings.map((s) => (
                      <GenericSettingRow
                        key={s.key}
                        setting={s}
                        token={token}
                        onSuccess={fetchSettings}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
