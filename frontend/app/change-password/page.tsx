'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractError } from '@/lib/errors';
import { RouteGuard } from '@/components/RouteGuard';

function ChangePasswordForm() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const homeHref = user?.system_role === 'admin' ? '/dashboard' : '/availability';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (newPassword !== confirm) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await changePassword(token, currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <button
          onClick={() => router.push(homeHref)}
          className="mb-6 text-sm text-slate-500 hover:text-slate-800"
        >
          ← Volver
        </button>

        <h1 className="mb-6 text-xl font-semibold">Cambiar contraseña</h1>

        {success ? (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center space-y-4">
            <p className="text-emerald-700 font-medium">Contraseña actualizada correctamente.</p>
            <p className="text-sm text-slate-500">
              Tu token actual sigue siendo válido. Si prefieres, cierra sesión e inicia con la nueva contraseña.
            </p>
            <button
              onClick={() => router.push(homeHref)}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Continuar
            </button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">Contraseña actual</span>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                placeholder="••••••••"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Nueva contraseña</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                placeholder="Mínimo 8 caracteres"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Confirmar nueva contraseña</span>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                placeholder="Repite la nueva contraseña"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <RouteGuard>
      <ChangePasswordForm />
    </RouteGuard>
  );
}
