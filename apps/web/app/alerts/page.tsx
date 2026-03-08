'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { useI18n } from '@/components/I18nProvider';
import { MessageCircle } from 'lucide-react';

type Me = { id: string; email: string; telegramChatId?: string | null };
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
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [me, setMe] = useState<Me | null>(null);
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

  const loadMe = async () => {
    try {
      const res = await apiGet<Me>('/api/v1/users/me');
      setMe(res.data ?? null);
    } catch {
      setMe(null);
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
      setError(e instanceof Error ? e.message : t('alerts_error_load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    loadMe();
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [filterDevice, filterAck, filterSince]);

  const handleAcknowledge = async (eventId: string) => {
    setAckIng(eventId);
    try {
      await apiPatch(`/api/v1/alert-events/${eventId}/acknowledge`, { acknowledgedBy: 'operator' });
      toast.success(t('alerts_event_acknowledged'));
      loadAlerts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common_error'));
    } finally {
      setAckIng(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-semibold">{t('alerts_title')}</h1>
        <Link href="/settings/telegram">
          <Button
            variant="outline"
            size="sm"
            title={me?.telegramChatId ? t('settings_telegram_linked') : t('settings_telegram_link')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {t('settings_telegram')}
            {me?.telegramChatId && <Badge variant="secondary" className="ml-2">✓</Badge>}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('alerts_filters')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>{t('alerts_device')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
              >
                <option value="">{t('devices_all')}</option>
                {devices.map((d) => (
                  <option key={d.serial} value={d.serial}>{d.displayName || d.serial}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>{t('alerts_acknowledged')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filterAck}
                onChange={(e) => setFilterAck(e.target.value as 'all' | 'yes' | 'no')}
              >
                <option value="all">{t('devices_all')}</option>
                <option value="yes">{t('devices_yes')}</option>
                <option value="no">{t('devices_no')}</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>{t('alerts_since_date')}</Label>
              <Input
                type="datetime-local"
                value={filterSince}
                onChange={(e) => setFilterSince(e.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => { setFilterDevice(''); setFilterAck('all'); setFilterSince(''); }}>
            {t('alerts_reset_filters')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('alerts_events')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : alerts.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {filterAck === 'yes' ? t('alerts_all_confirmed') : t('alerts_system_ok')}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <Table className="min-w-[640px] sm:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('alerts_device')}</TableHead>
                  <TableHead>{t('alerts_metric')}</TableHead>
                  <TableHead>{t('alerts_value_threshold')}</TableHead>
                  <TableHead>{t('alerts_time')}</TableHead>
                  <TableHead>{t('alerts_acknowledged')}</TableHead>
                  <TableHead className="w-[120px]">{t('alerts_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a, idx) => (
                  <TableRow key={a?.id ?? `alert-${idx}`}>
                    <TableCell className="font-medium">
                      <Link href={`/devices/${a?.deviceSerial ?? ''}`} className="text-primary hover:underline">
                        {a?.deviceName || a?.deviceSerial || '—'}
                      </Link>
                    </TableCell>
                    <TableCell>{a?.metric ?? '—'}</TableCell>
                    <TableCell>{a?.readingValue ?? '—'} ({a?.operator ?? ''} {a?.thresholdValue ?? '—'})</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a?.triggeredAt && typeof a.triggeredAt === 'string' ? a.triggeredAt.replace('T', ' ').slice(0, 19) : '—'}</TableCell>
                    <TableCell>
                      {a?.acknowledgedAt ? (
                        <Badge variant="secondary">{a?.acknowledgedBy ?? t('devices_yes')}</Badge>
                      ) : (
                        <Badge variant="destructive">{t('devices_no')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!a?.acknowledgedAt && a?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ackIng === a.id}
                          onClick={() => handleAcknowledge(a.id)}
                        >
                          {ackIng === a.id ? '...' : t('alerts_acknowledge')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
