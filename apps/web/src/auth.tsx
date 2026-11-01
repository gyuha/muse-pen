import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, type Me } from './api';

interface AuthState {
  // undefined = 세션 확인 중, null = 로그아웃 상태
  me: Me | null | undefined;
  login(email: string, password: string): Promise<void>;
  signup(input: { email: string; password: string; name: string; inviteCode: string }): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  // 새로고침 후에도 쿠키 세션으로 로그인이 유지된다.
  useEffect(() => {
    api.me().then(setMe, (error: unknown) => {
      if (!(error instanceof ApiError) || error.status !== 401) console.error(error);
      setMe(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.signIn(email, password);
    setMe(await api.me());
  }, []);
  const signup = useCallback(async (input: { email: string; password: string; name: string; inviteCode: string }) => {
    await api.signUp(input);
    await api.signIn(input.email, input.password);
    setMe(await api.me());
  }, []);
  const logout = useCallback(async () => {
    await api.signOut();
    setMe(null);
  }, []);

  const value = useMemo(() => ({ me, login, signup, logout }), [me, login, signup, logout]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider 안에서만 쓸 수 있다');
  return value;
}
