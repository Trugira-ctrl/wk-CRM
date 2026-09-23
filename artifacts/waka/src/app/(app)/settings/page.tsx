"use client";

import { useGetWorkspace, useRunAction } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Edit2, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SettingsPage() {
  const { data: workspace, refetch } = useGetWorkspace();
  const runAction = useRunAction();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");

  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planDuration, setPlanDuration] = useState("");
  const [planDescription, setPlanDescription] = useState("");

  if (!workspace || workspace.user.role !== "ADMIN") return null;

  const handleReset = () => {
    if (confirmText !== "RESET") {
      toast({ title: "Type RESET to confirm", variant: "destructive" });
      return;
    }
    
    runAction.mutate({
      data: {
        action: "reset_demo",
        confirmation: "RESET"
      }
    }, {
      onSuccess: () => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('waka_offline_state_')) {
            localStorage.removeItem(key);
          }
        }
        setConfirmText("");
        toast({ title: "Demo environment reset successful" });
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Reset failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const openPlanEdit = (p: any) => {
    setEditingPlan(p);
    setPlanName(p.name);
    setPlanPrice(p.price.toString());
    setPlanDuration(p.duration_days.toString());
    setPlanDescription(p.description);
  };

  const savePlan = () => {
    if (!editingPlan) return;
    runAction.mutate({
      data: {
        action: "update_plan",
        plan: {
          id: editingPlan.id,
          name: planName,
          price: Number(planPrice),
          duration_days: Number(planDuration),
          description: planDescription
        }
      }
    }, {
      onSuccess: () => {
        toast({ title: "Plan updated successfully" });
        setEditingPlan(null);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Failed to update plan", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Settings</h1>
        <p className="text-zinc-500">Administration & Demo Management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Membership Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workspace.plans.map(p => (
                <div key={p.id} className="p-3 border border-zinc-200 bg-zinc-50 relative group">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 h-7 w-7 p-0 rounded-none opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => openPlanEdit(p)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <div className="flex justify-between items-start mb-1 pr-8">
                    <div className="font-bold">{p.name}</div>
                    <div className="font-mono text-sm">{p.price.toLocaleString()} RWF</div>
                  </div>
                  <div className="text-xs text-zinc-500">{p.duration_days} days • {p.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-red-200 shadow-none bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-600 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-red-800">
              Reset the demo environment. This will clear all events, payments, and non-seed members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-red-800 mb-1 block">Type RESET to confirm</label>
              <input 
                type="text" 
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                className="w-full border-red-200 focus:border-red-500 focus:ring-red-500 rounded-none h-10 px-3 text-sm"
                placeholder="RESET"
              />
            </div>
            <Button 
              variant="destructive" 
              className="w-full rounded-none font-bold uppercase tracking-widest"
              onClick={handleReset}
              disabled={confirmText !== "RESET" || runAction.isPending}
            >
              Reset Demo Environment
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display uppercase">Edit Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Name</label>
              <Input value={planName} onChange={e => setPlanName(e.target.value)} className="rounded-none mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Price (RWF)</label>
                <Input type="number" value={planPrice} onChange={e => setPlanPrice(e.target.value)} className="rounded-none mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Duration (Days)</label>
                <Input type="number" value={planDuration} onChange={e => setPlanDuration(e.target.value)} className="rounded-none mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Description</label>
              <Input value={planDescription} onChange={e => setPlanDescription(e.target.value)} className="rounded-none mt-1" />
            </div>
            <Button onClick={savePlan} className="w-full rounded-none font-bold uppercase tracking-widest mt-4" disabled={runAction.isPending}>
              Save Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Card className="rounded-none border-zinc-200 shadow-none mt-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Demo Guide (10 Scenarios)</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-600">
              <li>Register a new member (Members &gt; Register)</li>
              <li>Assign existing card to a member without one (Members &gt; View Profile)</li>
              <li>Successful gated check-in (Gate Simulator &gt; Select active card &gt; Simulate Tap)</li>
              <li>Expired member denied (Gate Simulator &gt; Select expired member card)</li>
              <li>Renew expired membership (Members &gt; View Profile &gt; Renew)</li>
              <li>Reminder failure and recovery (Notifications &gt; Fallback Scenario)</li>
              <li>Internet outage (Gate Simulator &gt; Simulate Outage)</li>
              <li>Offline check-in (Gate Simulator &gt; Tap while offline)</li>
              <li>Internet restored and events synchronized (Gate Simulator &gt; Restore Internet &gt; Sync Now)</li>
              <li>Fitbase sample migration (Migration &gt; Upload Sample CSV &gt; Import)</li>
            </ol>
          </CardContent>
      </Card>
    </div>
  );
}
