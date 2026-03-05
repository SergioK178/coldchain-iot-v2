'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/lib/api';

type DeviceRow = {
  serial: string;
  displayName: string | null;
  zoneName: string | null;
  locationName: string | null;
  connectivityStatus: string;
  alertStatus: string;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [filterAlert, setFilterAlert] = useState<'all' | 'yes' | 'no'>('all');
  const [filterLocation, setFilterLocation] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiGet<DeviceRow[]>('/api/v1/devices');
        setDevices(res.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить устройства');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const locations = useMemo(() => {
    const set = new Set<string>();
    devices.forEach((d) => {
      if (d.locationName) set.add(d.locationName);
    });
    return Array.from(set).sort();
  }, [devices]);

  const filtered = useMemo(() => {
    let list = devices;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.serial.toLowerCase().includes(q) ||
          (d.displayName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (filterStatus === 'online') list = list.filter((d) => d.connectivityStatus === 'online');
    else if (filterStatus === 'offline') list = list.filter((d) => d.connectivityStatus !== 'online');
    if (filterAlert === 'yes') list = list.filter((d) => d.alertStatus === 'alert');
    else if (filterAlert === 'no') list = list.filter((d) => d.alertStatus !== 'alert');
    if (filterLocation) list = list.filter((d) => d.locationName === filterLocation);
    return list;
  }, [devices, search, filterStatus, filterAlert, filterLocation]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Устройства</h1>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-destructive">{error}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Список устройств</CardTitle>
          <div className="flex flex-col gap-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по serial или названию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Статус:</span>
              <Button
                variant={filterStatus === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                Все
              </Button>
              <Button
                variant={filterStatus === 'online' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('online')}
              >
                Онлайн
              </Button>
              <Button
                variant={filterStatus === 'offline' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('offline')}
              >
                Офлайн
              </Button>
              <span className="text-sm text-muted-foreground ml-2">Тревога:</span>
              <Button
                variant={filterAlert === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterAlert('all')}
              >
                Все
              </Button>
              <Button
                variant={filterAlert === 'yes' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterAlert('yes')}
              >
                Да
              </Button>
              <Button
                variant={filterAlert === 'no' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterAlert('no')}
              >
                Нет
              </Button>
              <span className="text-sm text-muted-foreground ml-2">Локация:</span>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Все</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : devices.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Нет устройств. Добавьте устройство на странице «Добавить устройство».</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Зона</TableHead>
                    <TableHead>Локация</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Тревога</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Нет устройств по выбранным фильтрам
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => (
                      <TableRow key={d.serial}>
                        <TableCell className="font-medium">
                          <Link href={`/devices/${d.serial}`} className="text-primary hover:underline">
                            {d.serial}
                          </Link>
                        </TableCell>
                        <TableCell>{d.displayName ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{d.zoneName ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{d.locationName ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={d.connectivityStatus === 'online' ? 'success' : 'secondary'}>
                            {d.connectivityStatus === 'online' ? 'Онлайн' : 'Офлайн'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {d.alertStatus === 'alert' && <Badge variant="destructive">Тревога</Badge>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
