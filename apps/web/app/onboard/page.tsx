'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';
import { QrScanner } from '@/components/QrScanner';

export default function OnboardPage() {
  const [serial, setSerial] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [result, setResult] = useState<{ mqtt?: { username: string; password: string } } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setFormError('');
    setSubmitting(true);
    try {
      const res = await apiPost<{ mqtt?: { username: string; password: string } }>(
        '/api/v1/devices/provision',
        { serial: serial.trim(), displayName: displayName.trim() || undefined, powerSource: 'battery' }
      );
      setResult(res.data);
      toast.success('Устройство добавлено');
      setSerial('');
      setDisplayName('');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const handleQrScan = (payload: { serial: string; displayName?: string; zone?: string }) => {
    setSerial(payload.serial);
    if (payload.displayName) setDisplayName(payload.displayName);
    toast.success('Данные из QR подставлены. Проверьте и нажмите «Добавить».');
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-3xl font-semibold">Добавить устройство</h1>

      <QrScanner onScan={handleQrScan} disabled={submitting} />

      <Card>
        <CardHeader>
          <CardTitle>Ручная регистрация (F8a)</CardTitle>
          <CardDescription>Введите serial устройства (например SENS-TH-00001). MQTT-пароль будет выдан один раз.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="serial">Serial *</Label>
              <Input
                id="serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="SENS-TH-00001"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="displayName">Название (необязательно)</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Холодильник №1"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">{formError}</p>
            )}
            {result?.mqtt && (
              <div className="rounded-md bg-muted p-4 text-sm">
                <p className="font-medium text-success">Устройство зарегистрировано.</p>
                <p className="mt-2">MQTT пароль (сохраните): <code className="bg-muted-foreground/10 px-1 rounded">{result.mqtt.password}</code></p>
              </div>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Добавление...' : 'Добавить'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
