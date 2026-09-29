import { cookies } from 'next/headers';
import { AdminGuard } from '../../components/guard/admin-guard';
import { AdminShell } from '../../components/shell/admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The sidebar writes its collapsed state to this cookie; reading it here
  // renders the right width on the server, so there's no flash on load.
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <AdminGuard>
      <AdminShell defaultSidebarOpen={sidebarOpen}>{children}</AdminShell>
    </AdminGuard>
  );
}
