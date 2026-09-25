"use client";

import { useGetWorkspace, useRunAction, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Activity, ShieldCheck, CheckCircle2, AlertTriangle, UserCheck, CreditCard, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isAllowed, denialReason } from "@/lib/waka-ops";

export default function CheckinsPage() {
  const { data: workspace, refetch } = useGetWorkspace({
    query: { refetchInterval: 15000, queryKey: getGetWorkspaceQueryKey() }
  });
  const runAction = useRunAction();
  const { toast } = useToast();

  const [selectedBranch, setSelectedBranch] = useState<string>("2");
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [selectedCredential, setSelectedCredential] = useState<string>("");

  if (!workspace) return null;

  const handleCheckin = (method: "MANUAL_RECEPTION" | "RECEPTION_CARD" | "RECEPTION_QR") => {
    let payload: any = {
      action: "checkin",
      branch_id: Number(selectedBranch),
      method
    };

    if (method === "MANUAL_RECEPTION") {
      if (!selectedMember) {
        toast({ title: "Select a member", variant: "destructive" });
        return;
      }
      payload.member_id = Number(selectedMember);
    } else {
      if (!selectedCredential) {
        toast({ title: "Select a credential", variant: "destructive" });
        return;
      }
      payload.identifier = selectedCredential;
      payload.credential_type = method === "RECEPTION_CARD" ? "CARD" : "QR";
    }
    
    runAction.mutate({ data: payload }, {
      onSuccess: (res) => {
        const event = res.event;
        if (event && isAllowed(event.decision)) {
          toast({ title: "Check-in allowed", description: event.member_name });
        } else {
          toast({ title: "Check-in Denied", description: denialReason(event?.reason), variant: "destructive" });
        }
        setSelectedMember("");
        setSelectedCredential("");
        refetch();
      }
    });
  };

  const allCredentials = workspace.members.flatMap(m => 
    m.credentials.map(c => ({
      uid: c.identifier,
      memberName: m.full_name,
      status: c.status,
      type: c.type
    }))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Access Log</h1>
        <p className="text-zinc-500">Centralized check-in history & reception management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-zinc-200 shadow-none col-span-1 md:col-span-1 bg-zinc-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Reception Check-in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Location</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="rounded-none bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">Branch 2 (Reception)</SelectItem>
                  <SelectItem value="3">Branch 3 (Reception)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4 border-t border-zinc-200 pt-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-600">Manual Check-in</div>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="rounded-none bg-white">
                  <SelectValue placeholder="Select member..." />
                </SelectTrigger>
                <SelectContent>
                  {workspace.members.map(m => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.full_name} ({m.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                className="w-full rounded-none font-bold uppercase tracking-widest"
                onClick={() => handleCheckin("MANUAL_RECEPTION")}
                disabled={!selectedMember || runAction.isPending}
              >
                Manual Check-in
              </Button>
            </div>

            <div className="space-y-4 border-t border-zinc-200 pt-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-600">Credential Scan</div>
              <Select value={selectedCredential} onValueChange={setSelectedCredential}>
                <SelectTrigger className="rounded-none bg-white">
                  <SelectValue placeholder="Select card or QR..." />
                </SelectTrigger>
                <SelectContent>
                  {allCredentials.map((c, i) => (
                    <SelectItem key={i} value={c.uid}>
                      {c.type}: {c.uid} - {c.memberName} ({c.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline"
                  className="w-full rounded-none font-bold uppercase tracking-widest text-[10px]"
                  onClick={() => handleCheckin("RECEPTION_CARD")}
                  disabled={!selectedCredential || runAction.isPending}
                >
                  <CreditCard className="w-3 h-3 mr-1" />
                  Card
                </Button>
                <Button 
                  variant="outline"
                  className="w-full rounded-none font-bold uppercase tracking-widest text-[10px]"
                  onClick={() => handleCheckin("RECEPTION_QR")}
                  disabled={!selectedCredential || runAction.isPending}
                >
                  <QrCode className="w-3 h-3 mr-1" />
                  QR
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-zinc-200 shadow-none col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Global Check-in History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 text-zinc-500 font-medium uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Location & Method</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {workspace.access_events.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No events logged</td></tr>
                  )}
                  {workspace.access_events.map(event => (
                    <tr key={event.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 font-mono text-xs">
                        {format(new Date(event.occurred_at), "dd MMM HH:mm:ss")}
                      </td>
                      <td className="px-4 py-3 font-medium">{event.member_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs">Branch {event.branch_id}</span>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                            {event.method.replace('_', ' ')}
                            {event.offline && <span className="ml-2 text-yellow-600">(Offline)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isAllowed(event.decision) ? (
                          <div className="flex items-center text-green-600 text-xs font-bold uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Allowed
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center text-red-600 text-xs font-bold uppercase tracking-widest">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Denied
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">{denialReason(event.reason)}</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
