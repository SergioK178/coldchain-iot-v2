'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

type Me = { id: string; email: string; telegramChatId?: string | null };

export default function SettingsTelegramPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadMe = async () => {
    try {
      const res = await apiGet<Me>('/api/v1/users/me');
      setMe(res.data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  const handleGenerateCode = async () => {
    setSubmitting(true);
    setCode(null);
    setExpiresIn(null);
    try {
      const res = await apiPost<{ code: string; expiresIn: number }>('/api/v1/users/me/telegram-code', {});
      setCode(res.data.code);
      setExpiresIn(res.data.expiresIn);
      toast.success('Код создан. Отправьте его боту в Telegram.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Отвязать Telegram?')) return;
    setSubmitting(true);
    try {
      await apiPatch('/api/v1/users/me/telegram', { telegramChatId: null });
      toast.success('Telegram отвязан');
      loadMe();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Telegram</h1>
        <Card><CardContent className="pt-6">Загрузка...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-3xl font-semibold">Telegram</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Уведомления о тревогах</CardTitle>
          <CardDescription>
            Привяжите Telegram, чтобы получать сообщения о срабатывании алертов. Сгенерируйте одноразовый код и отправьте его боту.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {me?.telegramChatId ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Telegram привязан.</p>
              <Button variant="outline" onClick={handleUnlink} disabled={submitting}>
                Отвязать
              </Button>
            </div>
          ) : (
            <>
              <Button onClick={handleGenerateCode} disabled={submitting}>
                {submitting ? 'Генерация...' : 'Сгенерировать код'}
              </Button>
              {code && (
                <div className="rounded-md bg-muted p-4 space-y-2">
                  <p className="font-mono text-2xl tracking-widest">{code}</p>
                  <p className="text-sm text-muted-foreground">
                    Отправьте этот код боту в Telegram. Код действителен {expiresIn != null ? Math.round(expiresIn / 60) : 5} мин.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Если бот не добавлен — найдите его по имени (указан в инструкции развёртывания) или /start в Telegram.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
