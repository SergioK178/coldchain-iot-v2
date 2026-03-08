import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { ShellOrPlain } from '@/components/ShellOrPlain';
import { I18nProvider } from '@/components/I18nProvider';

export const metadata: Metadata = {
  title: 'Coldchain IoT',
  description: 'Sensor platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <I18nProvider>
          <Toaster position="top-right" richColors />
          <ShellOrPlain>{children}</ShellOrPlain>
        </I18nProvider>
      </body>
    </html>
  );
}
