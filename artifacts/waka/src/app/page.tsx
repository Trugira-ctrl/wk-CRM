"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const login = useLogin();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ data: { email, password } }, {
      onSuccess: (session) => {
        queryClient.clear();
        queryClient.setQueryData(getGetSessionQueryKey(), session);
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        toast({ title: "Welcome to WAKA", description: `Logged in as ${session.user?.name}` });
        if (session.user?.role === "MEMBER") {
          router.push("/portal");
        } else {
          router.push("/dashboard");
        }
      },
      onError: () => {
        toast({ title: "Login Failed", description: "Invalid credentials", variant: "destructive" });
      }
    });
  };

  const demoAccounts = [
    { label: "Admin", email: "admin@waka.demo" },
    { label: "Management", email: "management@waka.demo" },
    { label: "Reception", email: "reception@waka.demo" },
    { label: "Member (Aline)", email: "aline@waka.demo" },
    { label: "Member (Eric)", email: "eric@waka.demo" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold tracking-tighter uppercase">WAKA</h1>
          <p className="text-sm text-zinc-500 mt-2 uppercase tracking-widest font-semibold">Management Platform</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="name@waka.demo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <Button type="submit" className="w-full font-bold uppercase tracking-wider" disabled={login.isPending}>
            {login.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
            Sign In
          </Button>
        </form>

        <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 mb-4 text-center font-semibold tracking-wider uppercase">Demo Accounts (WakaDemo2026!)</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map(acc => (
              <Button 
                key={acc.email} 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("WakaDemo2026!");
                }}
              >
                {acc.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center text-sm">
          <Link href="/website" className="text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wider font-semibold">
            View Public Website &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
