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
  const [loginError, setLoginError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    login.mutate({ data: { email: email.trim(), password } }, {
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
      onError: (error) => {
        const detail = (error.data as { detail?: unknown } | null)?.detail;
        const message = error.status === 401
          ? "Incorrect email or password. Demo passwords are case-sensitive; choose a role below to fill both fields."
          : typeof detail === "string"
            ? detail
            : "Unable to sign in right now. Check your connection and try again.";
        setLoginError(message);
        toast({ title: "Sign-in failed", description: message, variant: "destructive" });
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
              autoComplete="username"
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          {loginError && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{loginError}</p>}
          <Button type="submit" className="w-full font-bold uppercase tracking-wider" disabled={login.isPending}>
            {login.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
            Sign In
          </Button>
        </form>

        <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 text-center font-semibold tracking-wider uppercase">Demo accounts</p>
          <p className="text-xs text-zinc-500 mt-2 mb-4 text-center">
            Password: <code className="normal-case select-all font-semibold">WakaDemo2026!</code> (case-sensitive).
            <br />Choose a role to fill the form, then select Sign In.
          </p>
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
                  setLoginError("");
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
