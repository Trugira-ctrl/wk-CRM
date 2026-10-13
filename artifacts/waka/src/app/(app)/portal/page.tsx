"use client";

import { fmtDate } from "@/lib/waka-ops";
import { renewalKey, completeRenewal } from "@/lib/renewal-key";

import { useGetWorkspace, useRunAction } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, CreditCard, Activity, CalendarClock, QrCode } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function MemberPortalPage() {
  const { data: workspace, refetch } = useGetWorkspace();
  const runAction = useRunAction();
  const { toast } = useToast();
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewalPlanId, setRenewalPlanId] = useState<string>("");

  if (!workspace || workspace.user.role !== "MEMBER") {
    // Note: in a real app we might redirect or show unauthorized if not member
    // But for demo, the layout handles some of this, and we can just show a message.
  }

  // A member sees their own scoped data via workspace.members[0] (the backend handles scoping)
  const member = workspace?.members[0];
  const access_events = workspace?.access_events || [];
  const payments = workspace?.payments || [];

  if (!member) return <div className="p-8 text-center text-zinc-500">Loading profile...</div>;

  const handleRenew = () => {
    if (!renewalPlanId) return;
    runAction.mutate({
      data: {
        action: "renew_membership",
        member_id: member.id,
        plan_id: Number(renewalPlanId),
        idempotency_key: renewalKey(member.id, Number(renewalPlanId))
      }
    }, {
      onSuccess: (result) => {
        if (!result.ok) {
          toast({ title: "Renewal not completed", description: result.message, variant: "destructive" });
          return;
        }
        completeRenewal(member.id, Number(renewalPlanId));
        toast({ title: "SIMULATED PAYMENT SUCCESSFUL", description: "Your membership has been renewed." });
        setIsRenewOpen(false);
        refetch();
      }
    });
  };

  const openRenew = () => {
    setRenewalPlanId(member.plan_id != null ? member.plan_id.toString() : "");
    setIsRenewOpen(true);
  };

  const memberPlanDetails = workspace.plans.find(p => p.id === member.plan_id);
  const preferredBranch = workspace.branches.find(b => b.id === member.branch_id);
  const selectedRenewalPlan = workspace.plans.find(p => p.id.toString() === renewalPlanId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">My Portal</h1>
        <p className="text-zinc-500 mt-1">Manage your WAKA membership</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Membership Status</CardTitle>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest ${
                member.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                member.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                'bg-zinc-100 text-zinc-800'
              }`}>
                {member.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-3xl font-display font-bold">{member.plan_id == null ? "No membership" : member.plan_name}</div>
              <div className="text-sm text-zinc-500 mt-2 space-y-1">
                <div>Member since: {fmtDate(member.start_date)}</div>
                <div>Valid until: <span className="font-bold text-zinc-900">{fmtDate(member.end_date)}</span></div>
                {preferredBranch && <div>Preferred Location: {preferredBranch.name}</div>}
              </div>
            </div>
            
            <div className="pt-4 border-t border-zinc-100">
              <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
                <Button className="w-full rounded-none font-bold uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 text-white" onClick={openRenew}>
                  <Zap className="w-4 h-4 mr-2" /> Renew Membership
                </Button>
                <DialogContent className="rounded-none border-zinc-200">
                  <DialogHeader>
                    <DialogTitle className="font-display uppercase text-xl">Confirm Renewal</DialogTitle>
                  </DialogHeader>
                  <div className="py-6 space-y-6">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">Select Plan</label>
                      <Select value={renewalPlanId} onValueChange={setRenewalPlanId}>
                        <SelectTrigger className="rounded-none">
                          <SelectValue placeholder="Choose a plan..." />
                        </SelectTrigger>
                        <SelectContent>
                          {workspace.plans.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedRenewalPlan && (
                      <div className="bg-zinc-50 border border-zinc-200 p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-zinc-500">Duration</span>
                          <span className="font-medium">{selectedRenewalPlan.duration_days} Days</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-500">Amount Due</span>
                          <span className="font-mono text-lg font-bold">{selectedRenewalPlan.price.toLocaleString()} RWF</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="p-4 border border-zinc-200 bg-zinc-50 text-center">
                      <div className="font-bold uppercase tracking-widest text-sm mb-1">Simulated Payment Provider</div>
                      <div className="text-xs text-zinc-500">Completing this will add time to the membership and generate a fake payment record.</div>
                    </div>
                    
                    <Button onClick={handleRenew} className="w-full rounded-none font-bold uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800" disabled={runAction.isPending || !renewalPlanId}>
                      Pay & Renew
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">My Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            {member.credentials.filter(c => c.status === 'ACTIVE').length > 0 ? (
              <div className="space-y-3">
                {member.credentials.filter(c => c.status === 'ACTIVE').map(cred => (
                  <div key={cred.id} className="flex items-center gap-3 p-3 border border-zinc-200 bg-zinc-50">
                    {cred.type === 'CARD' ? <CreditCard className="w-5 h-5 text-zinc-400" /> : <QrCode className="w-5 h-5 text-zinc-400" />}
                    <div>
                      <div className="font-mono text-sm">{cred.identifier}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{cred.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 text-sm">
                No active credentials. Please visit reception to get a card.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Recent Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {access_events.length === 0 && <div className="text-sm text-zinc-500">No recent visits</div>}
              {access_events.slice(0, 5).map(event => (
                <div key={event.id} className="flex justify-between items-center border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-zinc-400" />
                    <div>
                      <div className="text-sm font-medium">Branch {event.branch_id}</div>
                      <div className="text-xs text-zinc-500">{format(new Date(event.occurred_at), "dd MMM yyyy, HH:mm")}</div>
                    </div>
                  </div>
                  {event.decision === "ALLOWED" ? (
                    <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Granted</span>
                  ) : (
                    <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Denied</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.length === 0 && <div className="text-sm text-zinc-500">No recent payments</div>}
              {payments.map(payment => (
                <div key={payment.id} className="flex justify-between items-center border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-medium font-mono">{payment.amount.toLocaleString()} {payment.currency}</div>
                    <div className="text-xs text-zinc-500">{format(new Date(payment.created_at), "dd MMM yyyy")}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-100 text-zinc-800 px-2 py-1 rounded">
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
