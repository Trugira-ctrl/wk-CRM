"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetWallet, useRunWalletAction, type Plan, type WalletActionInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const money = (amount: number) => `${amount.toLocaleString()} RWF`;
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");

export function WalletPanel({ memberId, plans, isAdmin }: { memberId: number; plans: Plan[]; isAdmin: boolean }) {
  const { data: wallet, error, refetch, isFetching } = useGetWallet({ member_id: memberId });
  const action = useRunWalletAction();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("75000");
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const [planId, setPlanId] = useState(String(plans[0]?.id ?? ""));
  const [categories, setCategories] = useState<Record<string, "VOLUNTARY" | "PAYMENT_ERROR">>({});
  const submitting = useRef(false);
  const selectedPlan = plans.find(p => p.id === Number(planId));

  async function submit(input: Omit<WalletActionInput, "member_id">, keyed = false) {
    if (submitting.current) return;
    submitting.current = true;
    let storageKey: string | undefined;
    try {
      const data: WalletActionInput = { ...input, member_id: memberId };
      if (keyed) {
        // Retain uncertain requests across reloads; a retry cannot spend twice.
        storageKey = `waka:wallet:${JSON.stringify(data)}`;
        data.idempotency_key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
        sessionStorage.setItem(storageKey, data.idempotency_key);
      }
      const result = await action.mutateAsync({ data });
      if (storageKey) sessionStorage.removeItem(storageKey);
      toast({ title: "Gym credit updated", description: result.message });
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["/api/workspace"] })]);
    } catch (err) {
      toast({ title: "Operation not completed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
      await refetch();
    } finally {
      submitting.current = false;
    }
  }

  if (error) return <div role="alert" className="border border-red-200 p-4">Gym credit could not load. <Button variant="outline" onClick={() => refetch()}>Retry</Button></div>;
  if (!wallet) return <p role="status">Loading gym credit…</p>;
  const busy = action.isPending;
  const pending = wallet.operations.filter(op => ["PENDING", "REQUESTED", "APPROVED"].includes(op.status));
  const pauseEnd = wallet.topup_blocked_until ? new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(`${wallet.topup_blocked_until}T00:00:00Z`)) : "";

  return <section className="space-y-5" aria-label="Gym credit">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-2xl font-display font-bold uppercase">Gym Credit</h2>
        <p className="text-sm text-zinc-600">Demo wallet · all deposits, purchases, and refunds are simulated.</p></div>
      <Button variant="outline" disabled={isFetching || busy} onClick={() => refetch()}>Refresh</Button>
    </div>
    <div className="grid gap-4 sm:grid-cols-3" aria-live="polite">
      {[["Available to spend", wallet.available], ["Reserved for refunds", wallet.reserved], ["Total credit", wallet.balance]].map(([title, value]) =>
        <Card key={title} className="rounded-none shadow-none"><CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-600">{title}</CardTitle></CardHeader>
          <CardContent className="font-mono text-xl font-bold break-words">{money(Number(value))}</CardContent></Card>)}
    </div>
    {!wallet.can_topup && <div role="status" className="border border-amber-300 bg-amber-50 p-4 text-sm">
      Top-ups resume on <strong>{pauseEnd} (Kigali)</strong> after your completed voluntary refund.
      <strong> Direct membership purchases remain available.</strong> You may also spend any available gym credit.
    </div>}
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-none shadow-none"><CardHeader><CardTitle className="text-base">Add money</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit({ action: "wallet_topup", amount: Number(amount) }, true); }}>
          <label className="block text-sm">Deposit amount (RWF)<Input type="number" min="1" max="10000000" step="1" required value={amount} onChange={e => setAmount(e.target.value)} disabled={!wallet.can_topup || busy} /></label>
          <p className="text-xs text-zinc-600">Creates a pending demo deposit. Confirm its outcome below. Adding money does not renew membership.</p>
          <Button className="w-full rounded-none" disabled={busy || !wallet.can_topup}>Start demo deposit</Button>
        </form>
      </CardContent></Card>
      <Card className="rounded-none shadow-none"><CardHeader><CardTitle className="text-base">Pay with credit</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit({ action: "wallet_purchase", plan_id: Number(planId) }, true); }}>
          <label className="block text-sm">Membership plan<select className="w-full border border-zinc-200 bg-white px-3 py-2 text-sm mt-1" value={planId} onChange={e => setPlanId(e.target.value)} required disabled={busy}>
            {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>)}
          </select></label>
          <p className="text-xs text-zinc-600">Deducts the plan price and adds its membership days together. Reserved credit cannot be spent.</p>
          <Button className="w-full rounded-none" disabled={busy || !selectedPlan || selectedPlan.price > wallet.available}>Pay & renew with credit</Button>
        </form>
      </CardContent></Card>
      <Card className="rounded-none shadow-none"><CardHeader><CardTitle className="text-base">Request a refund</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); void submit({ action: "wallet_request_refund", amount: Number(refundAmount), reason }, true); }}>
          <label className="block text-sm">Unused amount (RWF)<Input type="number" min="1" max={wallet.available} step="1" required value={refundAmount} onChange={e => setRefundAmount(e.target.value)} disabled={busy} /></label>
          <label className="block text-sm">Reason<Input required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label>
          <p className="text-xs text-zinc-600">Reserved for admin review. A completed voluntary refund pauses new top-ups for two calendar months. Direct membership purchases remain available. Verified payment-error refunds are exempt.</p>
          <Button variant="outline" className="w-full rounded-none" disabled={busy || wallet.available < 1}>Request demo refund</Button>
        </form>
      </CardContent></Card>
    </div>
    {pending.length > 0 && <Card className="rounded-none shadow-none"><CardHeader><CardTitle className="text-base">Pending operations</CardTitle></CardHeader>
      <CardContent className="space-y-4">{pending.map(op => <div key={op.id} className="border-b border-zinc-100 pb-4 last:border-0 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><span className="capitalize font-medium">{label(op.kind)} · {money(op.amount)}</span><span className="capitalize text-sm">{label(op.status)}</span></div>
        {op.details.reason && <p className="text-sm text-zinc-600">{op.details.reason}</p>}
        <p className="text-xs text-zinc-500">Requested {new Date(op.created_at).toLocaleString()}</p>
        {op.kind === "TOPUP" && <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => submit({ action: "wallet_confirm_topup", operation_id: op.id, outcome: "SUCCESSFUL" })}>Simulate deposit success</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => submit({ action: "wallet_confirm_topup", operation_id: op.id, outcome: "FAILED" })}>Simulate deposit failure</Button>
        </div>}
        {op.kind === "REFUND" && !isAdmin && <p className="text-sm text-zinc-600">{op.status === "REQUESTED" ? "Awaiting administrator review." : "Approved; awaiting simulated refund confirmation."} The amount remains reserved.</p>}
        {op.kind === "REFUND" && op.status === "REQUESTED" && isAdmin && <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm min-w-0 max-w-full">Refund category<select className="block w-full max-w-full border border-zinc-200 bg-white px-3 py-2 mt-1" value={categories[op.id] || "VOLUNTARY"} onChange={e => setCategories({ ...categories, [op.id]: e.target.value as "VOLUNTARY" | "PAYMENT_ERROR" })}>
            <option value="VOLUNTARY">Voluntary · two-month top-up pause</option><option value="PAYMENT_ERROR">Verified payment error · no pause</option>
          </select></label>
          <Button disabled={busy} size="sm" onClick={() => submit({ action: "wallet_review_refund", operation_id: op.id, decision: "APPROVE", category: categories[op.id] || "VOLUNTARY" })}>Approve demo refund</Button>
          <Button disabled={busy} size="sm" variant="outline" onClick={() => submit({ action: "wallet_review_refund", operation_id: op.id, decision: "REJECT", category: categories[op.id] || "VOLUNTARY" })}>Reject & release credit</Button>
        </div>}
        {op.kind === "REFUND" && op.status === "APPROVED" && isAdmin && <div className="space-y-2">
          <p className="text-sm">Refund returns to the original deposit source(s). {op.details.category === "VOLUNTARY" ? "Success starts the two-month top-up pause." : "Payment-error category: no new top-up pause."}</p>
          <div className="flex flex-wrap gap-2"><Button disabled={busy} size="sm" onClick={() => submit({ action: "wallet_confirm_refund", operation_id: op.id, outcome: "SUCCESSFUL" })}>Simulate refund success</Button>
            <Button disabled={busy} size="sm" variant="outline" onClick={() => submit({ action: "wallet_confirm_refund", operation_id: op.id, outcome: "FAILED" })}>Simulate refund failure</Button></div>
        </div>}
      </div>)}</CardContent></Card>}
    <Card className="rounded-none shadow-none"><CardHeader><CardTitle className="text-base">Credit history</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {wallet.entries.length === 0 && <p className="text-sm text-zinc-600">No credit movements yet.</p>}
        {wallet.entries.map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-3 last:border-0">
          <div><div className="capitalize text-sm font-medium">{label(item.kind)}</div><div className="text-xs text-zinc-500">{new Date(item.created_at).toLocaleString()}</div></div>
          <div className="text-right text-sm"><div className="font-mono">{item.balance_delta > 0 ? "+" : ""}{money(item.balance_delta)}</div>
            <div className="text-xs text-zinc-600">Balance {money(item.balance_after)} · Reserved {money(item.reserved_after)}</div></div>
        </div>)}
        <p className="text-xs text-zinc-500">Latest 100 movements and operations. All demo movements are retained on the server.</p>
      </CardContent>
    </Card>
  </section>;
}
