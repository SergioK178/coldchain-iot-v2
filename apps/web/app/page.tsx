'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, Layers, Cpu, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { useI18n } from '@/components/I18nProvider';

type Location = { id: string; name: string; address?: string | null };
type Zone = { id: string; name: string; locationId: string };
type Device = {
  serial: string;
  displayName: string | null;
  zoneName: string | null;
  locationName: string | null;
  connectivityStatus: string;
  alertStatus: string;
};

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/locations" className="block transition-opacity hover:opacity-90">
          <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard_locations')}</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{locations.length}</div>
              <span className="text-xs text-primary hover:underline">{t('dashboard_go_to')}</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/locations" className="block transition-opacity hover:opacity-90">
          <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard_zones')}</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalZones}</div>
              <span className="text-xs text-primary hover:underline">{t('dashboard_go_to')}</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/devices?status=online" className="block transition-opacity hover:opacity-90">
          <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard_devices_online')}</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onlineCount} / {devices.length}</div>
              <span className="text-xs text-primary hover:underline">{t('dashboard_go_to')}</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/alerts" className="block transition-opacity hover:opacity-90">
          <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard_alerts')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertCount}</div>
              <span className="text-xs text-primary hover:underline">{t('dashboard_go_to')}</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard_summary')}</CardTitle>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">{t('dashboard_no_locations')}</p>
              <div className="flex gap-2 flex-wrap">
                <Link href="/locations">
                  <Button size="sm">Создать локацию</Button>
                </Link>
                <Link href="/onboard">
                  <Button variant="outline" size="sm">{t('nav_add_device')}</Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {locations.filter((loc) => loc?.id).map((loc) => {
                const locDevCount = devices.filter((d) => d?.locationName === loc?.name).length;
                return (
                  <li key={loc.id} className="border rounded-lg p-4">
                    <div className="font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <Link href={`/locations/${loc.id}`} className="text-primary hover:underline">{loc.name}</Link>
                      {loc.address && <span className="text-sm font-normal text-muted-foreground">— {loc.address}</span>}
                      <span className="text-sm font-normal text-muted-foreground">({locDevCount} {t('dashboard_devices_count')})</span>
                    </div>
                    <ul className="mt-2 ml-6 space-y-2">
                      {(zonesByLoc[loc.id] ?? []).filter((zone) => zone?.id).map((zone) => {
                        const devs = devices.filter(
                          (d) => d?.zoneName && d?.locationName && d.locationName === loc?.name && d.zoneName === zone?.name
                        );
                        return (
                          <li key={zone.id}>
                            <span className="text-sm flex items-center gap-2">
                              <Layers className="h-3 w-3" />
                              {zone.name}
                              <span className="text-muted-foreground">({devs.length} {t('dashboard_devices_count')})</span>
                            </span>
                            {devs.length > 0 && (
                              <ul className="ml-4 mt-1 flex flex-wrap gap-1">
                                {devs.filter((d) => d?.serial).map((d) => (
                                  <li key={d.serial}>
                                    <Link href={`/devices/${d.serial}`}>
                                      <Badge variant={d.alertStatus === 'alert' ? 'destructive' : d.connectivityStatus === 'online' ? 'success' : 'secondary'}>
                                        {d.displayName || d.serial}
                                      </Badge>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                      {(zonesByLoc[loc.id] ?? []).length === 0 && (
                        <li className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          {t('dashboard_no_zones')}
                          <Link href={`/locations/${loc.id}`} className="text-primary hover:underline text-xs">
                            {t('dashboard_create_zone')}
                          </Link>
                          <span className="text-muted-foreground">/</span>
                          <Link href="/onboard" className="text-primary hover:underline text-xs">
                            {t('nav_add_device')}
                          </Link>
                        </li>
                      )}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
