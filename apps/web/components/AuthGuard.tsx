'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, ApiError, setOnUnauthorized } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

export type User = { id: string; email: string; name?: string | null; role: string };

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const goLogin = useCallback(() => {
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    setOnUnauthorized(goLogin);
    return () => setOnUnauthorized(null);
  }, [goLogin]);

  useEffect(() => {
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
        setLoading(false);
      });
  }, [goLogin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
