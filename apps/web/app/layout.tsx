import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AppShell } from '../components/AppShell';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Colres',
  description: 'Authenticated workspace with Clerk and Convex',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
