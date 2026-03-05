'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from 'sonner';

type Device = {
  serial: string;
  displayName: string | null;
  zoneName: string | null;
  locationName: string | null;
  lastTemperatureC: number | null;
  lastHumidityPct: number | null;
  lastBatteryPct: number | null;
  connectivityStatus: string;
  alertStatus: string;
  calibrationOffsetC?: number;
};

type Reading = {
  timestamp: string;
  temperatureC: number | null;
  humidityPct: number | null;
  batteryPct?: number | null;
};

type AlertRule = {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  isActive: boolean;
  cooldownMinutes: number;
};

type Calibration = {
  id: string;
  calibratedAt: string | null;
  referenceValueC: number;
  deviceValueC: number;
  offsetC: number;
  notes: string | null;
  calibratedBy: string | null;
};

export default function DeviceDetailPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const [serial, setSerial] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [readingsCursor, setReadingsCursor] = useState<string | null>(null);
  const [readingsLoadingMore, setReadingsLoadingMore] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calRef, setCalRef] = useState('');
  const [calDev, setCalDev] = useState('');
  const [calNotes, setCalNotes] = useState('');
  const [calSubmitting, setCalSubmitting] = useState(false);
  const [calFormError, setCalFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      setSerial(p.serial);
    });
    return () => { cancelled = true; };
  }, [params]);

  useEffect(() => {
    if (!serial) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [devRes, readingsRes, rulesRes, calRes] = await Promise.all([
          apiGet<Device>(`/api/v1/devices/${serial}`),
          apiGet<Reading[]>(`/api/v1/devices/${serial}/readings?limit=50`),
          apiGet<AlertRule[]>(`/api/v1/devices/${serial}/alert-rules`),
          apiGet<Calibration[]>(`/api/v1/devices/${serial}/calibrations`),
        ]);
        if (cancelled) return;
        setDevice(devRes.data);
        const rBody = readingsRes as unknown as { data: Reading[]; cursor?: string | null };
        const rList = Array.isArray(rBody.data) ? rBody.data : [];
        setReadings(rList.reverse());
        setReadingsCursor(rBody.cursor ?? null);
        setAlertRules(rulesRes.data ?? []);
        setCalibrations(calRes.data ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serial]);

  if (loading || !serial) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="space-y-4">
        <Link href="/devices"><Button variant="ghost">← Устройства</Button></Link>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error || 'Устройство не найдено'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loadMoreReadings = async () => {
    if (!readingsCursor || !serial) return;
    setReadingsLoadingMore(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          path: `/api/v1/devices/${serial}/readings?limit=50&cursor=${encodeURIComponent(readingsCursor)}`,
          method: 'GET',
        }),
      });
      const raw = await res.json();
      const list = Array.isArray(raw?.data) ? raw.data : [];
      const nextCursor = raw?.cursor ?? null;
      setReadings((prev) => [...prev, ...list]);
      setReadingsCursor(nextCursor);
    } finally {
      setReadingsLoadingMore(false);
    }
  };

  const chartData = [...readings].reverse().map((r) => ({
    time: r.timestamp.slice(0, 16).replace('T', ' '),
    temp: r.temperatureC ?? 0,
    humidity: r.humidityPct ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link href="/devices"><Button variant="ghost" size="sm">← Устройства</Button></Link>
          <h1 className="text-3xl font-semibold mt-2">{device.displayName || device.serial}</h1>
          <p className="text-muted-foreground text-sm">Serial: {device.serial}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={device.connectivityStatus === 'online' ? 'success' : 'secondary'}>
            {device.connectivityStatus === 'online' ? 'Онлайн' : 'Офлайн'}
          </Badge>
          {device.alertStatus === 'alert' && <Badge variant="destructive">Тревога</Badge>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Температура</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{device.lastTemperatureC != null ? `${device.lastTemperatureC} °C` : '—'}</div>
            <p className="text-xs text-muted-foreground">Локация: {device.locationName ?? '—'}, Зона: {device.zoneName ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Влажность</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{device.lastHumidityPct != null ? `${device.lastHumidityPct} %` : '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Батарея</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{device.lastBatteryPct != null ? `${device.lastBatteryPct} %` : '—'}</div>
            <p className="text-xs text-muted-foreground">
              Смещение калибровки: {device.calibrationOffsetC ?? 0} °C
              {calibrations.length > 0 && (
                <span> (последняя: {calibrations[0].calibratedAt?.slice(0, 10) ?? '—'})</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>График показаний</CardTitle>
          {readingsCursor && (
            <Button variant="outline" size="sm" onClick={loadMoreReadings} disabled={readingsLoadingMore}>
              {readingsLoadingMore ? 'Загрузка...' : 'Загрузить ещё'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Нет данных за период</p>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="temp" name="Температура °C" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="humidity" name="Влажность %" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Калибровки</CardTitle>
          <CardDescription>
            Текущее смещение: {device.calibrationOffsetC ?? 0} °C. Оператор/админ может добавить запись калибровки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCalFormError('');
              const ref = Number.parseFloat(calRef);
              const dev = Number.parseFloat(calDev);
              if (Number.isNaN(ref) || Number.isNaN(dev)) {
                setCalFormError('Укажите эталон и показание устройства (числа)');
                return;
              }
              setCalSubmitting(true);
              try {
                await apiPost(`/api/v1/devices/${serial}/calibrations`, {
                  referenceValueC: ref,
                  deviceValueC: dev,
                  notes: calNotes.trim() || undefined,
                });
                toast.success('Калибровка записана');
                setCalRef('');
                setCalDev('');
                setCalNotes('');
                const calRes = await apiGet<Calibration[]>(`/api/v1/devices/${serial}/calibrations`);
                setCalibrations(calRes.data ?? []);
                const devRes = await apiGet<Device>(`/api/v1/devices/${serial}`);
                setDevice(devRes.data);
              } catch (err) {
                setCalFormError(err instanceof Error ? err.message : 'Ошибка');
                toast.error(err instanceof Error ? err.message : 'Ошибка');
              } finally {
                setCalSubmitting(false);
              }
            }}
            className="flex flex-wrap gap-4 items-end"
          >
            <div className="grid gap-2">
              <Label>Эталон °C</Label>
              <Input type="number" step="0.1" value={calRef} onChange={(e) => setCalRef(e.target.value)} placeholder="25.0" required />
            </div>
            <div className="grid gap-2">
              <Label>Показание устройства °C</Label>
              <Input type="number" step="0.1" value={calDev} onChange={(e) => setCalDev(e.target.value)} placeholder="24.8" required />
            </div>
            <div className="grid gap-2 flex-1 min-w-[120px]">
              <Label>Заметки</Label>
              <Input value={calNotes} onChange={(e) => setCalNotes(e.target.value)} placeholder="Необязательно" />
            </div>
            {calFormError && <p className="text-sm text-destructive w-full">{calFormError}</p>}
            <Button type="submit" disabled={calSubmitting}>{calSubmitting ? 'Сохранение...' : 'Записать калибровку'}</Button>
          </form>
          {calibrations.length === 0 ? (
            <p className="text-muted-foreground text-sm">История калибровок пуста</p>
          ) : (
            <div className="overflow-auto max-h-[240px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Эталон °C</TableHead>
                    <TableHead>Устройство °C</TableHead>
                    <TableHead>Смещение °C</TableHead>
                    <TableHead>Заметки</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calibrations.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground">{c.calibratedAt?.slice(0, 19).replace('T', ' ') ?? '—'}</TableCell>
                      <TableCell>{c.referenceValueC}</TableCell>
                      <TableCell>{c.deviceValueC}</TableCell>
                      <TableCell>{c.offsetC}</TableCell>
                      <TableCell className="text-muted-foreground">{c.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Правила оповещений</CardTitle>
        </CardHeader>
        <CardContent>
          {alertRules.length === 0 ? (
            <p className="text-muted-foreground">Нет правил. Добавить правило можно через API (operator/admin).</p>
          ) : (
            <ul className="space-y-2">
              {alertRules.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <Badge variant={r.isActive ? 'default' : 'secondary'}>{r.metric}</Badge>
                  <span>{r.operator}</span>
                  <span className="font-medium">{r.threshold}</span>
                  <span className="text-muted-foreground">cooldown {r.cooldownMinutes} мин</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
