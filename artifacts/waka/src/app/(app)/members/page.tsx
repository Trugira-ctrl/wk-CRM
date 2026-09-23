"use client";

import { useGetWorkspace, useRunAction } from "@workspace/api-client-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Search, Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const memberSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(8, "Phone required"),
  branch_id: z.coerce.number().min(1),
  plan_id: z.coerce.number().min(1),
  gender: z.string().optional(),
});

export default function MembersPage() {
  const { data: workspace, refetch } = useGetWorkspace();
  const runAction = useRunAction();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      gender: "",
    }
  });

  if (!workspace) return null;

  const filteredMembers = workspace.members.filter(m => 
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  );

  const onSubmit = (values: z.infer<typeof memberSchema>) => {
    runAction.mutate({
      data: {
        action: "register_member",
        member: {
          ...values,
          record_payment: true
        }
      }
    }, {
      onSuccess: () => {
        toast({ title: "Member Registered Successfully" });
        setIsRegisterOpen(false);
        form.reset();
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Failed to register", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">Members</h1>
        
        <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none font-bold uppercase tracking-widest">
              <UserPlus className="w-4 h-4 mr-2" />
              Register Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-none border-zinc-200">
            <DialogHeader>
              <DialogTitle className="font-display uppercase text-xl">Register New Member</DialogTitle>
              <DialogDescription>Create a new membership and simulated payment record.</DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} className="rounded-none" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} className="rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} className="rounded-none" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="branch_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Branch</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="rounded-none">
                            <SelectValue placeholder="Select branch" />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="rounded-none">
                            <SelectValue placeholder="Select plan" />
                          </SelectTrigger>
                        </FormControl>
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
                <Button type="submit" className="w-full rounded-none font-bold uppercase tracking-widest mt-6" disabled={runAction.isPending}>
                  {runAction.isPending ? "Registering..." : "Complete Registration"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-none border-zinc-200 shadow-none">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-2">
          <Search className="w-5 h-5 text-zinc-400" />
          <Input 
            placeholder="Search by name, email, or phone..." 
            className="border-none shadow-none focus-visible:ring-0 px-0 h-auto text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No members found</td>
                </tr>
              )}
              {filteredMembers.map(member => (
                <tr key={member.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{member.full_name}</div>
                    <div className="text-xs text-zinc-500">ID: {member.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-900">{member.phone}</div>
                    <div className="text-xs text-zinc-500">{member.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-900">{member.plan_name}</div>
                    <div className="text-xs text-zinc-500">Exp: {format(new Date(member.end_date), "dd MMM yyyy")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
                      member.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      member.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                      'bg-zinc-100 text-zinc-800'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/members/${member.id}`}>
                      <Button variant="outline" size="sm" className="rounded-none text-xs font-semibold uppercase tracking-wider">
                        View Profile
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
