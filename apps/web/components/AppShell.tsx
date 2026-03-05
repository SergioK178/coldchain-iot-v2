'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Cpu,
  MapPin,
  Bell,
  Settings,
  PlusCircle,
  LogOut,
  User,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from './AuthGuard';

const nav = [
  { href: '/', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/devices', label: 'Устройства', icon: Cpu },
  { href: '/locations', label: 'Локации', icon: MapPin },
  { href: '/alerts', label: 'Оповещения', icon: Bell },
  { href: '/onboard', label: 'Добавить устройство', icon: PlusCircle },
  { href: '/export', label: 'Экспорт', icon: FileDown },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

const roleLabel: Record<string, string> = {
  admin: 'Админ',
  operator: 'Оператор',
  viewer: 'Наблюдатель',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const doLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r bg-muted/30 p-4 flex flex-col">
        <div className="flex items-center justify-between gap-2 md:block">
          <div className="font-semibold text-lg whitespace-nowrap">Coldchain IoT</div>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden shrink-0 text-muted-foreground"
            onClick={doLogout}
            title="Выход"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        {user && (
          <div className="flex items-center gap-2 mt-2 py-2 border-b md:border-b-0 border-border/50 md:mb-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" title={user.email}>
                {user.email}
              </p>
              <p className="text-xs text-muted-foreground">{roleLabel[user.role] ?? user.role}</p>
            </div>
          </div>
        )}
        <nav className="flex flex-wrap md:flex-col gap-1 flex-1 md:flex-initial">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn('w-full justify-start', active && 'bg-primary/10 text-primary')}
                >
                  <Icon className="h-4 w-4 mr-2 shrink-0" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
        <Separator className="my-2 hidden md:block" />
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:flex w-full justify-start text-muted-foreground mt-auto"
          onClick={doLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Выход
        </Button>
      </aside>
      <main className="flex-1 container max-w-7xl py-6 px-4 md:px-6">
        {children}
      </main>
    </div>
  );
}
