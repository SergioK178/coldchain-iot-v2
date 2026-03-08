'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { toast } from 'sonner';
import { useI18n } from '@/components/I18nProvider';

type Location = { id: string; name: string; address?: string | null };
type Device = { serial: string; locationName: string | null };

export default function LocationsPage() {
  const { t } = useI18n();
  const [locations, setLocations] = useState<Location[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Location | null>(null);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [locRes, devRes] = await Promise.all([
        apiGet<Location[]>('/api/v1/locations'),
        apiGet<Device[]>('/api/v1/devices'),
      ]);
      setLocations(locRes.data ?? []);
      setDevices(devRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard_error_load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      await apiPost('/api/v1/locations', { name: formName.trim(), address: formAddress.trim() || undefined });
      toast.success(t('locations_created'));
      setCreateOpen(false);
      setFormName('');
      setFormAddress('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !formName.trim()) return;
    setSubmitting(true);
    try {
      await apiPatch(`/api/v1/locations/${selected.id}`, { name: formName.trim(), address: formAddress.trim() || undefined });
      toast.success(t('locations_updated'));
      setEditOpen(false);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await apiDelete(`/api/v1/locations/${selected.id}`);
      toast.success(t('locations_deleted'));
      setDeleteOpen(false);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (loc: Location) => {
    setSelected(loc);
    setFormName(loc.name);
    setFormAddress(loc.address ?? '');
    setEditOpen(true);
  };

  const openDelete = (loc: Location) => {
    setSelected(loc);
    setDeleteOpen(true);
  };

  const deviceCountByLoc = locations.reduce<Record<string, number>>((acc, loc) => {
    acc[loc.name] = devices.filter((d) => d.locationName === loc.name).length;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">{t('locations_title')}</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{t('locations_title')}</h1>
        <Button onClick={() => { setFormName(''); setFormAddress(''); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('locations_add')}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-destructive">{error}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('locations_list')}</CardTitle>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <p className="text-muted-foreground py-4">{t('locations_no_locations')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('locations_name')}</TableHead>
                  <TableHead>{t('locations_address')}</TableHead>
                  <TableHead>{t('locations_devices_col')}</TableHead>
                  <TableHead className="w-[120px]">{t('locations_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell>
                      <Link href={`/locations/${loc.id}`} className="font-medium text-primary hover:underline">
                        {loc.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{loc.address || t('locations_not_specified')}</TableCell>
                    <TableCell>{deviceCountByLoc[loc.name] ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openDelete(loc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('locations_new')}</DialogTitle>
            <DialogDescription>{t('locations_new_desc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="create-name">{t('locations_name')}</Label>
                <Input id="create-name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-address">{t('locations_address')}</Label>
                <Input id="create-address" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t('locations_cancel')}</Button>
              <Button type="submit" disabled={submitting}>{t('locations_create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('locations_edit')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{t('locations_name')}</Label>
                <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-address">{t('locations_address')}</Label>
                <Input id="edit-address" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>{t('locations_cancel')}</Button>
              <Button type="submit" disabled={submitting}>{t('locations_save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('locations_delete')}</DialogTitle>
            <DialogDescription>
              {t('locations_delete_desc', { name: selected?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>{t('locations_cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{t('locations_delete_btn')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
