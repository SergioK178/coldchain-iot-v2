import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { ShellOrPlain } from '@/components/ShellOrPlain';

export const metadata: Metadata = {
  title: 'Coldchain IoT',
  description: 'Sensor platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans antialiased">
        <Toaster position="top-right" richColors />
        <ShellOrPlain>{children}</ShellOrPlain>
      </body>
    </html>
  );
}
