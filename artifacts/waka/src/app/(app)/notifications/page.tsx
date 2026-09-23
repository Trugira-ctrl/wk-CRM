"use client";

import { useGetWorkspace, useRunAction, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, AlertCircle, MessageSquare, Mail, Phone, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function NotificationsPage() {
  const { data: workspace, refetch } = useGetWorkspace({
    query: { refetchInterval: 15000, queryKey: getGetWorkspaceQueryKey() }
  });
  const runAction = useRunAction();
  const { toast } = useToast();

  if (!workspace) return null;

  const runReminders = (allFail: boolean) => {
    runAction.mutate({
      data: {
        action: "run_reminders",
        all_fail: allFail
      }
    }, {
      onSuccess: () => {
        toast({ title: "Reminders triggered", description: "Simulated reminder workflow executed." });
        refetch();
      }
    });
  };

  const getIcon = (channel: string) => {
    if (channel.includes('WhatsApp')) return <MessageSquare className="w-4 h-4 text-green-500" />;
    if (channel.includes('SMS')) return <Phone className="w-4 h-4 text-blue-500" />;
    if (channel.includes('Email')) return <Mail className="w-4 h-4 text-zinc-500" />;
    return <Bell className="w-4 h-4 text-zinc-500" />;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Notifications</h1>
        <p className="text-zinc-500">Automated reminder simulation and delivery log</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Scenario 1: Fallback Recovery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-600">
              Simulates a typical workflow where WhatsApp fails, retries, and successfully falls back to SMS.
            </p>
            <Button 
              className="w-full rounded-none font-bold uppercase tracking-widest"
              onClick={() => runReminders(false)}
              disabled={runAction.isPending}
            >
              {runAction.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Trigger Fallback Scenario
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Scenario 2: All Channels Fail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-600">
              Simulates a workflow where all automated channels fail and staff follow-up is required.
            </p>
            <Button 
              variant="destructive"
              className="w-full rounded-none font-bold uppercase tracking-widest"
              onClick={() => runReminders(true)}
              disabled={runAction.isPending}
            >
              {runAction.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Trigger All-Fail Scenario
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-zinc-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Delivery Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {workspace.notifications.length === 0 && (
              <div className="text-center py-8 text-zinc-500">No notifications logged</div>
            )}
            
            {/* Group by member and roughly time (simulation groups them) */}
            {workspace.notifications.map((notif, i) => (
              <div key={notif.id} className="border border-zinc-200 p-4 relative bg-zinc-50/50">
                <div className="absolute top-0 right-0 p-3">
                  {notif.final_status === 'CONTACTED' ? (
                    <span className="flex items-center text-green-600 font-bold text-xs uppercase tracking-widest">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Contacted
                    </span>
                  ) : (
                    <span className="flex items-center text-red-600 font-bold text-xs uppercase tracking-widest">
                      <AlertCircle className="w-4 h-4 mr-1" /> Staff Follow-up Required
                    </span>
                  )}
                </div>
                
                <div className="mb-4">
                  <div className="font-display font-bold uppercase text-lg">{notif.member_name}</div>
                  <div className="text-xs text-zinc-500">Renewal Reminder Flow</div>
                </div>

                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-zinc-200">
                  {/* Since our API creates a single summary record with the attempt details encoded in channel/status for the POC, we'll parse it or just display it as a block. The API schema says: channel, status, attempt, final_status. The simulator creates multiple rows per flow. We should just list them chronologically. */}
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-zinc-300 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400"></div>
                    </div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 border border-zinc-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          {getIcon(notif.channel)}
                          {notif.channel}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {format(new Date(notif.created_at), "HH:mm:ss")}
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-zinc-500">Attempt {notif.attempt}</div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          notif.status === 'DELIVERED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {notif.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
