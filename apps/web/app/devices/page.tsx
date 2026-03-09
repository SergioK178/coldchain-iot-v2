'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { StatusIndicator, getDeviceStatus } from '@/components/StatusIndicator';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/lib/api';
import { useI18n } from '@/components/I18nProvider';

type DeviceRow = {
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

export default function DevicesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status');
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>(
    statusParam === 'online' ? 'online' : statusParam === 'offline' ? 'offline' : 'all'
  );
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
        setError(e instanceof Error ? e.message : t('devices_error_load'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

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
      <h1 className="text-2xl sm:text-3xl font-semibold">{t('devices_title')}</h1>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-destructive">{error}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('devices_list')}</CardTitle>
          <div className="flex flex-col gap-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('devices_search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">{t('devices_status')}</span>
              <Button
                variant={filterStatus === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                {t('devices_all')}
              </Button>
              <Button
                variant={filterStatus === 'online' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('online')}
              >
                {t('devices_online')}
              </Button>
              <Button
                variant={filterStatus === 'offline' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus('offline')}
              >
                {t('devices_offline')}
              </Button>
              <span className="text-sm text-muted-foreground ml-2">{t('devices_alert')}</span>
              <Button
                variant={filterAlert === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterAlert('all')}
              >
                {t('devices_all')}
              </Button>
              <Button
                variant={filterAlert === 'yes' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterAlert('yes')}
              >
                {t('devices_yes')}
              </Button>
              <Button
                variant={filterAlert === 'no' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterAlert('no')}
              >
                {t('devices_no')}
              </Button>
              <span className="text-sm text-muted-foreground ml-2">{t('devices_location')}</span>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t('devices_all')}</option>
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
            <p className="text-muted-foreground py-8 text-center">{t('devices_no_devices')}</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <Table className="min-w-[720px] sm:min-w-0">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('devices_serial')}</TableHead>
                    <TableHead>{t('devices_name')}</TableHead>
                    <TableHead>Последнее значение</TableHead>
                    <TableHead>{t('devices_zone')}</TableHead>
                    <TableHead>{t('devices_location_col')}</TableHead>
                    <TableHead>{t('devices_status_col')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {t('devices_no_filtered')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => {
                      const status = getDeviceStatus(
                        d.connectivityStatus,
                        d.alertStatus,
                        d.lastTemperatureC != null || d.lastSeenAt != null
                      );
                      return (
                        <TableRow
                          key={d.serial}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/devices/${d.serial}`)}
                        >
                          <TableCell className="font-medium">
                            <Link href={`/devices/${d.serial}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                              {d.serial}
                            </Link>
                          </TableCell>
                          <TableCell>{d.displayName ?? '—'}</TableCell>
                          <TableCell className="font-semibold tabular-nums">
                            {d.lastTemperatureC != null ? `${d.lastTemperatureC} °C` : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{d.zoneName ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{d.locationName ?? '—'}</TableCell>
                          <TableCell>
                            <StatusIndicator
                              status={status}
                              label={status === 'ok' ? t('devices_online') : status === 'alert' ? t('devices_alert_badge') : t('devices_offline')}
                              size="sm"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
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
