'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiGet, ApiError, setOnUnauthorized } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export type User = { id: string; email: string; name?: string | null; role: string };

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const goLogin = useCallback(() => {
    toast.error('Сессия истекла. Войдите снова.');
    const target = pathname && pathname !== '/login' ? `/login?next=${encodeURIComponent(pathname)}` : '/login';
    router.replace(target);
  }, [pathname, router]);

  useEffect(() => {
    setOnUnauthorized(goLogin);
    return () => setOnUnauthorized(null);
  }, [goLogin]);

  const checkAuth = useCallback(() => {
    setLoading(true);
    setAuthError(null);
    apiGet<User>('/api/v1/users/me')
      .then((r) => {
        setUser(r.data);
        setLoading(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          goLogin();
          return;
        }
        setUser(null);
        setAuthError('Не удалось проверить сессию. Проверьте подключение к API и повторите.');
        setLoading(false);
      });
  }, [goLogin]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-destructive">{authError}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkAuth}>Повторить</Button>
          <Button onClick={goLogin}>На страницу входа</Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
