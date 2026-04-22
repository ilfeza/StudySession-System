import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import { User } from '../types';

interface AuthContextShape {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; full_name: string; password: string; role: User['role']; skills: string[] }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextShape | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.get<User>('/auth/me')
      .then((response) => setUser(response.data))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const response = await api.post<{ access_token: string }>('/auth/login', { email, password });
    localStorage.setItem('access_token', response.data.access_token);
    const me = await api.get<User>('/auth/me');
    setUser(me.data);
  }

  async function register(payload: { email: string; full_name: string; password: string; role: User['role']; skills: string[] }) {
    await api.post('/auth/register', payload);
    await login(payload.email, payload.password);
  }

  function logout() {
    localStorage.removeItem('access_token');
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('Контекст авторизации недоступен.');
  }
  return context;
}
