import type { Metadata } from 'next';
import { Source_Serif_4 } from 'next/font/google';
import localFont from 'next/font/local';
import { cookies } from 'next/headers';
import { AppShell } from '../components/AppShell';
import './globals.css';
import '@liveblocks/react-ui/styles.css';
import '@liveblocks/react-tiptap/styles.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

/**
 * The manuscript face. Used only on the document canvas, never in the chrome,
 * so the page reads like the paper it will become.
 */
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-source-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Colres',
  description: 'Authenticated workspace with Clerk and Convex',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read on the server so the sidebar renders open or collapsed from the
  // first paint, rather than flashing open and then snapping shut.
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable}`}>
        <AppShell defaultSidebarOpen={sidebarOpen}>{children}</AppShell>
      </body>
    </html>
  );
}
