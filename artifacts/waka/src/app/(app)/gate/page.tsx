"use client";

import { useGetWorkspace, useRunAction, getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wifi, WifiOff, CreditCard, ShieldAlert, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isAllowed } from "@/lib/waka-ops";

export default function GateSimulatorPage() {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [offlineCache, setOfflineCache] = useState<any>(null);
  const [hydrationGen, setHydrationGen] = useState<string | null>(null);

  const { data: workspace, refetch } = useGetWorkspace({
    query: { 
      refetchInterval: isOffline ? false : 15000, 
      queryKey: getGetWorkspaceQueryKey() 
    }
  });
  
  const runAction = useRunAction();
  const { toast } = useToast();

  const [selectedCard, setSelectedCard] = useState<string>("");
  const [gateStatus, setGateStatus] = useState<"IDLE" | "GRANTED" | "DENIED">("IDLE");
  const [gateMessage, setGateMessage] = useState<string>("");
  const [syncing, setSyncing] = useState(false);

  // Initialize offline state from localStorage using generation barrier
  useEffect(() => {
    if (!workspace) return;
    if (hydrationGen !== workspace.demo_generation) {
      const storedState = localStorage.getItem(`waka_offline_state_${workspace.demo_generation}`);
      if (storedState) {
        try {
          const state = JSON.parse(storedState);
          setIsOffline(state.isOffline || false);
          setOfflineQueue(state.queue || []);
          setOfflineCache(state.cache || null);
        } catch (e) {
          toast({ title: "Offline Storage Error", description: "Failed to parse local cache. Resetting.", variant: "destructive" });
          setIsOffline(false);
          setOfflineQueue([]);
          setOfflineCache(null);
          localStorage.removeItem(`waka_offline_state_${workspace.demo_generation}`);
        }
      } else {
        setIsOffline(false);
        setOfflineQueue([]);
        setOfflineCache(null);
      }
      setHydrationGen(workspace.demo_generation);
    }
  }, [workspace, hydrationGen, toast]);

  // Save to localStorage ONLY when explicitly changed within current generation
  useEffect(() => {
    if (!workspace || hydrationGen !== workspace.demo_generation) return;
    try {
      localStorage.setItem(`waka_offline_state_${workspace.demo_generation}`, JSON.stringify({
        isOffline,
        queue: offlineQueue,
        cache: offlineCache
      }));
    } catch (e) {
      toast({ title: "Storage Error", description: "Could not save offline state.", variant: "destructive" });
    }
  }, [isOffline, offlineQueue, offlineCache, workspace, hydrationGen, toast]);

  if (!workspace) return null;

  // Drive card list from appropriate source based on online state
  const membersSource = isOffline && offlineCache ? offlineCache.members : workspace.members;
  const allCards = membersSource.flatMap((m: any) => 
    m.credentials.map((c: any) => ({
      uid: c.identifier,
      memberName: m.full_name || m.name, // handle possible mapping diffs in cache
      status: c.status,
      type: c.type
    }))
  ).filter((c: any) => c.type === 'CARD');

  const handleToggleOffline = () => {
    if (isOffline) {
      // Reconnect
      runAction.mutate({
        data: { action: "controller_status", online: true }
      }, {
        onSuccess: () => {
          setIsOffline(false);
          toast({ title: "Cloud connection restored" });
          if (offlineQueue.length > 0) {
            handleSync();
          } else {
            refetch();
          }
        }
      });
    } else {
      // Disconnect - freeze cache
      const cache = {
        members: workspace.members.map(m => ({
          id: m.id,
          name: m.full_name,
          start_date: m.start_date,
          end_date: m.end_date,
          status: m.status,
          credentials: m.credentials.map(c => ({
            id: c.id,
            identifier: c.identifier,
            status: c.status,
            type: c.type
          }))
        }))
      };
      
      runAction.mutate({
        data: { action: "controller_status", online: false }
      }, {
        onSuccess: () => {
          setOfflineCache(cache);
          setIsOffline(true);
          toast({ title: "Simulating Internet Outage", description: "Gate is now operating locally." });
        }
      });
    }
  };

  const handleSync = () => {
    if (offlineQueue.length === 0) return;
    setSyncing(true);
    
    // Capture the batch ID set
    const batch = [...offlineQueue];
    const batchIds = batch.map(e => e.id);

    runAction.mutate({
      data: {
        action: "sync_offline",
        generation: workspace.demo_generation,
        events: batch
      }
    }, {
      onSuccess: () => {
        toast({ title: "SYNC COMPLETE", description: `Synchronized ${batch.length} offline access events.` });
        setOfflineQueue(q => q.filter(e => !batchIds.includes(e.id)));
        setSyncing(false);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
        setSyncing(false);
      }
    });
  };

  const handleTap = () => {
    if (syncing) {
      toast({ title: "Sync in progress", description: "Please wait.", variant: "destructive" });
      return;
    }
    if (!selectedCard) {
      toast({ title: "Select a card first" });
      return;
    }

    if (isOffline) {
      // Local Evaluation
      if (!offlineCache) {
        setGateResult("DENIED", "ACCESS DENIED - NO CACHE");
        return;
      }
      
      let foundMember = null;
      let foundCred = null;
      for (const m of offlineCache.members) {
        const cred = m.credentials.find((c: any) => c.identifier === selectedCard);
        if (cred) {
          foundMember = m;
          foundCred = cred;
          break;
        }
      }

      const now = new Date();
      const eventId = crypto.randomUUID();
      
      if (!foundMember || !foundCred) {
        const event = {
          id: eventId,
          branch_id: 1,
          member_name: "Unknown Card",
          method: "SPEEDGATE_CARD",
          decision: "DENIED",
          reason: "Unknown credential",
          occurred_at: now.toISOString(),
          offline: true,
          sync_status: "PENDING"
        };
        setOfflineQueue(q => [...q, event]);
        setGateResult("DENIED", "ACCESS DENIED - UNKNOWN CARD");
        return;
      }

      if (foundCred.type !== 'CARD') {
        const event = {
          id: eventId,
          member_id: foundMember.id,
          member_name: foundMember.name,
          branch_id: 1,
          method: "SPEEDGATE_CARD",
          decision: "DENIED",
          reason: "QR not supported at speedgate",
          occurred_at: now.toISOString(),
          offline: true,
          sync_status: "PENDING"
        };
        setOfflineQueue(q => [...q, event]);
        setGateResult("DENIED", "ACCESS DENIED - QR NOT SUPPORTED AT GATE");
        return;
      }

      if (foundCred.status !== 'ACTIVE') {
        const event = {
          id: eventId,
          member_id: foundMember.id,
          member_name: foundMember.name,
          branch_id: 1,
          method: "SPEEDGATE_CARD",
          decision: "DENIED",
          reason: "Credential disabled",
          occurred_at: now.toISOString(),
          offline: true,
          sync_status: "PENDING"
        };
        setOfflineQueue(q => [...q, event]);
        setGateResult("DENIED", "ACCESS DENIED - CARD DISABLED");
        return;
      }
      
      const kigaliDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Kigali", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(now);

      if (foundMember.status !== 'ACTIVE' || typeof foundMember.start_date !== 'string' || typeof foundMember.end_date !== 'string' || !foundMember.start_date || !foundMember.end_date || foundMember.end_date.slice(0, 10) < kigaliDate || foundMember.start_date.slice(0, 10) > kigaliDate) {
        const event = {
          id: eventId,
          member_id: foundMember.id,
          member_name: foundMember.name,
          branch_id: 1,
          method: "SPEEDGATE_CARD",
          decision: "DENIED",
          reason: "Membership inactive/expired/future",
          occurred_at: now.toISOString(),
          offline: true,
          sync_status: "PENDING"
        };
        setOfflineQueue(q => [...q, event]);
        setGateResult("DENIED", "ACCESS DENIED - MEMBERSHIP INVALID");
        return;
      }

      // Valid
      const event = {
        id: eventId,
        member_id: foundMember.id,
        member_name: foundMember.name,
        branch_id: 1,
        method: "SPEEDGATE_CARD",
        decision: "ALLOWED",
        reason: "Valid membership",
        occurred_at: now.toISOString(),
        offline: true,
        sync_status: "PENDING"
      };
      setOfflineQueue(q => [...q, event]);
      setGateResult("GRANTED", `ACCESS GRANTED - ${foundMember.name}`);

    } else {
      // Cloud Evaluation
      runAction.mutate({
        data: {
          action: "checkin",
          branch_id: 1,
          method: "SPEEDGATE_CARD",
          identifier: selectedCard,
          credential_type: "CARD"
        }
      }, {
        onSuccess: (res) => {
          const event = res.event;
          if (event && isAllowed(event.decision)) {
            setGateResult("GRANTED", `ACCESS GRANTED - ${event.member_name}`);
          } else {
            setGateResult("DENIED", `ACCESS DENIED - ${event?.reason || "Unknown"}`);
          }
          refetch();
        },
        onError: () => {
          setGateResult("DENIED", "ACCESS DENIED - SYSTEM ERROR");
        }
      });
    }
  };

  const setGateResult = (status: "GRANTED" | "DENIED", message: string) => {
    setGateStatus(status);
    setGateMessage(message);
    setTimeout(() => {
      setGateStatus("IDLE");
      setGateMessage("");
    }, 4000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Gate Simulator</h1>
          <p className="text-zinc-500">Branch 1 (Gated Branch)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Terminal Side */}
        <Card className="rounded-none border-zinc-200 bg-zinc-900 text-white shadow-xl relative overflow-hidden min-h-[400px]">
          <CardHeader className="border-b border-zinc-800 bg-zinc-950/50">
            <CardTitle className="flex justify-between items-center text-sm font-display tracking-widest uppercase">
              <span>Terminal Access</span>
              <span className="text-xs text-zinc-500 font-mono">ID: WAKA-G1-01</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center h-full space-y-8">
            {gateStatus === "IDLE" && (
              <>
                <div className="w-24 h-24 rounded-full border-2 border-zinc-700 flex items-center justify-center animate-[pulse_3s_ease-in-out_infinite]">
                  <CreditCard className="w-10 h-10 text-zinc-500" />
                </div>
                <div>
                  <div className="text-2xl font-display font-bold tracking-widest text-zinc-300">PLEASE TAP CARD</div>
                  <div className="text-sm font-mono text-zinc-500 mt-2">SIMULATED GATE INTEGRATION</div>
                </div>
              </>
            )}
            {gateStatus === "GRANTED" && (
              <>
                <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-display font-bold tracking-widest text-green-500">SIMULATED SPEEDGATE OPEN</div>
                  <div className="text-sm font-mono text-green-400 mt-2">{gateMessage}</div>
                </div>
              </>
            )}
            {gateStatus === "DENIED" && (
              <>
                <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-display font-bold tracking-widest text-red-500">ACCESS DENIED</div>
                  <div className="text-sm font-mono text-red-400 mt-2">{gateMessage}</div>
                </div>
              </>
            )}
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-zinc-950 flex justify-between items-center text-xs font-mono">
            <span className={isOffline ? "text-yellow-500 font-bold" : "text-green-500"}>
              CLOUD: {isOffline ? "OFFLINE" : "ONLINE"}
            </span>
            <span className="text-green-500">LOCAL: ACTIVE</span>
          </div>
        </Card>

        {/* Control Side */}
        <div className="space-y-6">
          <Card className="rounded-none border-zinc-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Simulator Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest">Select Card to Tap</label>
                <Select value={selectedCard} onValueChange={setSelectedCard}>
                  <SelectTrigger className="rounded-none">
                    <SelectValue placeholder="Choose a card..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allCards.map((c: any, i: number) => (
                      <SelectItem key={i} value={c.uid}>
                        {c.uid} - {c.memberName} ({c.status})
                      </SelectItem>
                    ))}
                    <SelectItem value="04-XX-XX-XX-XX">Unknown Card (Test Deny)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleTap} className="w-full rounded-none font-bold uppercase tracking-widest" disabled={runAction.isPending || gateStatus !== "IDLE" || syncing}>
                Simulate Tap
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-none border-zinc-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Network & Offline Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-zinc-200 bg-zinc-50">
                <div className="flex items-center gap-3">
                  {isOffline ? <WifiOff className="w-5 h-5 text-red-500" /> : <Wifi className="w-5 h-5 text-green-500" />}
                  <div>
                    <div className="font-bold text-sm">{isOffline ? "Simulating Outage" : "Connected"}</div>
                    <div className="text-xs text-zinc-500">
                      {isOffline ? "Using local cache" : "Using real-time cloud evaluation"}
                    </div>
                  </div>
                </div>
                <Button 
                  variant={isOffline ? "default" : "outline"} 
                  className={`rounded-none font-bold uppercase tracking-widest text-xs ${isOffline ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                  onClick={handleToggleOffline}
                  disabled={runAction.isPending || syncing}
                >
                  {isOffline ? "Restore Internet" : "Simulate Outage"}
                </Button>
              </div>

              {isOffline && (
                <div className="bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex items-start gap-2 text-yellow-800">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <strong>WARNING:</strong> Operating offline. Card revocations or new memberships made on other terminals during this outage are not yet cached and will not apply here.
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-zinc-200 p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-bold uppercase tracking-widest">Pending Sync</div>
                  <div className="text-xl font-display font-bold">{offlineQueue.length}</div>
                </div>
                {offlineQueue.length > 0 && (
                  <div className="text-xs text-zinc-500 mb-4">
                    Events will synchronize when connection is restored.
                  </div>
                )}
                {isOffline && offlineQueue.length > 0 && (
                  <Button disabled className="w-full rounded-none uppercase tracking-widest text-xs">
                    Waiting for connection...
                  </Button>
                )}
                {!isOffline && offlineQueue.length > 0 && (
                  <Button 
                    className="w-full rounded-none uppercase tracking-widest text-xs bg-blue-600 hover:bg-blue-700 text-white" 
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Sync Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
