"use client";

import { useGetWorkspace, useGetSession, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Users, AlertTriangle, ShieldCheck, CheckCircle2, TrendingUp, DollarSign, Bell, Clock, Cpu } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { data: session } = useGetSession();
  const { data: workspace, isLoading } = useGetWorkspace({
    query: {
      refetchInterval: 15000,
      queryKey: getGetWorkspaceQueryKey()
    }
  });

  if (isLoading || !workspace) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 bg-zinc-200 w-1/4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-zinc-200"></div>
        <div className="h-32 bg-zinc-200"></div>
        <div className="h-32 bg-zinc-200"></div>
      </div>
    </div>;
  }

  const { metrics, branches, access_events, system_events } = workspace;
  const recentEvents = access_events.slice(0, 5);
  const recentSystemEvents = system_events.slice(0, 5);

  const StatCard = ({ title, value, icon: Icon, description }: any) => (
    <Card className="rounded-none border-zinc-200 shadow-none hover-elevate">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">{title}</CardTitle>
        <Icon className="w-4 h-4 text-zinc-400" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-display font-bold">{value}</div>
        {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Dashboard</h1>
          <p className="text-zinc-500">Welcome back, {session?.user?.name}</p>
        </div>
      </div>
      
      {metrics.followups > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-bold text-sm uppercase tracking-widest">Staff Follow-up Required</div>
              <div className="text-xs">There are {metrics.followups} failed notification chains requiring manual intervention.</div>
            </div>
          </div>
          <Link href="/notifications">
            <Button variant="outline" size="sm" className="rounded-none text-xs font-bold uppercase tracking-widest bg-white">
              View Log
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Members" value={metrics.active_members} icon={Users} />
        <StatCard title="Check-ins Today" value={metrics.checkins_today} icon={Activity} />
        <StatCard title="Expiring Soon" value={metrics.expiring_week} icon={Clock} description="Within 7 days" />
        <StatCard title="Payments Today" value={metrics.payments_today} icon={DollarSign} />
      </div>

      <h2 className="text-xl font-display font-bold uppercase tracking-tight mt-8 mb-4">Branch Status</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {branches.map(branch => (
          <Card key={branch.id} className="rounded-none border-zinc-200 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="font-display uppercase">{branch.name}</CardTitle>
                  <CardDescription>{branch.type === "GATED" ? "Gated Branch" : "Reception Branch"}</CardDescription>
                </div>
                <div className="text-2xl font-display font-bold">{branch.checkins_today} <span className="text-sm font-sans font-normal text-zinc-500">visits</span></div>
              </div>
            </CardHeader>
            <CardContent>
              {branch.type === "GATED" && (
                <div className="space-y-2 mt-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Cloud Connection</span>
                    {branch.cloud_online ? (
                      <span className="flex items-center text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1"/> Online</span>
                    ) : (
                      <span className="flex items-center text-red-600 font-medium"><AlertTriangle className="w-3 h-3 mr-1"/> Offline</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Local Controller</span>
                    {branch.local_online ? (
                      <span className="flex items-center text-green-600 font-medium"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</span>
                    ) : (
                      <span className="flex items-center text-red-600 font-medium"><AlertTriangle className="w-3 h-3 mr-1"/> Inactive</span>
                    )}
                  </div>
                  {branch.last_sync && (
                    <div className="text-xs text-zinc-400 mt-2">
                      Last sync: {format(new Date(branch.last_sync), 'HH:mm:ss')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-display font-bold uppercase tracking-tight mb-4">Recent Access</h2>
          <Card className="rounded-none border-zinc-200 shadow-none">
            <div className="divide-y divide-zinc-100">
              {recentEvents.length === 0 && <div className="p-4 text-zinc-500 text-sm text-center">No recent activity</div>}
              {recentEvents.map(event => (
                <div key={event.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <div>
                    <div className="font-medium text-sm">{event.member_name}</div>
                    <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                      <span>{format(new Date(event.occurred_at), "HH:mm")}</span>
                      <span>•</span>
                      <span>Branch {event.branch_id}</span>
                      {event.offline && <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Offline</span>}
                    </div>
                  </div>
                  <div>
                    {event.decision === "ALLOWED" ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium uppercase tracking-widest">Granted</span>
                    ) : (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium uppercase tracking-widest">Denied</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-zinc-100 bg-zinc-50 text-center">
              <Link href="/checkins" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">View All Access Logs</Link>
            </div>
          </Card>
        </div>
        
        <div>
          <h2 className="text-xl font-display font-bold uppercase tracking-tight mb-4">System Events</h2>
          <Card className="rounded-none border-zinc-200 shadow-none">
            <div className="divide-y divide-zinc-100">
              {recentSystemEvents.length === 0 && <div className="p-4 text-zinc-500 text-sm text-center">No recent events</div>}
              {recentSystemEvents.map(event => (
                <div key={event.id} className="p-4 flex items-start gap-3 hover:bg-zinc-50 transition-colors">
                  <Cpu className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{event.type.replace(/_/g, ' ')}</div>
                    <div className="text-sm font-medium">{event.message}</div>
                    <div className="text-xs text-zinc-400 mt-1 font-mono">{format(new Date(event.created_at), "dd MMM yyyy HH:mm:ss")}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
