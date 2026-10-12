"use client";

import { useGetPayments } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const { data, isError, isLoading, refetch } = useGetPayments({ page, page_size: 50 });
  if (isLoading) return <p role="status">Loading payments…</p>;
  if (isError || !data) return <div role="alert">Payments could not be loaded. <Button onClick={() => refetch()}>Retry</Button></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Payments Log</h1>
        <p className="text-zinc-500">Simulated payment history</p>
      </div>

      <Card className="rounded-none border-zinc-200 shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No payments found</td></tr>
              )}
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono text-xs">{format(new Date(p.created_at), "dd MMM yyyy HH:mm")}</td>
                  <td className="px-4 py-3 font-medium">{p.member_name}</td>
                  <td className="px-4 py-3 font-mono text-sm">{p.amount.toLocaleString()} {p.currency}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{p.provider}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex items-center gap-4">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <span>Page {page} · {data.total} records</span>
        <Button variant="outline" disabled={page * data.page_size >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
