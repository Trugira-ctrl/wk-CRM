"use client";

import { useGetAutomation, getGetAutomationQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const names = { "health-check": "Health check", "membership-expiry": "Expiry review", "daily-summary": "Daily summary" };
const schedules = { "health-check": "Every 5 minutes", "membership-expiry": "Daily at 08:00", "daily-summary": "Daily at 18:00" };
const time = (value: string) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kigali", dateStyle: "medium", timeStyle: "short",
}).format(new Date(value));

export default function AutomationsPage() {
  const { data, isLoading, isError, refetch } = useGetAutomation({ query: { queryKey: getGetAutomationQueryKey(), refetchInterval: 30000 } });
  if (isLoading) return <p role="status">Loading automation reports…</p>;
  if (isError || !data) return <div role="alert">Automation reports could not be loaded. <Button onClick={() => refetch()}>Retry</Button></div>;
  const latest = (workflow: keyof typeof names) => data.reports.find(report => report.workflow === workflow);
  const expiry = latest("membership-expiry");
  const daily = latest("daily-summary");
  const metrics = daily?.payload.metrics;

  return <div className="max-w-6xl mx-auto space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-display font-bold uppercase tracking-tight">Automations</h1>
        <p className="text-zinc-500 mt-1">Scheduled by n8n · All times in Kigali</p></div>
      <Button variant="outline" onClick={() => refetch()}>Refresh reports</Button>
    </header>
    <div className="bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
      Internal reports only. Expiry reminders are prepared for staff review; no WhatsApp, SMS or email is sent.
    </div>
    <section className="grid md:grid-cols-3 gap-4" aria-label="Latest workflow results">
      {(Object.keys(names) as (keyof typeof names)[]).map(workflow => {
        const report = latest(workflow);
        const stale = report && (workflow === "health-check"
          ? Date.now() - Date.parse(report.recorded_at) > 15 * 60000
          : report.day !== new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
        return <Card key={workflow} className="rounded-none shadow-none">
          <CardHeader><CardTitle className="text-lg">{names[workflow]}</CardTitle><p className="text-sm text-zinc-500">{schedules[workflow]}</p></CardHeader>
          <CardContent className="space-y-3">
            <p className={`text-xs font-bold uppercase tracking-wider ${stale || report?.status === "UNHEALTHY" ? "text-amber-700" : "text-zinc-700"}`}>
              {!report ? "Awaiting first run" : stale ? "Last report is old" : report.status === "DRAFT" ? "Ready for staff review" : report.status}
            </p>
            <p className="text-sm">{report?.summary ?? "No result recorded yet. Check n8n if the scheduled time has passed."}</p>
            {report && <p className="text-xs text-zinc-500">Recorded {time(report.recorded_at)}</p>}
          </CardContent>
        </Card>;
      })}
    </section>
    <Card className="rounded-none shadow-none">
      <CardHeader><CardTitle>Memberships expiring within seven days</CardTitle>
        <p className="text-sm text-zinc-500">{expiry ? `${expiry.payload.total ?? 0} members in the latest review · ${expiry.day}` : "The first scheduled review will appear here."}</p></CardHeader>
      <CardContent>
        {expiry?.payload.truncated && <p className="text-sm text-amber-700 mb-3">Showing the first 50 members. Use Members for the full list.</p>}
        {expiry && !expiry.payload.members?.length && <p className="text-sm text-zinc-500">No memberships in this review are due to expire within seven days.</p>}
        {!!expiry?.payload.members?.length && <div className="overflow-x-auto"><table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-zinc-500 border-b"><tr><th className="py-3">Member</th><th>Expiry date</th><th>Days remaining</th></tr></thead>
          <tbody>{expiry.payload.members.map(member => <tr key={member.id} className="border-b border-zinc-100">
            <td className="py-3"><Link href={`/members/${member.id}`} className="underline underline-offset-4">{member.name}</Link></td>
            <td>{member.end_date}</td><td>{member.days_remaining}</td></tr>)}</tbody>
        </table></div>}
      </CardContent>
    </Card>
    {metrics && <Card className="rounded-none shadow-none"><CardHeader><CardTitle>Latest operations snapshot</CardTitle>
      <p className="text-sm text-zinc-500">{daily.day} · {daily.payload.demo_mode ? "Illustrative demo payments" : "Operations counts"}</p></CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {([["Total members", "members_total"], ["Active members", "active_members"], ["Check-ins today", "checkins_today"], ["Pending refunds", "wallet_refunds_pending"], ["Expiring in 7 days", "expiring_members"], ["Expired memberships", "expired_members"], ["Simulated sales (RWF)", "simulated_payments_today_rwf"]] as const).map(([label, key]) => <div key={key}>
          <p className="text-xs text-zinc-500">{label}</p><p className="text-2xl font-semibold mt-1">{(metrics[key] ?? 0).toLocaleString()}</p>
        </div>)}
      </CardContent></Card>}
    <p className="text-xs text-zinc-500">This page shows recorded results, not a continuous uptime guarantee. If WAKA is unreachable, n8n may be unable to save a health report. Inspect n8n executions for failed runs.</p>
  </div>;
}
