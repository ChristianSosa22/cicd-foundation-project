'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getMe, type LoginResponse, type SessionUser } from '@/lib/api';

const STORAGE_KEY = 'parking.session';

interface AuthState {
  user: SessionUser | null;
  token: string | null;
  loading: boolean;
  setSession: (session: LoginResponse) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    tokenRef.current = null;
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const me = await getMe(tokenRef.current);
      if (!me.is_active) {
        logout();
        return;
      }
      setUser((prev) => (prev ? { ...prev, ...me } : me));
    } catch {
      logout();
    }
  }, [logout]);

  // Restore session from localStorage on mount, then verify with /auth/me
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      const session = JSON.parse(raw) as LoginResponse;
      setUser(session.user);
      setToken(session.token);
      tokenRef.current = session.token;

      getMe(session.token)
        .then((me) => {
          if (!me.is_active) {
            logout();
          } else {
            setUser((prev) => (prev ? { ...prev, ...me } : me));
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
    }
  }, [logout]);

  // Re-validate session on window focus (catches deactivated accounts)
  useEffect(() => {
    const onFocus = () => {
      if (tokenRef.current) void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const setSession = useCallback((session: LoginResponse) => {
    setUser(session.user);
    setToken(session.token);
    tokenRef.current = session.token;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, setSession, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
