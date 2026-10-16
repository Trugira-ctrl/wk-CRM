"use client";

import { useState } from "react";
import { useGetWorkspace } from "@workspace/api-client-react";
import { WalletPanel } from "@/components/wallet-panel";

export default function WalletPage() {
  const { data: workspace } = useGetWorkspace();
  const [selected, setSelected] = useState("");
  if (!workspace) return <p>Loading members…</p>;
  const memberId = Number(selected || workspace.members[0]?.id);
  return <div className="space-y-6 max-w-6xl mx-auto">
    <div><h1 className="text-3xl font-display font-bold uppercase">Member Wallets</h1>
      <p className="text-zinc-600 mt-1">View member gym credit. Administrators review refunds.</p></div>
    <label className="block text-sm max-w-md">Member<select className="block w-full bg-white border border-zinc-200 px-3 py-2 mt-1" value={String(memberId || "")} onChange={e => setSelected(e.target.value)}>
      {workspace.members.map(member => <option key={member.id} value={member.id}>{member.full_name} · {member.email}</option>)}
    </select></label>
    {memberId ? <WalletPanel key={memberId} memberId={memberId} plans={workspace.plans} isAdmin={workspace.user.role === "ADMIN"} /> : <p>No members found.</p>}
  </div>;
}
