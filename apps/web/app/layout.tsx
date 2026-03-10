import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { ShellOrPlain } from '@/components/ShellOrPlain';
import { I18nProvider } from '@/components/I18nProvider';

const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: 'Снежок колдчейн',
  description: 'Sensor platform',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
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
    <html lang="ru" suppressHydrationWarning className={nunito.variable}>
      <body className="min-h-screen font-sans antialiased">
        <I18nProvider>
          <Toaster position="top-right" richColors />
          <ShellOrPlain>{children}</ShellOrPlain>
        </I18nProvider>
      </body>
    </html>
  );
}
