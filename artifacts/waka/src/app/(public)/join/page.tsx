"use client";

import { useGetWorkspace, useJoin, getGetSessionQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

const joinSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(8, "Phone required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  branch_id: z.coerce.number().min(1),
  plan_id: z.coerce.number().min(1),
});

export default function JoinPage() {
  const { data: workspace } = useGetWorkspace();
  const join = useJoin();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<1 | 2>(1);

  const form = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      password: "",
    }
  });

  if (!workspace) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const onSubmit = (values: z.infer<typeof joinSchema>) => {
    if (step === 1) {
      setStep(2);
      return;
    }

    join.mutate({
      data: {
        ...values,
        record_payment: true
      }
    }, {
      onSuccess: () => {
        // Clear caches and invalidate session to pick up new user role
        queryClient.clear();
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        
        toast({ title: "Welcome to WAKA", description: "Registration and simulated payment successful." });
        router.push("/portal");
      },
      onError: (err: any) => {
        toast({ title: "Registration failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const selectedPlanId = form.watch("plan_id");
  const selectedPlan = workspace.plans.find(p => p.id === Number(selectedPlanId));

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col pt-12 pb-24">
      <div className="container mx-auto px-4 max-w-xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-2">Join WAKA</h1>
          <p className="text-zinc-500">Create your account and select a membership plan.</p>
        </div>

        <div className="bg-white border border-zinc-200 p-8 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {step === 1 && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="space-y-4">
                    <h2 className="text-lg font-display font-bold uppercase tracking-widest border-b border-zinc-100 pb-2">1. Personal Details</h2>
                    
                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input {...field} className="rounded-none bg-zinc-50" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input type="email" {...field} className="rounded-none bg-zinc-50" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl><Input {...field} className="rounded-none bg-zinc-50" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Create Password</FormLabel>
                        <FormControl><Input type="password" {...field} className="rounded-none bg-zinc-50" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-lg font-display font-bold uppercase tracking-widest border-b border-zinc-100 pb-2 mt-8">2. Membership Options</h2>
                    
                    <FormField control={form.control} name="branch_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Location</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger className="rounded-none bg-zinc-50">
                              <SelectValue placeholder="Select a branch..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {workspace.branches.map(b => (
                              <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="plan_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membership Plan</FormLabel>
                        <div className="grid gap-3">
                          {workspace.plans.map(p => (
                            <div 
                              key={p.id} 
                              className={`border p-4 cursor-pointer transition-colors ${field.value?.toString() === p.id.toString() ? 'border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900' : 'border-zinc-200 hover:border-zinc-400'}`}
                              onClick={() => form.setValue("plan_id", p.id)}
                            >
                              <div className="flex justify-between items-center">
                                <div className="font-bold uppercase tracking-widest text-sm">{p.name}</div>
                                <div className="font-mono">{p.price.toLocaleString()} RWF</div>
                              </div>
                              <div className="text-xs text-zinc-500 mt-1">{p.description}</div>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-none font-bold uppercase tracking-widest text-sm" disabled={!selectedPlanId}>
                    Continue to Payment
                  </Button>
                </div>
              )}

              {step === 2 && selectedPlan && (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <h2 className="text-lg font-display font-bold uppercase tracking-widest">3. Payment</h2>
                    <Button variant="ghost" size="sm" type="button" onClick={() => setStep(1)} className="rounded-none text-xs font-bold uppercase tracking-widest">Edit Details</Button>
                  </div>

                  <div className="bg-zinc-50 p-6 border border-zinc-200">
                    <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Order Summary</div>
                    <div className="flex justify-between items-center mb-2">
                      <span>{selectedPlan.name} Membership</span>
                      <span className="font-mono">{selectedPlan.price.toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-500 mb-6">
                      <span>Duration: {selectedPlan.duration_days} days</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-zinc-200 pt-4 font-bold text-lg">
                      <span>Total Due</span>
                      <span className="font-mono">{selectedPlan.price.toLocaleString()} RWF</span>
                    </div>
                  </div>

                  <div className="border border-zinc-200 p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-2">
                      <ShieldCheck className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="font-bold uppercase tracking-widest">Simulated Payment Gateway</div>
                    <p className="text-sm text-zinc-500">
                      In a production environment, this would integrate with a real payment provider. Clicking complete will simulate a successful transaction.
                    </p>
                  </div>

                  <Button type="submit" className="w-full h-14 rounded-none font-bold uppercase tracking-widest text-sm bg-zinc-900 hover:bg-zinc-800 text-white" disabled={join.isPending}>
                    {join.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                    Complete Simulated Payment
                  </Button>
                </div>
              )}

            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
