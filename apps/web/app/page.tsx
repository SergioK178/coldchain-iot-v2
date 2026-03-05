'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MapPin, Layers, Cpu, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';

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
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Дашборд</h1>
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
        <h1 className="text-3xl font-semibold">Дашборд</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Проверьте авторизацию или подключение к API.</p>
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
      <h1 className="text-3xl font-semibold">Дашборд</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Локации</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
            <Link href="/locations" className="text-xs text-primary hover:underline">Перейти →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Зоны</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalZones}</div>
            <Link href="/locations" className="text-xs text-primary hover:underline">Перейти →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Устройства (онлайн)</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineCount} / {devices.length}</div>
            <Link href="/devices" className="text-xs text-primary hover:underline">Перейти →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Тревоги</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alertCount}</div>
            <Link href="/alerts" className="text-xs text-primary hover:underline">Перейти →</Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сводка: Локации → Зоны → Устройства</CardTitle>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <p className="text-muted-foreground">Нет локаций. Добавьте локации в разделе Локации.</p>
          ) : (
            <ul className="space-y-4">
              {locations.map((loc) => (
                <li key={loc.id} className="border rounded-lg p-4">
                  <div className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {loc.name}
                    {loc.address && <span className="text-sm font-normal text-muted-foreground">— {loc.address}</span>}
                  </div>
                  <ul className="mt-2 ml-6 space-y-2">
                    {(zonesByLoc[loc.id] ?? []).map((zone) => {
                      const devs = devices.filter(
                        (d) => d.zoneName && d.locationName && d.locationName === loc.name && d.zoneName === zone.name
                      );
                      return (
                        <li key={zone.id}>
                          <span className="text-sm flex items-center gap-2">
                            <Layers className="h-3 w-3" />
                            {zone.name}
                            <span className="text-muted-foreground">({devs.length} устройств)</span>
                          </span>
                          {devs.length > 0 && (
                            <ul className="ml-4 mt-1 flex flex-wrap gap-1">
                              {devs.map((d) => (
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
                      <li className="text-sm text-muted-foreground">Нет зон</li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
