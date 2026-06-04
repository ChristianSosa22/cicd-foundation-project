'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'driver';
}

export function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace('/login');
      return;
    }
    if (requiredRole && user && user.system_role !== requiredRole) {
      router.replace(user.system_role === 'admin' ? '/dashboard' : '/availability');
    }
  }, [loading, token, user, requiredRole, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
    );
  }

  if (!token) return null;
  if (requiredRole && user && user.system_role !== requiredRole) return null;

  return <>{children}</>;
}
