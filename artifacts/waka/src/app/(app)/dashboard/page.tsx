"use client";

import { useGetWorkspace, useGetSession, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import type { Workspace } from "@workspace/api-client-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Activity, Users, AlertTriangle, CheckCircle2, DollarSign, Clock, Cpu, Search, UserPlus, CreditCard, RefreshCw, UserCheck, Bell, ShieldX } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isAllowed, denialReason, getNotificationRuns, isFollowUp, notificationMetrics, kigaliToday, addDays } from "@/lib/waka-ops";

function StatCard({ title, value, icon: Icon, description, tone }: { title: string; value: React.ReactNode; icon: React.ElementType; description?: string; tone?: "red" }) {
  return (
    <Card className="rounded-none border-zinc-200 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{title}</CardTitle>
        <Icon className="w-4 h-4 text-zinc-400" />
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-display font-bold ${tone === "red" ? "text-red-700" : ""}`}>{value}</div>
        {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-display font-bold uppercase tracking-tight mb-4">{children}</h2>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-4 text-zinc-500 text-sm text-center">{children}</div>;
}

function FollowUpBanner({ ws }: { ws: Workspace }) {
  const nm = notificationMetrics(ws);
  if (nm.followups <= 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 text-red-800">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div>
          <div className="font-bold text-sm uppercase tracking-widest">Staff follow-up required</div>
          <div className="text-xs">
            {nm.failedChains} failed notification {nm.failedChains === 1 ? "chain" : "chains"} ({nm.failedAttempts} failed simulated delivery attempts).
          </div>
        </div>
      </div>
      <Link href="/notifications">
        <Button variant="outline" size="sm" className="rounded-none text-xs font-bold uppercase tracking-widest bg-white">View runs</Button>
      </Link>
    </div>
  );
}

function RecentAccess({ ws, deniedOnly }: { ws: Workspace; deniedOnly?: boolean }) {
  const events = ws.access_events.filter(e => !deniedOnly || !isAllowed(e.decision)).slice(0, 6);
  return (
    <Card className="rounded-none border-zinc-200 shadow-none">
      <div className="divide-y divide-zinc-100">
        {events.length === 0 && <Empty>{deniedOnly ? "No denied access recorded" : "No recent activity"}</Empty>}
        {events.map(event => (
          <div key={event.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{event.member_name}</div>
              <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                <span>{format(new Date(event.occurred_at), "dd MMM HH:mm")}</span>
                <span>Branch {event.branch_id}</span>
                <span className="uppercase text-[10px] tracking-widest">{event.method.replace(/_/g, " ")}</span>
                {event.offline && <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-widest">Offline sim</span>}
              </div>
              {!isAllowed(event.decision) && <div className="text-[11px] text-red-700 mt-1">{denialReason(event.reason)}</div>}
            </div>
            {isAllowed(event.decision) ? (
              <span className="bg-green-100 text-green-800 px-2 py-1 text-xs font-medium uppercase tracking-widest">Allowed</span>
            ) : (
              <span className="bg-red-100 text-red-800 px-2 py-1 text-xs font-medium uppercase tracking-widest">Denied</span>
            )}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-zinc-100 bg-zinc-50 text-center">
        <Link href="/checkins" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">View access log</Link>
      </div>
    </Card>
  );
}

function ReceptionDashboard({ ws, name }: { ws: Workspace; name?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const today = kigaliToday();
  const soon = addDays(today, 7);
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? ws.members.filter(m => m.full_name.toLowerCase().includes(needle) || m.phone.includes(needle) || m.email.toLowerCase().includes(needle)).slice(0, 6)
    : [];
  const renewals = ws.members
    .filter(m => m.status === "EXPIRED" || (!!m.end_date && m.end_date >= today && m.end_date <= soon))
    .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? "")).slice(0, 6);
  const noCard = ws.members.filter(m => m.status === "ACTIVE" && !m.credentials.some(c => c.status === "ACTIVE" && c.type === "CARD")).slice(0, 6);
  const followRuns = getNotificationRuns(ws).filter(r => !r.uncertain && isFollowUp(r.final_status)).slice(0, 5);

  const actions = [
    { label: "Register member", href: "/members?register=1", icon: UserPlus },
    { label: "Reception check-in", href: "/checkins", icon: UserCheck },
    { label: "Members and cards", href: "/members", icon: CreditCard },
    { label: "Follow-up tasks", href: "/notifications", icon: Bell },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Front Desk</h1>
        <p className="text-zinc-500">{name} &middot; Check-ins today: {ws.metrics.checkins_today}</p>
      </div>

      <Card className="rounded-none border-zinc-900 border-2 shadow-none">
        <div className="p-4 flex items-center gap-3">
          <Search className="w-5 h-5 text-zinc-500" />
          <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Find member by name, phone or email"
            className="border-none shadow-none focus-visible:ring-0 px-0 text-lg h-auto" />
        </div>
        {needle && (
          <div className="border-t border-zinc-200 divide-y divide-zinc-100">
            {matches.length === 0 && <Empty>No member matches. <Link href="/members?register=1" className="underline font-medium">Register new member</Link></Empty>}
            {matches.map(m => (
              <button key={m.id} onClick={() => router.push(`/members/${m.id}`)} className="w-full text-left p-3 flex justify-between items-center hover:bg-zinc-50">
                <div>
                  <div className="font-medium">{m.full_name}</div>
                  <div className="text-xs text-zinc-500">{m.phone} &middot; {m.plan_id == null ? "No membership" : `${m.plan_name} - ends ${m.end_date ?? "n/a"}`}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${m.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{m.status}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map(a => (
          <Link key={a.href} href={a.href} className="border border-zinc-200 bg-white p-4 flex items-center gap-3 hover:border-zinc-900 transition-colors">
            <a.icon className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">{a.label}</span>
          </Link>
        ))}
      </div>

      <FollowUpBanner ws={ws} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <SectionTitle>Renewals due</SectionTitle>
          <Card className="rounded-none border-zinc-200 shadow-none divide-y divide-zinc-100">
            {renewals.length === 0 && <Empty>No renewals due in 7 days</Empty>}
            {renewals.map(m => (
              <Link key={m.id} href={`/members/${m.id}`} className="p-3 flex justify-between items-center hover:bg-zinc-50">
                <div>
                  <div className="text-sm font-medium">{m.full_name}</div>
                  <div className="text-xs text-zinc-500">{m.end_date ? `Ends ${m.end_date}` : "No membership"}</div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Renew</span>
              </Link>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle>Active, no card</SectionTitle>
          <Card className="rounded-none border-zinc-200 shadow-none divide-y divide-zinc-100">
            {noCard.length === 0 && <Empty>Every active member has a card</Empty>}
            {noCard.map(m => (
              <Link key={m.id} href={`/members/${m.id}`} className="p-3 flex justify-between items-center hover:bg-zinc-50">
                <div className="text-sm font-medium">{m.full_name}</div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Assign card</span>
              </Link>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle>Follow-up tasks</SectionTitle>
          <Card className="rounded-none border-zinc-200 shadow-none divide-y divide-zinc-100">
            {followRuns.length === 0 && <Empty>No staff follow-ups open</Empty>}
            {followRuns.map(r => (
              <Link key={r.id} href={`/members/${r.member_id}`} className="p-3 block hover:bg-zinc-50">
                <div className="text-sm font-medium">{r.member_name}</div>
                <div className="text-xs text-zinc-500 font-mono">Run {r.id.slice(0, 8)} &middot; {format(new Date(r.started_at), "dd MMM HH:mm")}</div>
              </Link>
            ))}
          </Card>
        </div>
      </div>

      <div>
        <SectionTitle>Recent check-ins</SectionTitle>
        <RecentAccess ws={ws} />
      </div>
    </div>
  );
}

function ManagementDashboard({ ws, name }: { ws: Workspace; name?: string }) {
  const { metrics, branches, system_events } = ws;
  const nm = notificationMetrics(ws);
  const today = kigaliToday();
  const todaysPayments = ws.payments.filter(p => p.created_at.slice(0, 10) === today);
  const revenueToday = todaysPayments.reduce((s, p) => s + p.amount, 0);
  const deniedToday = ws.access_events.filter(e => !isAllowed(e.decision) && e.occurred_at.slice(0, 10) === today).length;
  const soon = addDays(today, 7);
  const expiring = ws.members.filter(m => !!m.end_date && m.end_date >= today && m.end_date <= soon).sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? "")).slice(0, 6);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Operations Overview</h1>
        <p className="text-zinc-500">{name} &middot; All three branches</p>
      </div>

      <FollowUpBanner ws={ws} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active members" value={metrics.active_members} icon={Users} description={`${metrics.expired_members} expired`} />
        <StatCard title="Check-ins today" value={metrics.checkins_today} icon={Activity} description={`${deniedToday} denied today`} />
        <StatCard title="Expiring in 7 days" value={metrics.expiring_week} icon={Clock} />
        <StatCard title="Payments today" value={metrics.payments_today} icon={DollarSign} description={`RWF ${revenueToday.toLocaleString()} simulated`} />
        <StatCard title="Failed notification chains" value={nm.failedChains} icon={Bell} tone={nm.failedChains ? "red" : undefined} description="Runs ending in staff follow-up" />
        <StatCard title="Failed delivery attempts" value={nm.failedAttempts} icon={AlertTriangle} description="Individual simulated attempts" />
      </div>

      <div>
        <SectionTitle>Branch activity</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {branches.map(branch => (
            <Card key={branch.id} className="rounded-none border-zinc-200 shadow-none">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-display uppercase">{branch.name}</CardTitle>
                    <CardDescription>{branch.type === "GATED" ? "Simulated speedgate" : "Reception check-in"}</CardDescription>
                  </div>
                  <div className="text-2xl font-display font-bold">{branch.checkins_today} <span className="text-sm font-sans font-normal text-zinc-500">today</span></div>
                </div>
              </CardHeader>
              <CardContent>
                {branch.type === "GATED" && (
                  <div className="space-y-2 mt-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-500">Cloud link (sim)</span>
                      {branch.cloud_online ? <span className="flex items-center text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Online</span> : <span className="flex items-center text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Offline</span>}
                    </div>
                    <div className="flex justify-between"><span className="text-zinc-500">Local controller (sim)</span>
                      {branch.local_online ? <span className="flex items-center text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Active</span> : <span className="flex items-center text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Inactive</span>}
                    </div>
                    {branch.last_sync && <div className="text-xs text-zinc-400">Last sync {format(new Date(branch.last_sync), "HH:mm:ss")}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <SectionTitle><span className="flex items-center gap-2"><ShieldX className="w-5 h-5" />Denied access</span></SectionTitle>
          <RecentAccess ws={ws} deniedOnly />
        </div>
        <div>
          <SectionTitle>Upcoming renewals</SectionTitle>
          <Card className="rounded-none border-zinc-200 shadow-none divide-y divide-zinc-100">
            {expiring.length === 0 && <Empty>No memberships expire in 7 days</Empty>}
            {expiring.map(m => (
              <Link key={m.id} href={`/members/${m.id}`} className="p-3 flex justify-between hover:bg-zinc-50">
                <span className="text-sm font-medium">{m.full_name}</span>
                <span className="text-xs text-zinc-500">{m.plan_name} &middot; {m.end_date}</span>
              </Link>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle>Recent payments (simulated)</SectionTitle>
          <Card className="rounded-none border-zinc-200 shadow-none divide-y divide-zinc-100">
            {ws.payments.length === 0 && <Empty>No payments</Empty>}
            {ws.payments.slice(0, 6).map(p => (
              <div key={p.id} className="p-3 flex justify-between text-sm">
                <span>{p.member_name}</span>
                <span className="font-mono text-xs">{p.currency} {p.amount.toLocaleString()} &middot; {format(new Date(p.created_at), "dd MMM HH:mm")}</span>
              </div>
            ))}
            <div className="p-2 bg-zinc-50 text-center"><Link href="/payments" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">All payments</Link></div>
          </Card>
        </div>
        <div>
          <SectionTitle>System events</SectionTitle>
          <Card className="rounded-none border-zinc-200 shadow-none divide-y divide-zinc-100">
            {system_events.length === 0 && <Empty>No recent events</Empty>}
            {system_events.slice(0, 6).map(event => (
              <div key={event.id} className="p-3 flex items-start gap-3">
                <Cpu className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{event.type.replace(/_/g, " ")}</div>
                  <div className="text-sm">{event.message}</div>
                  <div className="text-xs text-zinc-400 font-mono">{format(new Date(event.created_at), "dd MMM HH:mm:ss")}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useGetSession();
  const { data: workspace, isLoading } = useGetWorkspace({
    query: { refetchInterval: 15000, queryKey: getGetWorkspaceQueryKey() }
  });

  if (isLoading || !workspace) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-zinc-200 w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-zinc-200" /><div className="h-32 bg-zinc-200" /><div className="h-32 bg-zinc-200" />
        </div>
      </div>
    );
  }

  const role = session?.user?.role;
  return role === "RECEPTION"
    ? <ReceptionDashboard ws={workspace} name={session?.user?.name} />
    : <ManagementDashboard ws={workspace} name={session?.user?.name} />;
}
