'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginResponse, SessionUser } from '@/lib/api';

const STORAGE_KEY = 'parking.session';

interface AuthState {
  user: SessionUser | null;
  token: string | null;
  setSession: (session: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as LoginResponse;
      setUser(session.user);
      setToken(session.token);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setSession = (session: LoginResponse) => {
    setUser(session.user);
    setToken(session.token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
