'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, Layers, Cpu, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api';
import { useI18n } from '@/components/I18nProvider';
import { StatusIndicator, getDeviceStatus } from '@/components/StatusIndicator';

type Location = { id: string; name: string; address?: string | null };
type Zone = { id: string; name: string; locationId: string };
type Device = {
  serial: string;
  displayName: string | null;
  zoneName: string | null;
  locationName: string | null;
  connectivityStatus: string;
  alertStatus: string;
  lastTemperatureC: number | null;
  lastHumidityPct: number | null;
  lastSeenAt: string | null;
};

function formatLastSeen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч`;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [locations, setLocations] = useState<Location[]>([]);
  const [zonesByLoc, setZonesByLoc] = useState<Record<string, Zone[]>>({});
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [locRes, devRes] = await Promise.all([
          apiGet<Location[]>('/api/v1/locations'),
          apiGet<Device[]>('/api/v1/devices'),
        ]);
        setLocations(locRes.data ?? []);
        setDevices(devRes.data ?? []);

        const zones: Record<string, Zone[]> = {};
        for (const loc of locRes.data ?? []) {
          const z = await apiGet<Zone[]>(`/api/v1/locations/${loc.id}/zones`);
          zones[loc.id] = z.data ?? [];
        }
        setZonesByLoc(zones);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('dashboard_error_load'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">{t('dashboard_title')}</h1>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-w-[280px]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t('dashboard_title')}</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">{t('dashboard_check_auth')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalZones = Object.values(zonesByLoc).flat().length;
  const onlineCount = devices.filter((d) => d.connectivityStatus === 'online').length;
  const alertCount = devices.filter((d) => d.alertStatus === 'alert').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-semibold">{t('dashboard_title')}</h1>

      {/* Operational grid: device cards */}
      {devices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>{t('dashboard_no_locations')}</p>
            <div className="flex gap-2 flex-wrap justify-center mt-4">
              <Link href="/locations"><Button size="sm">Создать локацию</Button></Link>
              <Link href="/onboard"><Button variant="outline" size="sm">{t('nav_add_device')}</Button></Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-w-[280px]">
          {devices.map((d) => {
            const status = getDeviceStatus(
              d.connectivityStatus,
              d.alertStatus,
              d.lastTemperatureC != null || d.lastSeenAt != null
            );
            const tempColor =
              status === 'alert' ? 'text-red-600 dark:text-red-400' :
              status === 'ok' ? 'text-green-700 dark:text-green-400' :
              'text-muted-foreground';
            return (
              <Link key={d.serial} href={`/devices/${encodeURIComponent(d.serial)}`}>
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium truncate" title={d.displayName || d.serial}>
                      {d.displayName || d.serial}
                    </CardTitle>
                    <StatusIndicator
                      status={status}
                      label={status === 'ok' ? 'Ок' : status === 'alert' ? 'Тревога' : 'Офлайн'}
                      size="sm"
                    />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-4xl sm:text-5xl font-bold tabular-nums ${tempColor}`}>
                      {d.lastTemperatureC != null ? `${d.lastTemperatureC} °C` : '—'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatLastSeen(d.lastSeenAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Summary counters — smaller, below */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 text-sm">
        <Link href="/locations" className="block">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{t('dashboard_locations')}: {locations.length}</span>
          </div>
        </Link>
        <Link href="/locations" className="block">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span>{t('dashboard_zones')}: {totalZones}</span>
          </div>
        </Link>
        <Link href="/devices?status=online" className="block">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cpu className="h-4 w-4" />
            <span>{t('dashboard_devices_online')}: {onlineCount}/{devices.length}</span>
          </div>
        </Link>
        <Link href="/alerts" className="block">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>{t('dashboard_alerts')}: {alertCount}</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
