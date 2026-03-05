'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
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

type Location = { id: string; name: string; address?: string | null };
type Zone = { id: string; name: string };

export default function LocationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [location, setLocation] = useState<Location | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [formName, setFormName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [locRes, zonesRes] = await Promise.all([
        apiGet<Location[]>('/api/v1/locations'),
        apiGet<Zone[]>(`/api/v1/locations/${id}/zones`),
      ]);
      const loc = (locRes.data ?? []).find((l) => l.id === id);
      setLocation(loc ?? null);
      setZones(zonesRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      await apiPost(`/api/v1/locations/${id}/zones`, { name: formName.trim() });
      toast.success('Зона создана');
      setCreateOpen(false);
      setFormName('');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZone || !formName.trim()) return;
    setSubmitting(true);
    try {
      await apiPatch(`/api/v1/zones/${selectedZone.id}`, { name: formName.trim() });
      toast.success('Зона обновлена');
      setEditOpen(false);
      setSelectedZone(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!selectedZone) return;
    setSubmitting(true);
    try {
      await apiDelete(`/api/v1/zones/${selectedZone.id}`);
      toast.success('Зона удалена');
      setDeleteOpen(false);
      setSelectedZone(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="space-y-4">
        <Link href="/locations"><Button variant="ghost">← Локации</Button></Link>
        <Card className="border-destructive">
          <CardContent className="pt-6"><p className="text-destructive">{error || 'Локация не найдена'}</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/locations"><Button variant="ghost" size="sm">← Локации</Button></Link>
          <h1 className="text-3xl font-semibold mt-2">{location.name}</h1>
          {location.address && <p className="text-muted-foreground">{location.address}</p>}
        </div>
        <Button onClick={() => { setFormName(''); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить зону
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Зоны</CardTitle>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <p className="text-muted-foreground py-4">Нет зон. Создайте первую.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead className="w-[120px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell className="font-medium">{z.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedZone(z); setFormName(z.name); setEditOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedZone(z); setDeleteOpen(true); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
            <DialogTitle>Новая зона</DialogTitle>
            <DialogDescription>Введите название зоны.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateZone}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="zone-name">Название</Label>
                <Input id="zone-name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={submitting}>Создать</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать зону</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditZone}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-zone-name">Название</Label>
                <Input id="edit-zone-name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={submitting}>Сохранить</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить зону?</DialogTitle>
            <DialogDescription>
              Зона «{selectedZone?.name}» будет удалена. Нельзя удалить зону, к которой привязаны устройства.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDeleteZone} disabled={submitting}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
