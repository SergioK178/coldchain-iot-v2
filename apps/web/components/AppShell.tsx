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
  Languages,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from './AuthGuard';
import { useI18n } from './I18nProvider';

const navKeys = [
  { href: '/', key: 'nav_dashboard', icon: LayoutDashboard },
  { href: '/devices', key: 'nav_devices', icon: Cpu },
  { href: '/locations', key: 'nav_locations', icon: MapPin },
  { href: '/alerts', key: 'nav_alerts', icon: Bell },
  { href: '/onboard', key: 'nav_add_device', icon: PlusCircle },
  { href: '/export', key: 'nav_export', icon: FileDown },
  { href: '/settings', key: 'nav_settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const roleLabel = user?.role ? t(`role_${user.role}`) || user.role : '';

  const doLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  };

  const toggleLocale = () => {
    setLocale(locale === 'ru' ? 'en' : 'ru');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r bg-muted/30 p-4 flex flex-col">
        <div className="flex items-center justify-between gap-2 md:block">
          <div className="font-semibold text-lg whitespace-nowrap">Coldchain IoT</div>
          <div className="flex items-center gap-1 md:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={toggleLocale}
              title={locale === 'ru' ? 'English' : 'Русский'}
            >
              <span className="text-xs font-medium">{locale === 'ru' ? 'EN' : 'RU'}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={doLogout}
              title={t('nav_logout')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {user && (
          <div className="flex items-center gap-2 mt-2 py-2 border-b md:border-b-0 border-border/50 md:mb-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" title={user.email}>
                {user.email}
              </p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        )}
        <nav className="flex flex-wrap md:flex-col gap-1 flex-1 md:flex-initial">
          {navKeys.map((item) => {
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
                  {t(item.key)}
                </Button>
              </Link>
            );
          })}
        </nav>
        <Separator className="my-2 hidden md:block" />
        <div className="hidden md:flex flex-col gap-1 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={toggleLocale}
            title={locale === 'ru' ? 'Switch to English' : 'Переключить на русский'}
          >
            <Languages className="h-4 w-4 mr-2" />
            {locale === 'ru' ? 'EN' : 'RU'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={doLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('nav_logout')}
          </Button>
        </div>
      </aside>
      <main className="flex-1 container max-w-7xl py-4 sm:py-6 px-3 sm:px-4 md:px-6 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
