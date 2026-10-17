"use client";

import { useRef, useState } from "react";
import { useGetMomoSandbox, useStartMomoSandboxPayment, useCheckMomoSandboxPayment } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(minor / 100);
type Scenario = "SUCCESSFUL" | "FAILED" | "PENDING";

export default function MomoSandboxPage() {
  const { data, isLoading, isError, refetch } = useGetMomoSandbox();
  const start = useStartMomoSandboxPayment();
  const check = useCheckMomoSandboxPayment();
  const [amount, setAmount] = useState("10");
  const [scenario, setScenario] = useState<Scenario>("SUCCESSFUL");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const busy = start.isPending || check.isPending;

  async function create() {
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    const minor = Math.round(Number(amount) * 100);
    const storageKey = `waka:momo-sandbox:${minor}:${scenario}`;
    try {
      const key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      await start.mutateAsync({ data: { idempotency_key: key, amount_minor: minor, scenario } });
      sessionStorage.removeItem(storageKey);
      await refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test request could not be completed.");
    } finally {
      submitting.current = false;
    }
  }

  async function verify(reference: string) {
    setError("");
    try { await check.mutateAsync({ reference }); await refetch(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "MTN status could not be checked."); }
  }

  if (isLoading) return <p role="status">Loading sandbox wallet…</p>;
  if (isError || !data) return <div role="alert">Sandbox could not be loaded. <Button onClick={() => refetch()}>Retry</Button></div>;

  return <div className="max-w-5xl mx-auto space-y-6">
    <header><h1 className="text-3xl font-display font-bold uppercase">MTN MoMo Sandbox</h1>
      <p className="text-zinc-500 mt-1">Test payment collection and traceable receipts</p></header>
    <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      Test environment only. MTN’s sandbox uses test euros and predefined test numbers. This test wallet is separate from members’ RWF gym credit. No real money moves and no membership is renewed.
    </div>
    {!data.configured && <p role="status" className="border p-4 text-sm">Connection setup is pending. An administrator needs to configure the MTN sandbox credentials before requesting test payments.</p>}
    {error && <p role="alert" className="border border-red-200 bg-red-50 text-red-800 p-4 text-sm">{error}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="rounded-none shadow-none"><CardHeader><CardTitle className="text-base">Verified test-wallet credit</CardTitle></CardHeader>
        <CardContent><p className="text-3xl font-mono font-bold">{money(data.balance_minor)}</p>
          <p className="text-sm text-zinc-500 mt-3">Credit is added once, after WAKA checks a successful transaction directly with MTN and matches its amount, currency and reference.</p></CardContent></Card>
      <Card className="rounded-none shadow-none"><CardHeader><CardTitle className="text-base">Request a test deposit</CardTitle></CardHeader><CardContent>
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); void create(); }}>
          <label className="block text-sm">Test amount (EUR)<Input type="number" min="1" max="1000" step="0.01" value={amount} required onChange={event => setAmount(event.target.value)} disabled={busy} /></label>
          <label className="block text-sm">MTN test scenario<select className="block w-full border p-2 mt-1 bg-white" value={scenario} onChange={event => setScenario(event.target.value as Scenario)} disabled={busy}>
            <option value="SUCCESSFUL">Successful payment</option><option value="FAILED">Failed payment</option><option value="PENDING">Pending payment</option>
          </select></label>
          <Button disabled={!data.configured || busy} className="w-full rounded-none">Request sandbox payment</Button>
          <p className="text-xs text-zinc-500">After requesting, use Check MTN status below. An accepted request adds no credit by itself.</p>
        </form>
      </CardContent></Card>
    </div>
    <Card className="rounded-none shadow-none"><CardHeader className="flex flex-row justify-between items-center"><CardTitle className="text-base">Payment records</CardTitle>
      <Button variant="outline" disabled={busy} onClick={() => refetch()}>Refresh list</Button></CardHeader>
      <CardContent className="space-y-4">
        {!data.payments.length && <p className="text-sm text-zinc-500">No sandbox payments yet.</p>}
        {data.payments.map(payment => <article key={payment.id} className="border-b last:border-b-0 pb-4 space-y-2">
          <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{money(payment.amount_minor)} · {payment.scenario.toLowerCase()} test</p><p className="text-xs font-bold uppercase">{payment.status.replaceAll("_", " ")}</p></div>
          <p className="text-sm text-zinc-600">{payment.note}</p>
          <p className="text-xs text-zinc-500 break-all">WAKA reference: {payment.id}</p>
          {payment.provider_transaction_id && <p className="text-xs text-zinc-500 break-all">MTN reference: {payment.provider_transaction_id}</p>}
          <p className="text-xs text-zinc-500">Created {new Date(payment.created_at).toLocaleString()} · Test credit added: {money(payment.credited_minor)}</p>
          <div className="flex flex-wrap gap-3 items-center">
            {!['SUCCESSFUL','FAILED'].includes(payment.status) && <Button size="sm" disabled={busy || !data.configured} onClick={() => verify(payment.id)}>Check MTN status</Button>}
            <a className="text-sm underline underline-offset-4" href={`/api/momo-sandbox/payments/${payment.id}/receipt`} download={`sandbox-receipt-${payment.id}.json`}>Download test receipt (JSON)</a>
          </div>
        </article>)}
      </CardContent></Card>
  </div>;
}
