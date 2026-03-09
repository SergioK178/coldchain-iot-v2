'use client';

import { cn } from '@/lib/utils';

export type DeviceStatus = 'ok' | 'alert' | 'offline' | 'no_data';

/** Green: online + normal. Red: alert or offline. Gray: no data / never connected. */
export function getDeviceStatus(
  connectivityStatus: string,
  alertStatus: string,
  hasData: boolean
): DeviceStatus {
  if (alertStatus === 'alert') return 'alert';
  if (connectivityStatus === 'online') return 'ok';
  return hasData ? 'offline' : 'no_data';
}

const statusConfig: Record<DeviceStatus, { dot: string; text: string; bg: string }> = {
  ok: {
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  alert: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  offline: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
  no_data: {
    dot: 'bg-muted-foreground/60',
    text: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
};

export function StatusIndicator({
  status,
  label,
  size = 'sm',
  showDot = true,
  className,
}: {
  status: DeviceStatus;
  label?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}) {
  const cfg = statusConfig[status];
  const defaultLabel = status === 'ok' ? 'Ок' : status === 'alert' ? 'Тревога' : status === 'offline' ? 'Офлайн' : 'Нет данных';
  const lbl = label ?? defaultLabel;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
        cfg.bg,
        cfg.text,
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        className
      )}
    >
      {showDot !== false && <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} aria-hidden />}
      {lbl}
    </span>
  );
}
