'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from './AppShell';
import { AuthGuard } from './AuthGuard';

export function ShellOrPlain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>;
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
