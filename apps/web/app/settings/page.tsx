'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { toast } from 'sonner';
import { useI18n } from '@/components/I18nProvider';

type User = { id: string; email: string; name: string | null; role: string };
type Me = { id: string; email: string; telegramChatId?: string | null };
type Webhook = { id: string; url: string; events: string[]; isActive: boolean; createdAt?: string };

export default function SettingsPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [userCreateOpen, setUserCreateOpen] = useState(false);
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormName, setUserFormName] = useState('');
  const [userFormRole, setUserFormRole] = useState<'admin' | 'operator' | 'viewer'>('viewer');

  const [webhookCreateOpen, setWebhookCreateOpen] = useState(false);
  const [webhookFormUrl, setWebhookFormUrl] = useState('');
  const [webhookFormEvents, setWebhookFormEvents] = useState<string[]>(['alert.triggered']);

  const [submitting, setSubmitting] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [webhookFormError, setWebhookFormError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [uRes, wRes, meRes] = await Promise.all([
        apiGet<User[]>('/api/v1/users'),
        apiGet<Webhook[]>('/api/v1/webhooks'),
        apiGet<Me>('/api/v1/users/me').catch(() => ({ data: null as Me | null })),
      ]);
      setUsers(uRes.data ?? []);
      setWebhooks(wRes.data ?? []);
      setMe(meRes.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('settings_admin_only'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormEmail || !userFormPassword) return;
    setUserFormError('');
    setSubmitting(true);
    try {
      await apiPost('/api/v1/users', {
        email: userFormEmail,
        password: userFormPassword,
        name: userFormName || undefined,
        role: userFormRole,
      });
      toast.success(t('settings_user_created'));
      setUserCreateOpen(false);
      setUserFormEmail('');
      setUserFormPassword('');
      setUserFormName('');
      setUserFormRole('viewer');
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      setUserFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('settings_delete_user'))) return;
    setSubmitting(true);
    try {
      await apiDelete(`/api/v1/users/${userId}`);
      toast.success(t('settings_user_deleted'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookFormUrl.trim()) return;
    setWebhookFormError('');
    setSubmitting(true);
    try {
      await apiPost('/api/v1/webhooks', {
        url: webhookFormUrl.trim(),
        events: webhookFormEvents.length ? webhookFormEvents : ['alert.triggered'],
      });
      toast.success(t('settings_webhook_created'));
      setWebhookCreateOpen(false);
      setWebhookFormUrl('');
      setWebhookFormEvents(['alert.triggered']);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка';
      setWebhookFormError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm(t('settings_delete_webhook'))) return;
    setSubmitting(true);
    try {
      await apiDelete(`/api/v1/webhooks/${webhookId}`);
      toast.success(t('settings_webhook_deleted'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      await apiPost(`/api/v1/webhooks/${webhookId}/test`, {});
      toast.success('Тестовое событие отправлено');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">{t('settings_title')}</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t('settings_title')}</h1>
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-destructive">{error}</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-semibold">{t('settings_title')}</h1>
        <Link href="/settings/telegram">
          <Button
            variant="outline"
            size="sm"
            title={me?.telegramChatId ? t('settings_telegram_linked') : t('settings_telegram_link')}
          >
            {t('settings_telegram')}
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">{t('settings_users')}</TabsTrigger>
          <TabsTrigger value="webhooks">{t('settings_webhooks')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('settings_users')}</CardTitle>
              <Button onClick={() => { setUserFormError(''); setUserCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('settings_add')}
              </Button>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-muted-foreground py-4">{t('settings_no_users')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('settings_email')}</TableHead>
                      <TableHead>{t('settings_name')}</TableHead>
                      <TableHead>{t('settings_role')}</TableHead>
                      <TableHead className="w-[100px]">{t('locations_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.name ?? '—'}</TableCell>
                        <TableCell><Badge>{u.role}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(u.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('settings_webhooks')}</CardTitle>
              <Button onClick={() => { setWebhookFormError(''); setWebhookCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('settings_add')}
              </Button>
            </CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <p className="text-muted-foreground py-4">{t('settings_no_webhooks')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('settings_url')}</TableHead>
                      <TableHead>{t('settings_events')}</TableHead>
                      <TableHead>{t('settings_status')}</TableHead>
                      <TableHead className="w-[140px]">{t('locations_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono text-sm truncate max-w-[200px]">{w.url}</TableCell>
                        <TableCell className="text-sm">{w.events?.join(', ') ?? '—'}</TableCell>
                        <TableCell><Badge variant={w.isActive ? 'success' : 'secondary'}>{w.isActive ? t('settings_on') : t('settings_off')}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleTestWebhook(w.id)}><Send className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteWebhook(w.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={userCreateOpen} onOpenChange={setUserCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings_new_user')}</DialogTitle>
            <DialogDescription>{t('settings_new_user_desc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="grid gap-4 py-4">
              {userFormError && <p className="text-sm text-destructive" role="alert">{userFormError}</p>}
              <div className="grid gap-2">
                <Label>{t('settings_email')}</Label>
                <Input type="email" value={userFormEmail} onChange={(e) => setUserFormEmail(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings_password')}</Label>
                <Input type="password" value={userFormPassword} onChange={(e) => setUserFormPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings_name')}</Label>
                <Input value={userFormName} onChange={(e) => setUserFormName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings_role')}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={userFormRole}
                  onChange={(e) => setUserFormRole(e.target.value as 'admin' | 'operator' | 'viewer')}
                >
                  <option value="viewer">viewer</option>
                  <option value="operator">operator</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserCreateOpen(false)}>{t('locations_cancel')}</Button>
              <Button type="submit" disabled={submitting}>{t('locations_create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={webhookCreateOpen} onOpenChange={setWebhookCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings_new_webhook')}</DialogTitle>
            <DialogDescription>{t('settings_new_webhook_desc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWebhook}>
            <div className="grid gap-4 py-4">
              {webhookFormError && <p className="text-sm text-destructive" role="alert">{webhookFormError}</p>}
              <div className="grid gap-2">
                <Label>{t('settings_url')}</Label>
                <Input type="url" value={webhookFormUrl} onChange={(e) => setWebhookFormUrl(e.target.value)} placeholder="https://..." required />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings_events')}</Label>
                <Input
                  value={webhookFormEvents.join(', ')}
                  onChange={(e) => setWebhookFormEvents(e.target.value.split(',').map((s) => s.trim()).filter(Boolean) as string[])}
                  placeholder={t('settings_events_placeholder')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWebhookCreateOpen(false)}>{t('locations_cancel')}</Button>
              <Button type="submit" disabled={submitting}>{t('locations_create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
