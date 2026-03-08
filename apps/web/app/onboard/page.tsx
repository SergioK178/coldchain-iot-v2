'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { QrScanner } from '@/components/QrScanner';
import { useI18n } from '@/components/I18nProvider';

const SERIAL_REGEX = /^SENS-[A-Z]{1,2}-\d{5}$/;

type Location = { id: string; name: string };
type Zone = { id: string; locationId: string; name: string };
type MqttProvision = {
  username: string;
  password: string;
  topic?: string;
  statusTopic?: string;
};

const STEPS = [
  { n: 1, label: 'Заявить' },
  { n: 2, label: 'Назначить' },
  { n: 3, label: 'Выдать' },
  { n: 4, label: 'Активировать' },
  { n: 5, label: 'Проверить' },
] as const;

export default function OnboardPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [serial, setSerial] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [powerSource, setPowerSource] = useState<'battery' | 'wired'>('battery');
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [locationId, setLocationId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [credentials, setCredentials] = useState<MqttProvision | null>(null);
  const [provisionedSerial, setProvisionedSerial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [serialError, setSerialError] = useState('');
  const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null);
  const router = useRouter();

  // Prefill from URL: /onboard?serial=SENS-TH-00001&displayName=...
  useEffect(() => {
    const s = searchParams.get('serial')?.trim();
    const n = searchParams.get('displayName')?.trim();
    if (s) setSerial(s);
    if (n) setDisplayName(n);
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<Location[]>('/api/v1/locations');
        setLocations(res.data ?? []);
      } catch {
        setLocations([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!locationId) {
      setZones([]);
      setZoneId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet<Zone[]>(`/api/v1/locations/${locationId}/zones`);
        if (!cancelled) {
          setZones(res.data ?? []);
          setZoneId('');
        }
      } catch {
        if (!cancelled) setZones([]);
      }
    })();
    return () => { cancelled = true; };
  }, [locationId]);

  // Step 5: poll device status every 5s until online
  useEffect(() => {
    if (step !== 5 || !provisionedSerial) return;
    setDeviceOnline(null);
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await apiGet<{ connectivityStatus: string }>(`/api/v1/devices/${provisionedSerial}`);
        if (!cancelled) setDeviceOnline(res.data.connectivityStatus === 'online');
      } catch {
        if (!cancelled) setDeviceOnline(false);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, provisionedSerial]);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} скопирован`);
    } catch {
      toast.error('Не удалось скопировать в буфер');
    }
  }

  const handleQrScan = (payload: { serial: string; displayName?: string }) => {
    setSerial(payload.serial);
    if (payload.displayName) setDisplayName(payload.displayName);
    toast.success('Данные из QR подставлены. Проверьте и нажмите «Далее».');
  };

  function getErrorMessage(code: string | undefined): string {
    switch (code) {
      case 'DEVICE_ALREADY_PROVISIONED':
        return 'Устройство с таким серийным номером уже зарегистрировано.';
      case 'INVALID_SERIAL_FORMAT':
        return 'Неверный формат серийного номера. Ожидается SENS-XX-NNNNN (например, SENS-TH-00001).';
      case 'UNKNOWN_DEVICE_TYPE':
        return 'Неизвестный тип устройства. Поддерживаются: TH, TP, T, HM.';
      case 'ZONE_NOT_FOUND':
        return 'Выбранная зона не найдена. Выберите другую локацию или зону.';
      default:
        return 'Ошибка регистрации. Проверьте данные и повторите.';
    }
  }

  async function handleProvision() {
    setFormError('');
    setErrorCode(null);
    setSubmitting(true);
    try {
      const res = await apiPost<{ mqtt?: MqttProvision }>(
        '/api/v1/devices/provision',
        {
          serial: serial.trim(),
          displayName: displayName.trim() || undefined,
          powerSource,
          zoneId: zoneId || undefined,
        },
      );
      setCredentials(res.data.mqtt ?? null);
      setProvisionedSerial(serial.trim());
      toast.success('Устройство зарегистрировано');
      router.refresh();
      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      const code = err instanceof ApiError ? err.code : undefined;
      setErrorCode(code ?? null);
      setFormError(getErrorMessage(code));
      toast.error(getErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setStep(1);
    setSerial('');
    setDisplayName('');
    setPowerSource('battery');
    setLocationId('');
    setZoneId('');
    setZones([]);
    setCredentials(null);
    setProvisionedSerial('');
    setDeviceOnline(null);
    setFormError('');
    setErrorCode(null);
    setSerialError('');
  }

  function goToStep2() {
    const s = serial.trim();
    setSerialError('');
    if (!s) return;
    if (!SERIAL_REGEX.test(s)) {
      setSerialError('Формат: SENS-XX-NNNNN (например, SENS-TH-00001)');
      return;
    }
    setStep(2);
  }

  const stepLabels: Record<number, string> = {
    1: t('onboard_step_claim'),
    2: t('onboard_step_assign'),
    3: t('onboard_step_issue'),
    4: t('onboard_step_activate'),
    5: t('onboard_step_verify'),
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-3xl font-semibold">{t('onboard_title')}</h1>

      {/* Step progress indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-1">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium border ${
                step === s.n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > s.n
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-muted'
              }`}
            >
              {s.n}
            </div>
            <span
              className={`text-xs hidden sm:block ${
                step === s.n ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {stepLabels[s.n]}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-4 sm:w-6 mx-1 ${step > s.n ? 'bg-primary/40' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Claim */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 1: Заявить устройство</CardTitle>
            <CardDescription>
              Введите серийный номер или отсканируйте QR-код с упаковки датчика.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <QrScanner onScan={handleQrScan} disabled={false} />
            <div className="grid gap-2">
              <Label htmlFor="serial">Серийный номер *</Label>
              <Input
                id="serial"
                value={serial}
                onChange={(e) => {
                  setSerial(e.target.value);
                  setSerialError('');
                }}
                placeholder="SENS-TH-00001"
                required
              />
              {serialError && (
                <p className="text-sm text-destructive" role="alert">{serialError}</p>
              )}
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
            <Button disabled={!serial.trim()} onClick={goToStep2}>
              Далее: Назначить локацию →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Assign location/zone */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 2: Назначить локацию и зону</CardTitle>
            <CardDescription>
              Устройство: <strong>{serial}</strong>{displayName && ` (${displayName})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="powerSource">Источник питания</Label>
              <select
                id="powerSource"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={powerSource}
                onChange={(e) => setPowerSource(e.target.value as 'battery' | 'wired')}
                disabled={submitting}
              >
                <option value="battery">Батарея</option>
                <option value="wired">Проводной</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Локация</Label>
              <select
                id="location"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={submitting}
              >
                <option value="">Без привязки (Default Zone)</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="zone">Зона</Label>
              <select
                id="zone"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                disabled={!locationId || submitting}
              >
                <option value="">Без привязки</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            {formError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm text-destructive" role="alert">{formError}</p>
                {errorCode === 'DEVICE_ALREADY_PROVISIONED' && (
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/devices/${serial.trim()}`}>Открыть карточку устройства</Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setFormError(''); setErrorCode(null); setStep(1); }}>
                      Ввести другой serial
                    </Button>
                  </div>
                )}
                {errorCode === 'ZONE_NOT_FOUND' && (
                  <Button variant="outline" size="sm" onClick={() => { setFormError(''); setErrorCode(null); setLocationId(''); setZoneId(''); }}>
                    Сбросить выбор зоны
                  </Button>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setFormError(''); setErrorCode(null); setStep(1); }}>
                ← Назад
              </Button>
              <Button onClick={handleProvision} disabled={submitting}>
                {submitting ? 'Регистрация...' : 'Зарегистрировать устройство'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Issue credentials */}
      {step === 3 && credentials && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 3: Выданные учётные данные</CardTitle>
            <CardDescription>
              MQTT-пароль показывается один раз. Скопируйте и сохраните его сейчас.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-sm space-y-2">
              <p>
                username:{' '}
                <code className="bg-muted-foreground/10 px-1 rounded">{credentials.username}</code>
              </p>
              <p>
                password:{' '}
                <code className="bg-muted-foreground/10 px-1 rounded font-mono">{credentials.password}</code>
              </p>
              <p className="text-xs text-muted-foreground">
                topic: <code>{credentials.topic ?? `d/${provisionedSerial}/t`}</code>,{' '}
                status: <code>{credentials.statusTopic ?? `d/${provisionedSerial}/s`}</code>
              </p>
              <div className="flex gap-2 flex-wrap mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(credentials.username, 'MQTT username')}
                >
                  Копировать username
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(credentials.password, 'MQTT пароль')}
                >
                  Копировать пароль
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyText(
                      JSON.stringify(
                        {
                          serial: provisionedSerial,
                          mqtt: {
                            username: credentials.username,
                            password: credentials.password,
                            topic: credentials.topic ?? `d/${provisionedSerial}/t`,
                            statusTopic: credentials.statusTopic ?? `d/${provisionedSerial}/s`,
                            url: 'mqtt://localhost:1883',
                          },
                        },
                        null,
                        2,
                      ),
                      'Provision JSON',
                    )
                  }
                >
                  Копировать JSON
                </Button>
              </div>
            </div>
            <Button onClick={() => setStep(4)}>Далее: Инструкция по настройке →</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Activate */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 4: Активировать датчик</CardTitle>
            <CardDescription>
              Настройте прошивку/конфиг датчика <strong>{provisionedSerial}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border p-4 text-sm space-y-1">
              <ol className="list-decimal ml-5 space-y-2 text-muted-foreground">
                <li>
                  Введите в конфиг датчика: <code>MQTT_URL</code>, <code>MQTT_USERNAME</code>,{' '}
                  <code>MQTT_PASSWORD</code> из предыдущего шага.
                </li>
                <li>
                  Включите датчик и убедитесь, что он подключён к той же сети, где работает MQTT-брокер.
                </li>
                <li>
                  Датчик должен публиковать телеметрию в topic и LWT-статус в status-topic.
                </li>
                <li>
                  После первого сообщения устройство появится онлайн — вы проверите это на следующем шаге.
                </li>
              </ol>
            </div>
            <Link href="/docs/hardware-provisioning" target="_blank" className="block text-sm text-primary hover:underline mb-2">
              {t('onboard_hardware_guide')} →
            </Link>
            <Button onClick={() => setStep(5)}>Далее: Проверить подключение →</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Verify */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Шаг 5: Проверить подключение</CardTitle>
            <CardDescription>
              Ожидаем первый сигнал от <strong>{provisionedSerial}</strong>.
              Статус обновляется автоматически каждые 5 секунд.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-md bg-muted p-4">
              {deviceOnline === null ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-muted-foreground animate-pulse" />
                  <span className="text-sm text-muted-foreground">Проверка статуса...</span>
                </>
              ) : deviceOnline ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Устройство онлайн — telemetry получена!
                  </span>
                </>
              ) : (
                <>
                  <div className="h-3 w-3 rounded-full bg-muted-foreground animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    Устройство ещё не подключилось. Ожидание...
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {deviceOnline && (
                <Button onClick={() => router.push(`/devices/${provisionedSerial}`)}>
                  Открыть карточку устройства
                </Button>
              )}
              <Button variant="outline" onClick={resetForm}>
                Добавить ещё одно устройство
              </Button>
              <Button variant="outline" onClick={() => router.push('/devices')}>
                К списку устройств
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Массовая регистрация: используйте provision-cli с CSV-файлом. См. руководство по установке в deploy/docs/install-guide.md.
      </p>
    </div>
  );
}
