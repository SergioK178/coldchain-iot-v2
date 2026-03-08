'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DeviceDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Link href="/devices">
        <Button variant="ghost">← Устройства</Button>
      </Link>
      <Card className="border-destructive">
        <CardContent className="pt-6 space-y-4">
          <p className="text-destructive font-medium">Не удалось загрузить устройство</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button onClick={reset} variant="outline">
            Повторить
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
