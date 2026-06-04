'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createAdminUser,
  getAdminUsers,
  setUserActive,
  updateAdminUser,
  type AdminUser,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';

type SystemRole = 'admin' | 'driver';
type Category = 'ejecutivo' | 'operativo' | 'visitante_frecuente' | '';

const CATEGORY_LABELS: Record<string, string> = {
  ejecutivo: 'Ejecutivo',
  operativo: 'Operativo',
  visitante_frecuente: 'Visitante Frecuente',
};

function CreateUserForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SystemRole>('driver');
  const [category, setCategory] = useState<Category>('ejecutivo');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createAdminUser(token, {
        email,
        full_name: fullName,
        password,
        system_role: role,
        category: role === 'admin' ? null : (category || null),
        phone: phone || undefined,
      });
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('driver');
      setCategory('ejecutivo');
      setPhone('');
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
    >
      <h2 className="text-sm font-semibold text-slate-700">Crear usuario</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Correo electrónico</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Nombre completo</span>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Contraseña (mín. 8 chars)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Teléfono (opcional)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as SystemRole)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="driver">Conductor</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        {role === 'driver' && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">Categoría</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="ejecutivo">Ejecutivo</option>
              <option value="operativo">Operativo</option>
              <option value="visitante_frecuente">Visitante Frecuente</option>
            </select>
          </label>
        )}
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? 'Creando…' : 'Crear usuario'}
      </button>
    </form>
  );
}

function EditUserRow({
  user,
  token,
  currentUserId,
  onDone,
}: {
  user: AdminUser;
  token: string;
  currentUserId: number;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState<SystemRole>(user.system_role);
  const [category, setCategory] = useState<Category>((user.category as Category) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const updates: Parameters<typeof updateAdminUser>[2] = { full_name: fullName };
      if (user.id !== currentUserId) updates.system_role = role;
      updates.category = role === 'admin' ? null : (category || null);
      await updateAdminUser(token, user.id, updates);
      onDone();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2 mt-2">
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none"
      />
      {user.id !== currentUserId && (
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as SystemRole)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="driver">Conductor</option>
          <option value="admin">Admin</option>
        </select>
      )}
      {role === 'driver' && (
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none"
        >
          <option value="ejecutivo">Ejecutivo</option>
          <option value="operativo">Operativo</option>
          <option value="visitante_frecuente">Visitante Frecuente</option>
        </select>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? '…' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
      >
        Cancelar
      </button>
    </form>
  );
}

export default function UsersPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  const [filterActive, setFilterActive] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminUsers(token, {
        is_active: filterActive === '' ? undefined : filterActive === 'true',
        system_role: filterRole || undefined,
        category: filterCategory || undefined,
      });
      setUsers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterActive, filterRole, filterCategory]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function toggleActive(u: AdminUser) {
    if (!token) return;
    setToggling(u.id);
    try {
      await setUserActive(token, u.id, !u.is_active);
      await fetchUsers();
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de usuarios</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showCreate ? 'Cancelar' : '+ Crear usuario'}
        </button>
      </div>

      {showCreate && token && (
        <CreateUserForm
          token={token}
          onSuccess={() => { setShowCreate(false); fetchUsers(); }}
        />
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Estado</span>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Rol</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="admin">Admin</option>
            <option value="driver">Conductor</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Categoría</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
          >
            <option value="">Todas</option>
            <option value="ejecutivo">Ejecutivo</option>
            <option value="operativo">Operativo</option>
            <option value="visitante_frecuente">Visitante Frecuente</option>
          </select>
        </label>
        {(filterActive || filterRole || filterCategory) && (
          <button
            onClick={() => { setFilterActive(''); setFilterRole(''); setFilterCategory(''); }}
            className="text-sm text-slate-400 underline hover:text-slate-700"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              {['Nombre', 'Correo', 'Rol', 'Categoría', 'Estado', 'Acciones'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-slate-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-slate-400">Cargando…</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
                  No hay usuarios para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.full_name}</p>
                    {editingId === u.id && token && (
                      <EditUserRow
                        user={u}
                        token={token}
                        currentUserId={currentUser?.id ?? -1}
                        onDone={() => { setEditingId(null); fetchUsers(); }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">
                    {u.system_role === 'admin' ? 'Admin' : 'Conductor'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.category ? (CATEGORY_LABELS[u.category] ?? u.category) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {editingId !== u.id && (
                        <button
                          onClick={() => setEditingId(u.id)}
                          className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Editar
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={toggling === u.id}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
                          u.is_active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {toggling === u.id ? '…' : u.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
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
