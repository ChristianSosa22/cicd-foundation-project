'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { RouteGuard } from '@/components/RouteGuard';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  function navClass(href: string) {
    const active = pathname === href;
    return `text-sm font-medium transition-colors ${
      active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
    }`;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 flex-shrink-0">
                <path d="M28 3 L51 16 L51 40 L28 53 L5 40 L5 16 Z" fill="#0f172a" />
                <text x="28" y="37" textAnchor="middle" fill="white" fontSize="26" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="-1">P</text>
                <circle cx="37" cy="17" r="4" fill="#3b82f6" />
              </svg>
              <span className="text-sm font-semibold text-slate-900">Parqueos</span>
            </div>
            <nav className="flex gap-6">
              <Link href="/availability" className={navClass('/availability')}>
                Disponibilidad
              </Link>
              <Link href="/reservations" className={navClass('/reservations')}>
                Mis Reservas
              </Link>
              <Link href="/vehicles" className={navClass('/vehicles')}>
                Mis Vehículos
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden text-sm text-slate-500 sm:block">{user.full_name}</span>
            )}
            <Link
              href="/change-password"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Contraseña
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <RouteGuard requiredRole="driver">{children}</RouteGuard>
    </div>
  );
}
