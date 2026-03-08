import { readFile } from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default async function HardwareProvisioningPage() {
  let content = '';
  try {
    const filePath = path.join(process.cwd(), '..', '..', 'deploy', 'docs', 'hardware-provisioning.md');
    content = await readFile(filePath, 'utf-8');
  } catch {
    content = 'Документ не найден. См. deploy/docs/hardware-provisioning.md в репозитории.';
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/onboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-3xl font-semibold">Инструкция по настройке оборудования</h1>
      </div>
      <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-6 rounded-lg overflow-x-auto font-sans">
        {content}
      </pre>
    </div>
  );
}
