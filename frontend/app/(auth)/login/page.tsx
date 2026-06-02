'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, type ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(email, password);
      setSession(session);
      router.push(session.user.system_role === 'admin' ? '/dashboard' : '/availability');
    } catch (err) {
      setError((err as ApiError)?.error ?? 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 pb-2">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14">
              {/* Hexagon background */}
              <path
                d="M28 3 L51 16 L51 40 L28 53 L5 40 L5 16 Z"
                fill="#0f172a"
              />
              {/* Letter P */}
              <text
                x="28"
                y="37"
                textAnchor="middle"
                fill="white"
                fontSize="26"
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                letterSpacing="-1"
              >
                P
              </text>
              {/* Accent dot */}
              <circle cx="37" cy="17" r="4" fill="#3b82f6" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Reserva de Parqueos
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Ingresa a tu cuenta para continuar
            </p>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Correo</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            placeholder="tu@empresa.com"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
