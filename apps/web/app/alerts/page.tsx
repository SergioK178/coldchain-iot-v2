'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiPatch } from '@/lib/api';
import { toast } from 'sonner';

type AlertEvent = {
  id: string;
  deviceSerial: string;
  deviceName: string | null;
  metric: string;
  operator: string;
  readingValue: number;
  thresholdValue: number;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

type Device = { serial: string; displayName: string | null };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [filterAck, setFilterAck] = useState<'all' | 'yes' | 'no'>('all');
  const [filterSince, setFilterSince] = useState('');
  const [ackIng, setAckIng] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      const res = await apiGet<Device[]>('/api/v1/devices');
      setDevices(res.data ?? []);
    } catch {
      setDevices([]);
    }
  };

  const loadAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filterDevice) params.set('deviceSerial', filterDevice);
      if (filterAck === 'yes') params.set('acknowledged', 'true');
      if (filterAck === 'no') params.set('acknowledged', 'false');
      if (filterSince) params.set('since', filterSince);
      const res = await apiGet<AlertEvent[]>(`/api/v1/alert-events?${params.toString()}`);
      setAlerts(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [filterDevice, filterAck, filterSince]);

  const handleAcknowledge = async (eventId: string) => {
    setAckIng(eventId);
    try {
      await apiPatch(`/api/v1/alert-events/${eventId}/acknowledge`, { acknowledgedBy: 'operator' });
      toast.success('Событие подтверждено');
      loadAlerts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setAckIng(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Оповещения</h1>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Устройство</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
              >
                <option value="">Все</option>
                {devices.map((d) => (
                  <option key={d.serial} value={d.serial}>{d.displayName || d.serial}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Подтверждено</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filterAck}
                onChange={(e) => setFilterAck(e.target.value as 'all' | 'yes' | 'no')}
              >
                <option value="all">Все</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>С (дата ISO)</Label>
              <Input
                type="datetime-local"
                value={filterSince}
                onChange={(e) => setFilterSince(e.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => { setFilterDevice(''); setFilterAck('all'); setFilterSince(''); }}>
            Сбросить фильтры
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>События</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : alerts.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Нет событий по выбранным фильтрам</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Устройство</TableHead>
                  <TableHead>Метрика</TableHead>
                  <TableHead>Значение / порог</TableHead>
                  <TableHead>Время</TableHead>
                  <TableHead>Подтверждено</TableHead>
                  <TableHead className="w-[120px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.deviceName || a.deviceSerial}</TableCell>
                    <TableCell>{a.metric}</TableCell>
                    <TableCell>{a.readingValue} ({a.operator} {a.thresholdValue})</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.triggeredAt.replace('T', ' ').slice(0, 19)}</TableCell>
                    <TableCell>
                      {a.acknowledgedAt ? (
                        <Badge variant="secondary">{a.acknowledgedBy ?? 'Да'}</Badge>
                      ) : (
                        <Badge variant="destructive">Нет</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!a.acknowledgedAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ackIng === a.id}
                          onClick={() => handleAcknowledge(a.id)}
                        >
                          {ackIng === a.id ? '...' : 'Подтвердить'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
