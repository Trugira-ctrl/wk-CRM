"use client";

import { useGetWorkspace, useRunAction, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, AlertCircle, MessageSquare, Mail, Phone, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getNotificationRuns, isFollowUp, isUncertain, notificationMetrics, simulatedChannel } from "@/lib/waka-ops";

export default function NotificationsPage() {
  const { data: workspace, refetch } = useGetWorkspace({
    query: { refetchInterval: 15000, queryKey: getGetWorkspaceQueryKey() }
  });
  const runAction = useRunAction();
  const { toast } = useToast();

  if (!workspace) return <div className="animate-pulse h-64 bg-zinc-200" />;

  const runs = getNotificationRuns(workspace);
  const nm = notificationMetrics(workspace);

  const runReminders = (allFail: boolean) => {
    runAction.mutate({ data: { action: "run_reminders", all_fail: allFail } }, {
      onSuccess: () => {
        toast({ title: "Simulated reminder run recorded", description: "No real messages were sent." });
        refetch();
      },
      onError: (err: any) => toast({ title: "Run failed", description: err.message, variant: "destructive" }),
    });
  };

  const getIcon = (channel: string) => {
    const c = channel.toUpperCase();
    if (c.includes("WHATSAPP")) return <MessageSquare className="w-4 h-4 text-zinc-600" />;
    if (c.includes("SMS")) return <Phone className="w-4 h-4 text-zinc-600" />;
    if (c.includes("EMAIL")) return <Mail className="w-4 h-4 text-zinc-600" />;
    return <Bell className="w-4 h-4 text-zinc-600" />;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Notifications</h1>
        <p className="text-zinc-500">Simulated renewal reminders. WhatsApp, SMS and email are simulated; no messages leave the system. Access decisions never depend on this workflow.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Runs logged" value={runs.length} />
        <Stat label="Failed chains (follow-up)" value={nm.failedChains} tone="red" />
        <Stat label="Failed attempts" value={nm.failedAttempts} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[false, true].map(allFail => (
          <Card key={String(allFail)} className="rounded-none border-zinc-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {allFail ? "Scenario 2: All channels fail" : "Scenario 1: Fallback recovery"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-600">
                {allFail
                  ? "Simulated WhatsApp fails, retry fails, SMS fails, email fails. Final result: staff follow-up required."
                  : "Simulated WhatsApp fails, retry fails, then simulated SMS is delivered. Final result: contacted."}
              </p>
              <Button variant={allFail ? "destructive" : "default"} className="w-full rounded-none font-bold uppercase tracking-widest"
                onClick={() => runReminders(allFail)} disabled={runAction.isPending}>
                {runAction.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Run simulated {allFail ? "all-fail" : "fallback"} scenario
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-none border-zinc-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Runs (newest first)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {runs.length === 0 && <div className="text-center py-8 text-zinc-500">No reminder runs logged yet.</div>}
          {runs.map(run => {
            const followUp = isFollowUp(run.final_status);
            const uncertain = isUncertain(run);
            return (
              <div key={run.id} className={`border p-4 ${uncertain ? "border-amber-300 bg-amber-50/40" : followUp ? "border-red-200 bg-red-50/40" : "border-zinc-200 bg-zinc-50/50"}`}>
                <div className="flex flex-wrap justify-between gap-3 mb-3">
                  <div>
                    <div className="font-display font-bold uppercase text-lg">{run.member_name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      Run {run.id.slice(0, 8)} &middot; started {format(new Date(run.started_at), "dd MMM yyyy HH:mm:ss")}
                      {run.legacy && <span className="ml-2 uppercase tracking-widest text-amber-700">Legacy grouping</span>}
                    </div>
                  </div>
                  {uncertain ? (
                    <span className="flex items-center text-amber-800 font-bold text-xs uppercase tracking-widest"><AlertCircle className="w-4 h-4 mr-1" /> Unknown legacy outcome</span>
                  ) : followUp ? (
                    <span className="flex items-center text-red-700 font-bold text-xs uppercase tracking-widest"><AlertCircle className="w-4 h-4 mr-1" /> Staff follow-up required</span>
                  ) : run.final_status === "CONTACTED" ? (
                    <span className="flex items-center text-green-700 font-bold text-xs uppercase tracking-widest"><CheckCircle2 className="w-4 h-4 mr-1" /> Contacted</span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">{run.final_status}</span>
                  )}
                </div>
                {uncertain && (
                  <p className="text-xs text-amber-900 mb-3">These attempts were logged before runs were tracked and cannot be reliably grouped, so the final outcome is unknown. They are not counted as a staff follow-up.</p>
                )}
                <ol className="space-y-1.5">
                  {run.attempts.map((n, i) => (
                    <li key={n.id} className="flex items-center gap-3 bg-white border border-zinc-200 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-zinc-400 w-5">{i + 1}.</span>
                      {getIcon(n.channel)}
                      <span className="font-medium flex-1">{simulatedChannel(n.channel)}</span>
                      <span className="text-[10px] font-mono text-zinc-400">{format(new Date(n.created_at), "HH:mm:ss")}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${n.status === "DELIVERED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{n.status}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" }) {
  return (
    <Card className="rounded-none border-zinc-200 shadow-none p-4">
      <div className={`text-2xl font-display font-bold ${tone === "red" && value > 0 ? "text-red-700" : ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{label}</div>
    </Card>
  );
}
