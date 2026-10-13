"use client";
import { renewalKey, completeRenewal } from "@/lib/renewal-key";

import { fmtDate } from "@/lib/waka-ops";

import { useGetWorkspace, useRunAction } from "@workspace/api-client-react";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, CreditCard, CalendarClock, ShieldAlert, Zap, Loader2, QrCode, UserPen } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const updateMemberSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(8, "Phone required"),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  emergency_contact: z.string().optional(),
  notes: z.string().optional(),
  branch_id: z.coerce.number().min(1),
  plan_id: z.coerce.number().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export default function MemberProfilePage() {
  const params = useParams();
  const id = Number(params.id);
  const { data: workspace, refetch } = useGetWorkspace();
  const runAction = useRunAction();
  const { toast } = useToast();
  
  const [isReadingCard, setIsReadingCard] = useState(false);
  const [detectedUid, setDetectedUid] = useState<string | null>(null);
  const [credentialType, setCredentialType] = useState<"CARD" | "QR">("CARD");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewalPlanId, setRenewalPlanId] = useState<string>("");

  const form = useForm<z.infer<typeof updateMemberSchema>>({
    resolver: zodResolver(updateMemberSchema),
  });

  if (!workspace) return null;

  const member = workspace.members.find(m => m.id === id);
  if (!member) {
    return <div className="p-8 text-center text-zinc-500">Member not found</div>;
  }

  const activeCredentials = member.credentials.filter(c => c.status === 'ACTIVE');
  const hasCard = activeCredentials.some(c => c.type === 'CARD');
  const hasQR = activeCredentials.some(c => c.type === 'QR');

  const openEdit = () => {
    form.reset({
      full_name: member.full_name,
      email: member.email,
      phone: member.phone,
      gender: member.gender || "",
      date_of_birth: member.date_of_birth || "",
      emergency_contact: member.emergency_contact || "",
      notes: member.notes || "",
      branch_id: member.branch_id,
      plan_id: member.plan_id ?? undefined,
      start_date: member.start_date ? member.start_date.split('T')[0] : "",
      end_date: member.end_date ? member.end_date.split('T')[0] : ""
    });
    setIsEditOpen(true);
  };

  const onEditSubmit = (values: z.infer<typeof updateMemberSchema>) => {
    runAction.mutate({
      data: {
        action: "update_member",
        member_id: member.id,
        member: values
      }
    }, {
      onSuccess: () => {
        toast({ title: "Profile Updated", description: "Member details have been updated." });
        setIsEditOpen(false);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Update Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const simulateRead = (type: "CARD" | "QR") => {
    setCredentialType(type);
    setIsReadingCard(true);
    setTimeout(() => {
      setIsReadingCard(false);
      if (type === "CARD") {
        setDetectedUid(`04-${Math.random().toString(16).substring(2,10).toUpperCase().match(/.{1,2}/g)?.join('-')}`);
      } else {
        setDetectedUid(`WAKA-QR-${member.id}-${Math.random().toString(36).substring(2,8).toUpperCase()}`);
      }
    }, 1500);
  };

  const confirmCredential = () => {
    if (!detectedUid) return;
    runAction.mutate({
      data: {
        action: "assign_card",
        member_id: member.id,
        identifier: detectedUid,
        credential_type: credentialType
      }
    }, {
      onSuccess: () => {
        toast({ title: `${credentialType} Assigned Successfully` });
        setDetectedUid(null);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: `Failed to assign ${credentialType}`, description: err.message, variant: "destructive" });
      }
    });
  };

  const disableCredential = (credential_id: number) => {
    runAction.mutate({
      data: { action: "disable_card", credential_id }
    }, {
      onSuccess: () => {
        toast({ title: "Credential Disabled" });
        refetch();
      }
    });
  };

  const openRenew = () => {
    setRenewalPlanId(member.plan_id != null ? member.plan_id.toString() : "");
    setIsRenewOpen(true);
  };

  const renewMembership = () => {
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
        toast({ title: "SIMULATED PAYMENT SUCCESSFUL", description: "Membership renewed" });
        setIsRenewOpen(false);
        refetch();
      }
    });
  };

  const selectedRenewalPlan = workspace.plans.find(p => p.id.toString() === renewalPlanId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link href="/members" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-4 uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Directory
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold uppercase tracking-tight">{member.full_name}</h1>
            <p className="text-zinc-500 mt-1 flex items-center gap-2">
              ID: {member.id} • {member.email} • {member.phone}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
              member.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              member.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
              'bg-zinc-100 text-zinc-800'
            }`}>
              {member.status}
            </span>
            <Button variant="outline" className="rounded-none font-bold uppercase tracking-widest text-xs h-8" onClick={openEdit}>
              <UserPen className="w-3 h-3 mr-2" /> Edit Profile
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display uppercase text-xl">Edit Member Profile</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-none"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="M">Male</SelectItem>
                        <SelectItem value="F">Female</SelectItem>
                        <SelectItem value="O">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input type="date" {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="emergency_contact" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" placeholder="Name & Phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="branch_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Branch</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger></FormControl>
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
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                      <FormControl><SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {workspace.plans.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-zinc-100 py-4 my-4">
                <FormField control={form.control} name="start_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership Start</FormLabel>
                    <FormControl><Input type="date" {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="end_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership End</FormLabel>
                    <FormControl><Input type="date" {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl><Input {...field} className="rounded-none" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full rounded-none font-bold uppercase tracking-widest" disabled={runAction.isPending}>
                Save Changes
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Membership Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-zinc-500">Plan</div>
              <div className="font-medium text-lg">{member.plan_id == null ? "No membership" : member.plan_name}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-zinc-500">Start Date</div>
                <div className="font-medium">{fmtDate(member.start_date)}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">End Date</div>
                <div className={`font-medium ${member.status === 'EXPIRED' ? 'text-red-600' : ''}`}>
                  {fmtDate(member.end_date)}
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-zinc-100">
              <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
                <Button className="w-full rounded-none font-bold uppercase tracking-widest" onClick={openRenew}>
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
                    
                    <Button onClick={renewMembership} className="w-full rounded-none font-bold uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800" disabled={runAction.isPending || !renewalPlanId}>
                      Pay & Renew
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-zinc-200 shadow-none bg-zinc-50/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Access Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeCredentials.map(cred => (
                <div key={cred.id} className="bg-white border border-zinc-200 p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    {cred.type === 'CARD' ? <CreditCard className="w-6 h-6 text-zinc-400" /> : <QrCode className="w-6 h-6 text-zinc-400" />}
                    <div>
                      <div className="font-mono text-sm">{cred.identifier}</div>
                      <div className="text-[10px] text-green-600 font-bold uppercase tracking-widest">Active {cred.type}</div>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" className="rounded-none uppercase text-[10px] tracking-widest font-bold" onClick={() => disableCredential(cred.id)}>
                    Disable
                  </Button>
                </div>
              ))}
              
              {!isReadingCard && !detectedUid && (
                <div className="grid grid-cols-2 gap-2 mt-4 border-t border-zinc-200 pt-4">
                  <Button onClick={() => simulateRead("CARD")} variant="outline" className="rounded-none font-bold uppercase tracking-widest text-[10px] h-10 border-dashed bg-white" disabled={hasCard}>
                    <CreditCard className="w-4 h-4 mr-2" /> Add Card
                  </Button>
                  <Button onClick={() => simulateRead("QR")} variant="outline" className="rounded-none font-bold uppercase tracking-widest text-[10px] h-10 border-dashed bg-white" disabled={hasQR}>
                    <QrCode className="w-4 h-4 mr-2" /> Add QR
                  </Button>
                </div>
              )}
              
              {isReadingCard && (
                <div className="flex flex-col items-center justify-center p-4 border border-zinc-200 bg-white">
                  <Loader2 className="w-6 h-6 text-zinc-900 animate-spin mb-2" />
                  <div className="text-sm font-bold uppercase tracking-widest">Simulated {credentialType} Reader</div>
                  <div className="text-xs text-zinc-500">Waiting for scan...</div>
                </div>
              )}
              
              {detectedUid && (
                <div className="p-4 border border-zinc-200 bg-white text-left shadow-sm">
                  <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">{credentialType} Detected</div>
                  <div className="font-mono text-lg mb-4">{detectedUid}</div>
                  <div className="text-sm mb-4">Assign this {credentialType} to {member.full_name}?</div>
                  <div className="flex gap-2">
                    <Button onClick={confirmCredential} className="flex-1 rounded-none font-bold uppercase tracking-widest" disabled={runAction.isPending}>Confirm</Button>
                    <Button variant="outline" onClick={() => setDetectedUid(null)} className="flex-1 rounded-none font-bold uppercase tracking-widest" disabled={runAction.isPending}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
