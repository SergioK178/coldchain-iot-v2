'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';

type Device = { serial: string; displayName: string | null };
type Location = { id: string; name: string };

export default function ExportPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [deviceSerial, setDeviceSerial] = useState('');
  const [locationId, setLocationId] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, lRes] = await Promise.all([
          apiGet<Device[]>('/api/v1/devices'),
          apiGet<Location[]>('/api/v1/locations'),
        ]);
        setDevices(dRes.data ?? []);
        setLocations(lRes.data ?? []);
      } catch {
        setDevices([]);
        setLocations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!deviceSerial && !locationId) {
      toast.error('Выберите устройство или локацию');
      return;
    }
    if (!since || !until) {
      toast.error('Укажите период (с — по)');
      return;
    }
    const params = new URLSearchParams();
    if (deviceSerial) params.set('deviceSerial', deviceSerial);
    if (locationId) params.set('locationId', locationId);
    params.set('since', since);
    params.set('until', until);
    params.set('format', format);
    const path = `/api/v1/export/readings?${params.toString()}`;

    setDownloading(format);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path, method: 'GET' }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error?.message ?? 'Ошибка экспорта');
        return;
      }
      if (contentType.includes('text/csv')) {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readings_${since}_${until}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV скачан');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error?.message ?? 'Экспорт не выполнен');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Экспорт</h1>
        <Card><CardContent className="pt-6">Загрузка...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-3xl font-semibold">Экспорт показаний</h1>

      <Card>
        <CardHeader>
          <CardTitle>Период и фильтры</CardTitle>
          <CardDescription>
            Укажите устройство или локацию и период (макс. 31 день). Экспорт ограничен 5000 записей.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Устройство (необязательно, если выбрана локация)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={deviceSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
            >
              <option value="">—</option>
              {devices.map((d) => (
                <option key={d.serial} value={d.serial}>{d.serial} {d.displayName ? `(${d.displayName})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Локация (необязательно, если выбрано устройство)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>С</Label>
              <Input type="datetime-local" value={since} onChange={(e) => setSince(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>По</Label>
              <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => handleExport('csv')} disabled={!!downloading}>
              {downloading === 'csv' ? 'Скачивание...' : 'Скачать CSV'}
            </Button>
            <Button variant="outline" onClick={() => toast.info('PDF пока не реализован')} disabled={!!downloading}>
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
