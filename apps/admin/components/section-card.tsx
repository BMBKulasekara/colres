'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  IconAlertCircle,
  IconBuilding,
  IconFileDescription,
  IconLoader2,
  IconShieldCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

interface Stats {
  users: number;
  organizations: number;
  documents: number;
}

export function SectionCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {/* Users Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            <IconUsers size={16} className="text-primary" />
            Total Users
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? (
              <IconLoader2 className="animate-spin size-6 text-muted-foreground" />
            ) : error ? (
              <span className="text-red-500 text-lg">Error</span>
            ) : (
              stats?.users
            )}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Users Sync</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
          <div>Registered users in Clerk & database</div>
        </CardFooter>
      </Card>

      {/* Organizations Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            <IconBuilding size={16} className="text-primary" />
            Organizations
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? (
              <IconLoader2 className="animate-spin size-6 text-muted-foreground" />
            ) : error ? (
              <span className="text-red-500 text-lg">Error</span>
            ) : (
              stats?.organizations
            )}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Orgs Sync</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
          <div>Shared collaboration teamspaces</div>
        </CardFooter>
      </Card>

      {/* Documents Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            <IconFileDescription size={16} className="text-primary" />
            Total Documents
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? (
              <IconLoader2 className="animate-spin size-6 text-muted-foreground" />
            ) : error ? (
              <span className="text-red-500 text-lg">Error</span>
            ) : (
              stats?.documents
            )}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Live docs</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
          <div>Active and draft editor workspaces</div>
        </CardFooter>
      </Card>

      {/* System Status Card */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-medium">
            {error ? (
              <IconAlertCircle size={16} className="text-red-500" />
            ) : (
              <IconShieldCheck size={16} className="text-emerald-500" />
            )}
            Convex Database
          </CardDescription>
          <CardTitle className="text-xl font-semibold @[250px]/card:text-2xl">
            {loading ? (
              <IconLoader2 className="animate-spin size-6 text-muted-foreground" />
            ) : error ? (
              <span className="text-red-500">Disconnected</span>
            ) : (
              <span className="text-emerald-500">Connected</span>
            )}
          </CardTitle>
          <CardAction>
            <Badge
              variant="outline"
              className={
                error ? 'text-red-500 border-red-500/30' : 'text-emerald-500 border-emerald-500/30'
              }
            >
              {error ? 'Offline' : 'Online'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
          <div>Admin dashboard telemetry status</div>
        </CardFooter>
      </Card>
    </div>
  );
}
