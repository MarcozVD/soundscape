import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const dm = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Soundscape',
  description: 'Music recommendations that actually match your taste',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${syne.variable} ${dm.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
