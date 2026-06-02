const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw data as ApiError;
  return data as T;
}

export interface SessionUser {
  id: number;
  full_name: string;
  system_role: 'admin' | 'driver';
  category: string | null;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
