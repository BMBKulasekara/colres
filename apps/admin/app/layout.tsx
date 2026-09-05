import { ClerkProvider } from '@clerk/nextjs';
import { ConvexClientProvider } from '@repo/convex/provider';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AdminGuard } from '../components/AdminGuard';
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
  title: 'Admin Dashboard',
  description: 'Colres Admin Management Dashboard',
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-w-full`}>
        <ClerkProvider>
          <ConvexClientProvider>
            <AdminGuard>{children}</AdminGuard>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
