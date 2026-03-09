'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SnowflakeLogo } from '@/components/SnowflakeLogo';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const checkHealth = () =>
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setHealthOk(d?.ok === true);
        return d?.ok === true;
      })
      .catch(() => {
        setHealthOk(false);
        return false;
      })
      .finally(() => setHealthChecking(false));

  useEffect(() => {
    setHealthChecking(true);
    checkHealth().then((ok) => {
      if (!ok) setTimeout(() => { setHealthChecking(true); checkHealth(); }, 3000);
    });
  }, []);

  const handleRetryHealth = () => {
    setHealthChecking(true);
    checkHealth();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (res.status === 429) {
          setError('Слишком много попыток входа. Подождите и повторите.');
          return;
        }
        if (res.status === 503) {
          setError('Backend API недоступен. Проверьте состояние контейнеров.');
          return;
        }
        setError(data.error?.message || 'Ошибка входа');
        return;
      }
      const next = searchParams.get('next');
      const target = next && next.startsWith('/') ? next : '/';
      router.push(target);
      router.refresh();
    } catch {
      setError('Не удалось подключиться к API. Проверьте сеть и контейнеры.');
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'hsl(var(--frost-50))',
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(143, 200, 255, 0.15) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 90%, rgba(90, 173, 255, 0.1) 0%, transparent 50%)
        `,
      }}
    >
      <div className="w-full max-w-[420px] animate-fade-up">
        <Card
          className="border-[hsl(var(--frost-200))] shadow-[0_8px_40px_rgba(59,147,240,0.08),0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_48px_rgba(59,147,240,0.12),0_4px_12px_rgba(0,0,0,0.06)] transition-shadow rounded-[20px] p-10 sm:p-12"
        >
          <CardContent className="p-0">
            <div className="flex flex-col items-center gap-2 mb-2">
              <SnowflakeLogo size={48} />
              <h1 className="text-[32px] font-extrabold text-foreground tracking-tight">
                Снеж<span className="text-primary">ок</span>
              </h1>
            </div>
            <p className="text-center text-muted-foreground text-sm font-semibold mb-9">
              Мониторинг температуры
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-bold text-[hsl(212,17%,42%)]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.ru"
                  className="h-12 rounded-xl border-2 bg-[hsl(var(--frost-50))] font-semibold focus:bg-background"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[13px] font-bold text-[hsl(212,17%,42%)]">
                  Пароль
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-xl border-2 bg-[hsl(var(--frost-50))] font-semibold focus:bg-background"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive font-medium">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-base bg-gradient-to-br from-primary to-[hsl(211,86%,65%)] hover:from-[hsl(211,67%,50%)] hover:to-primary hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 transition-all"
              >
                Войти
              </Button>
            </form>

            {healthOk !== null && (
              <div
                className={`flex flex-col items-center gap-2 mt-7 py-2.5 px-4 rounded-xl text-xs font-semibold ${
                  healthOk
                    ? 'bg-[hsl(var(--frost-100))] text-muted-foreground'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      healthOk ? 'bg-green-500 animate-pulse' : 'bg-destructive'
                    }`}
                  />
                  {healthOk ? 'Система работает в штатном режиме' : 'Сервер недоступен'}
                </div>
                {!healthOk && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={handleRetryHealth}
                    disabled={healthChecking}
                  >
                    {healthChecking ? 'Проверка...' : 'Проверить снова'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground text-xs font-semibold mt-6">
          © {new Date().getFullYear()} Снежок
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-4 bg-[hsl(var(--frost-50))]">
          <Card className="w-full max-w-md">
            <CardContent className="py-12 text-center text-muted-foreground">
              Загрузка...
            </CardContent>
          </Card>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
