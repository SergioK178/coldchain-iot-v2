'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
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
type MqttProvision = {
  username: string;
  password: string;
  topic?: string;
  statusTopic?: string;
};

type Location = { id: string; name: string };
type Zone = { id: string; locationId: string; name: string };

export default function DeviceDetailPage() {
  const params = useParams<{ serial: string }>();
  const router = useRouter();
  const serial = params?.serial ?? '';
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
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [manageLocationId, setManageLocationId] = useState('');
  const [manageZoneId, setManageZoneId] = useState('');
  const [manageSubmitting, setManageSubmitting] = useState(false);
  const [rotatedMqtt, setRotatedMqtt] = useState<MqttProvision | null>(null);
  const [ruleMetric, setRuleMetric] = useState<'temperature_c' | 'humidity_pct' | 'battery_pct'>('temperature_c');
  const [ruleOperator, setRuleOperator] = useState<'gt' | 'lt' | 'gte' | 'lte'>('gt');
  const [ruleThreshold, setRuleThreshold] = useState('');
  const [ruleCooldown, setRuleCooldown] = useState('15');
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
  const [ruleFormError, setRuleFormError] = useState('');

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} скопирован`);
    } catch {
      toast.error('Не удалось скопировать в буфер');
    }
  }

  useEffect(() => {
    if (!serial) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [devRes, readingsRes, rulesRes, calRes, locRes] = await Promise.all([
          apiGet<Device>(`/api/v1/devices/${serial}`),
          apiGet<Reading[]>(`/api/v1/devices/${serial}/readings?limit=50`),
          apiGet<AlertRule[]>(`/api/v1/devices/${serial}/alert-rules`),
          apiGet<Calibration[]>(`/api/v1/devices/${serial}/calibrations`),
          apiGet<Location[]>('/api/v1/locations'),
        ]);
        if (cancelled) return;

        const dev = devRes?.data;
        if (!dev || typeof dev !== 'object' || !dev.serial) {
          setError('Устройство не найдено');
          return;
        }
        setDevice(dev);

        const rBody = readingsRes as unknown as { data?: unknown; cursor?: string | null };
        const rRaw = rBody?.data;
        const rList = Array.isArray(rRaw) ? rRaw.filter((r): r is Reading => r != null && typeof r === 'object') : [];
        setReadings([...rList].reverse());
        setReadingsCursor(rBody?.cursor ?? null);

        const rules = rulesRes?.data;
        setAlertRules(Array.isArray(rules) ? rules : []);

        const cals = calRes?.data;
        setCalibrations(Array.isArray(cals) ? cals : []);

        const allLocations = Array.isArray(locRes?.data) ? locRes.data : [];
        setLocations(allLocations);

        let selectedLocationId = '';
        let selectedZoneId = '';
        if (dev.locationName && allLocations.length > 0) {
          const currentLocation = allLocations.find((l) => l?.name === dev.locationName);
          if (currentLocation?.id) {
            selectedLocationId = currentLocation.id;
            try {
              const zoneRes = await apiGet<Zone[]>(`/api/v1/locations/${currentLocation.id}/zones`);
              const locZones = Array.isArray(zoneRes?.data) ? zoneRes.data : [];
              setZones(locZones);
              if (dev.zoneName) {
                const currentZone = locZones.find((z) => z?.name === dev.zoneName);
                if (currentZone?.id) selectedZoneId = currentZone.id;
              }
            } catch {
              if (!cancelled) setZones([]);
            }
          }
        }
        setManageLocationId(selectedLocationId);
        setManageZoneId(selectedZoneId);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg || 'Ошибка загрузки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serial]);

  useEffect(() => {
    if (!manageLocationId) {
      setZones([]);
      setManageZoneId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const zoneRes = await apiGet<Zone[]>(`/api/v1/locations/${manageLocationId}/zones`);
        if (!cancelled) {
          setZones(zoneRes.data ?? []);
          setManageZoneId((prev) => ((zoneRes.data ?? []).some((z) => z.id === prev) ? prev : ''));
        }
      } catch {
        if (!cancelled) {
          setZones([]);
          setManageZoneId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manageLocationId]);

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
      const raw = await res.json().catch(() => ({}));
      const list = Array.isArray(raw?.data) ? raw.data.filter((r: unknown) => r != null && typeof r === 'object') : [];
      const nextCursor = raw?.cursor ?? null;
      setReadings((prev) => [...(Array.isArray(prev) ? prev : []), ...list]);
      setReadingsCursor(nextCursor);
    } finally {
      setReadingsLoadingMore(false);
    }
  };

  const chartData = (Array.isArray(readings) ? readings : [])
    .filter((r): r is Reading => r != null && typeof r === 'object')
    .slice()
    .reverse()
    .map((r) => ({
      time: (r?.timestamp && typeof r.timestamp === 'string') ? r.timestamp.slice(0, 16).replace('T', ' ') : '—',
      temp: typeof r?.temperatureC === 'number' ? r.temperatureC : 0,
      humidity: typeof r?.humidityPct === 'number' ? r.humidityPct : 0,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <Link href="/devices"><Button variant="ghost" size="sm">← Устройства</Button></Link>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-2 truncate">{device.displayName || device.serial}</h1>
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
              {calibrations.length > 0 && calibrations[0] && (
                <span> (последняя: {calibrations[0]?.calibratedAt && typeof calibrations[0].calibratedAt === 'string' ? calibrations[0].calibratedAt.slice(0, 10) : '—'})</span>
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
            <div className="h-[220px] sm:h-[300px] w-full min-w-0">
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
          <CardTitle>Управление устройством</CardTitle>
          <CardDescription>Перепривязка к локации/зоне, отвязка от зоны или деактивация устройства.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="manage-location">Локация</Label>
              <select
                id="manage-location"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={manageLocationId}
                onChange={(e) => setManageLocationId(e.target.value)}
                disabled={manageSubmitting}
              >
                <option value="">Выберите локацию</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manage-zone">Зона</Label>
              <select
                id="manage-zone"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={manageZoneId}
                onChange={(e) => setManageZoneId(e.target.value)}
                disabled={!manageLocationId || manageSubmitting}
              >
                <option value="">Выберите зону</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              disabled={!manageZoneId || manageSubmitting}
              onClick={async () => {
                if (!manageZoneId) return;
                setManageSubmitting(true);
                try {
                  const res = await apiPatch<Device>(`/api/v1/devices/${serial}`, { zoneId: manageZoneId });
                  if (res?.data) setDevice(res.data);
                  toast.success('Привязка обновлена');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Ошибка');
                } finally {
                  setManageSubmitting(false);
                }
              }}
            >
              {manageSubmitting ? 'Сохранение...' : 'Привязать к зоне'}
            </Button>
            <Button
              variant="outline"
              disabled={manageSubmitting}
              onClick={async () => {
                setManageSubmitting(true);
                try {
                  const res = await apiPatch<Device>(`/api/v1/devices/${serial}`, { zoneId: null });
                  if (res?.data) setDevice(res.data);
                  setManageLocationId('');
                  setManageZoneId('');
                  setZones([]);
                  toast.success('Устройство отвязано от зоны');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Ошибка');
                } finally {
                  setManageSubmitting(false);
                }
              }}
            >
              Отвязать
            </Button>
            <Button
              variant="outline"
              disabled={manageSubmitting}
              onClick={async () => {
                setManageSubmitting(true);
                setRotatedMqtt(null);
                try {
                  const res = await apiPost<{ mqtt?: MqttProvision }>(`/api/v1/devices/${serial}/rotate-mqtt`, {});
                  setRotatedMqtt(res?.data?.mqtt ?? null);
                  toast.success('MQTT-пароль обновлён');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Ошибка');
                } finally {
                  setManageSubmitting(false);
                }
              }}
            >
              Ротировать MQTT пароль
            </Button>
            <Button
              variant="destructive"
              disabled={manageSubmitting}
              onClick={async () => {
                if (!confirm(`Удалить (decommission) устройство ${serial}? После удаления его можно зарегистрировать заново через /onboard.`)) return;
                setManageSubmitting(true);
                try {
                  await apiDelete(`/api/v1/devices/${serial}`);
                  toast.success('Устройство удалено');
                  router.push('/devices');
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Ошибка');
                } finally {
                  setManageSubmitting(false);
                }
              }}
            >
              Удалить устройство
            </Button>
          </div>
          {rotatedMqtt && rotatedMqtt.username && rotatedMqtt.password && (
            <div className="rounded-md bg-muted p-4 text-sm space-y-2">
              <p className="font-medium text-success">Новые MQTT credentials (показываются один раз)</p>
              <p>username: <code className="bg-muted-foreground/10 px-1 rounded">{rotatedMqtt.username}</code></p>
              <p>password: <code className="bg-muted-foreground/10 px-1 rounded">{rotatedMqtt.password}</code></p>
              <p className="text-xs text-muted-foreground">
                topic: <code>{rotatedMqtt.topic ?? `d/${serial}/t`}</code>, status: <code>{rotatedMqtt.statusTopic ?? `d/${serial}/s`}</code>
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyText(rotatedMqtt.username, 'MQTT username')}>
                  Копировать username
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void copyText(rotatedMqtt.password, 'MQTT пароль')}>
                  Копировать пароль
                </Button>
              </div>
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
                setCalibrations(Array.isArray(calRes?.data) ? calRes.data : []);
                const devRes = await apiGet<Device>(`/api/v1/devices/${serial}`);
                if (devRes?.data) setDevice(devRes.data);
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
                  {calibrations.map((c, idx) => (
                    <TableRow key={c?.id ?? `cal-${idx}`}>
                      <TableCell className="text-muted-foreground">{c?.calibratedAt && typeof c.calibratedAt === 'string' ? c.calibratedAt.slice(0, 19).replace('T', ' ') : '—'}</TableCell>
                      <TableCell>{c?.referenceValueC ?? '—'}</TableCell>
                      <TableCell>{c?.deviceValueC ?? '—'}</TableCell>
                      <TableCell>{c?.offsetC ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{c?.notes ?? '—'}</TableCell>
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
          <CardDescription>
            При срабатывании правила создаётся событие тревоги и отправляются уведомления (webhook, Telegram).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setRuleFormError('');
              const th = Number.parseFloat(ruleThreshold);
              const cooldown = Number.parseInt(ruleCooldown, 10);
              if (Number.isNaN(th)) {
                setRuleFormError('Укажите порог (число)');
                return;
              }
              if (Number.isNaN(cooldown) || cooldown < 1 || cooldown > 1440) {
                setRuleFormError('Cooldown: 1–1440 мин');
                return;
              }
              setRuleSubmitting(true);
              try {
                await apiPost(`/api/v1/devices/${serial}/alert-rules`, {
                  metric: ruleMetric,
                  operator: ruleOperator,
                  threshold: th,
                  cooldownMinutes: cooldown,
                });
                toast.success('Правило добавлено');
                const res = await apiGet<AlertRule[]>(`/api/v1/devices/${serial}/alert-rules`);
                setAlertRules(Array.isArray(res?.data) ? res.data : []);
                setRuleThreshold('');
              } catch (err) {
                setRuleFormError(err instanceof Error ? err.message : 'Ошибка');
                toast.error(err instanceof Error ? err.message : 'Ошибка');
              } finally {
                setRuleSubmitting(false);
              }
            }}
            className="flex flex-wrap gap-4 items-end"
          >
            <div className="grid gap-2">
              <Label>Метрика</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={ruleMetric}
                onChange={(e) => setRuleMetric(e.target.value as 'temperature_c' | 'humidity_pct' | 'battery_pct')}
                disabled={ruleSubmitting}
              >
                {serial.toUpperCase().includes('-TH-') && <option value="humidity_pct">Влажность %</option>}
                {['TH', 'TP', 'T'].some((t) => serial.toUpperCase().includes(`-${t}-`)) && <option value="battery_pct">Батарея % (низкий заряд)</option>}
                <option value="temperature_c">Температура °C</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Условие</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={ruleOperator}
                onChange={(e) => setRuleOperator(e.target.value as 'gt' | 'lt' | 'gte' | 'lte')}
                disabled={ruleSubmitting}
              >
                <option value="gt">&gt;</option>
                <option value="gte">≥</option>
                <option value="lt">&lt;</option>
                <option value="lte">≤</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Порог</Label>
              <Input
                type="number"
                step="0.1"
                value={ruleThreshold}
                onChange={(e) => setRuleThreshold(e.target.value)}
                placeholder="-15"
                disabled={ruleSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label>Cooldown (мин)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={ruleCooldown}
                onChange={(e) => setRuleCooldown(e.target.value)}
                disabled={ruleSubmitting}
              />
            </div>
            {ruleFormError && <p className="text-sm text-destructive w-full">{ruleFormError}</p>}
            <Button type="submit" disabled={ruleSubmitting}>
              {ruleSubmitting ? 'Добавление...' : 'Добавить правило'}
            </Button>
          </form>
          {alertRules.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет правил</p>
          ) : (
            <ul className="space-y-2">
              {alertRules.map((r, idx) => (
                <li key={r?.id ?? `rule-${idx}`} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border last:border-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <Badge variant={r?.isActive ? 'default' : 'secondary'}>{r?.metric === 'temperature_c' ? 'Температура' : r?.metric === 'humidity_pct' ? 'Влажность' : r?.metric === 'battery_pct' ? 'Батарея' : r?.metric ?? '—'}</Badge>
                    <span>{r?.operator ?? ''}</span>
                    <span className="font-medium">{r?.threshold ?? '—'}</span>
                    <span className="text-muted-foreground">cooldown {r?.cooldownMinutes ?? 0} мин</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={ruleSubmitting}
                    onClick={async () => {
                      if (!r?.id || !confirm('Удалить правило?')) return;
                      setRuleSubmitting(true);
                      try {
                        await apiDelete(`/api/v1/alert-rules/${r.id}`);
                        toast.success('Правило удалено');
                        setAlertRules((prev) => prev.filter((x) => x?.id !== r.id));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Ошибка');
                      } finally {
                        setRuleSubmitting(false);
                      }
                    }}
                  >
                    Удалить
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
