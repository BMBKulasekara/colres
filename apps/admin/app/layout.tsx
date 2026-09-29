import { ClerkProvider } from '@clerk/nextjs';
import { ConvexClientProvider } from '@repo/convex/provider';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import { ThemeProvider } from '../components/shell/theme-provider';
import { themeInitScript } from '../components/shell/theme-script';
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
  title: { default: 'Colres Admin', template: '%s · Colres Admin' },
  description: 'Colres admin console',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ClerkProvider>
          <ConvexClientProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
