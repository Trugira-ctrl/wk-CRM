"use client";

import Link from "next/link";
import { useGetPublic, getGetPublicQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function formatRwf(n: number) {
  return `${n.toLocaleString("en-US")} RWF`;
}

export function PublicPlans() {
  const { data, isLoading, isError, refetch } = useGetPublic({
    query: { queryKey: getGetPublicQueryKey(), refetchInterval: 15000, refetchOnWindowFocus: true, refetchOnMount: "always", staleTime: 0 },
  });
  const plans = data?.plans ?? [];

  return (
    <section id="memberships" className="py-24 bg-zinc-950 text-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-center mb-4">Membership Plans</h2>
        <p className="text-zinc-400 text-center mb-3 max-w-xl mx-auto">Plan details below are the same records used by Join and the admin console.</p>
        <p className="text-center mb-16">
          <span className="inline-block border border-amber-400/60 text-amber-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1">
            Illustrative demo prices — not confirmed WAKA pricing
          </span>
        </p>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[0, 1, 2].map((i) => <div key={i} className="h-72 border border-zinc-800 bg-zinc-900 animate-pulse" />)}
          </div>
        )}
        {isError && (
          <div className="max-w-md mx-auto border border-zinc-800 p-8 text-center">
            <p className="text-zinc-300 mb-4">Plans could not be loaded.</p>
            <Button onClick={() => refetch()} className="rounded-none font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200">Retry</Button>
          </div>
        )}
        {!isLoading && !isError && plans.length === 0 && (
          <p className="text-center text-zinc-400">No plans are currently configured.</p>
        )}

        {plans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.id} className="border border-zinc-800 bg-zinc-950 hover:border-zinc-500 transition-colors p-8 relative flex flex-col">
                <div className="text-sm text-zinc-400 uppercase tracking-widest font-bold mb-4">{plan.name}</div>
                <div className="text-3xl font-display font-bold mb-1">{plan.price.toLocaleString("en-US")} <span className="text-sm font-sans text-zinc-500 font-normal">RWF</span></div>
                <div className="text-[10px] text-amber-300 uppercase tracking-widest font-bold mb-2">Illustrative demo price</div>
                <div className="text-xs text-zinc-500 mb-4">{plan.duration_days} days</div>
                <p className="text-sm text-zinc-400 mb-8">{plan.description}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 mr-3 text-white" /> Gym access at your chosen branch</li>
                  <li className="flex items-center text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 mr-3 text-white" /> Member portal</li>
                  <li className="flex items-center text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 mr-3 text-white" /> Simulated online payment</li>
                </ul>
                <Link href={`/join?plan=${plan.id}`}>
                  <Button className="w-full rounded-none font-bold uppercase tracking-widest h-12 bg-white text-black hover:bg-zinc-200">
                    Select {plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
        <p className="text-center text-xs text-zinc-500 mt-10">Class schedules, multi-branch access and other inclusions are not yet confirmed by WAKA.</p>
      </div>
    </section>
  );
}
