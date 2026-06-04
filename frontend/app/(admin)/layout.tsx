'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { RouteGuard } from '@/components/RouteGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    setMenuOpen(false);
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 flex-shrink-0">
                <path d="M28 3 L51 16 L51 40 L28 53 L5 40 L5 16 Z" fill="#0f172a" />
                <text x="28" y="37" textAnchor="middle" fill="white" fontSize="26" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="-1">P</text>
                <circle cx="37" cy="17" r="4" fill="#3b82f6" />
              </svg>
              <span className="text-sm font-semibold text-slate-900">Admin · Parqueos</span>
            </div>
            <nav className="flex flex-wrap gap-5">
              <Link href="/dashboard" className={navClass('/dashboard')}>Dashboard</Link>
              <Link href="/users" className={navClass('/users')}>Usuarios</Link>
              <Link href="/spaces" className={navClass('/spaces')}>Parqueos</Link>
              <Link href="/approvals" className={navClass('/approvals')}>Aprobaciones</Link>
              <Link href="/tariffs" className={navClass('/tariffs')}>Tarifas</Link>
              <Link href="/history" className={navClass('/history')}>Historial</Link>
              <Link href="/settings" className={navClass('/settings')}>Configuración</Link>
            </nav>
          </div>

          {user && (
            <div className="relative hidden sm:block" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5 transition-colors hover:bg-slate-100"
              >
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900">
                  <span className="text-xs font-bold leading-none text-white">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-800">{user.full_name}</span>
                <svg
                  className={`h-3 w-3 text-slate-400 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center gap-3 bg-slate-100 px-4 py-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900">
                      <span className="text-sm font-bold leading-none text-white">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
                      <p className="text-xs text-slate-500">Administrador</p>
                    </div>
                  </div>
                  <Link
                    href="/change-password"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cambiar contraseña
                  </Link>
                  <div className="border-t border-slate-100" />
                  <button
                    onClick={handleLogout}
                    className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <RouteGuard requiredRole="admin">{children}</RouteGuard>
    </div>
  );
}
