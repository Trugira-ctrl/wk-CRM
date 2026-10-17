"use client";

import { useGetSession, useLogout, getGetSessionQueryKey } from "@workspace/api-client-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Users, CheckSquare, Shield, Bell, HardDrive, CreditCard, Settings, UserCircle, Menu, X, Workflow } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { WakaWordmark } from "@/components/brand/wordmark";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { data: session, isLoading } = useGetSession();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!session || !session.user)) {
      router.push("/");
      return;
    }

    if (!isLoading && session?.user) {
      const role = session.user.role;
      const isStaff = role === "ADMIN" || role === "MANAGEMENT" || role === "RECEPTION";
      
      if (role === "MEMBER" && !pathname.startsWith("/portal")) {
        router.push("/portal");
      } else if (!isStaff && !pathname.startsWith("/portal")) {
        router.push("/portal");
      } else if (role !== "ADMIN" && (pathname.startsWith("/migration") || pathname.startsWith("/settings") || pathname.startsWith("/momo-sandbox"))) {
        router.push("/dashboard");
      }
    }
  }, [session, isLoading, router, pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading || !session?.user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const role = session.user.role;
  const staffRole = role === "ADMIN" || role === "MANAGEMENT" || role === "RECEPTION";
  const forbidden =
    ((role === "MEMBER" || !staffRole) && !pathname.startsWith("/portal")) ||
    (role !== "ADMIN" && (pathname.startsWith("/migration") || pathname.startsWith("/settings") || pathname.startsWith("/momo-sandbox")));
  if (forbidden) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500 uppercase tracking-widest">Redirecting...</div>;
  }
  const isStaff = role === "ADMIN" || role === "MANAGEMENT" || role === "RECEPTION";
  const isAdmin = role === "ADMIN";
  const isMember = role === "MEMBER";

  const staffNav = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Members", href: "/members", icon: Users },
    { name: "Check-ins", href: "/checkins", icon: CheckSquare },
    { name: "Gate Simulator", href: "/gate", icon: Shield },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Wallets", href: "/wallet", icon: CreditCard },
    { name: "Automations", href: "/automations", icon: Workflow },
  ];

  const adminNav = [
    { name: "MoMo Sandbox", href: "/momo-sandbox", icon: CreditCard },
    { name: "Migration", href: "/migration", icon: HardDrive },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const memberNav = [
    { name: "My Portal", href: "/portal", icon: UserCircle },
  ];

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.cancelQueries();
        queryClient.clear();
        queryClient.setQueryData(getGetSessionQueryKey(), { user: null, demo_mode: true });
        router.push("/");
      },
      onError: () => {
        toast({ title: "Logout failed", variant: "destructive" });
      }
    });
  };

  const NavLinks = () => (
    <>
      {isStaff && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 mt-4 px-2">Operations</div>
          {staffNav.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-zinc-800 text-white" : "hover:bg-zinc-800/50 hover:text-white"}`}>
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </>
      )}

      {isAdmin && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 mt-8 px-2">Administration</div>
          {adminNav.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-zinc-800 text-white" : "hover:bg-zinc-800/50 hover:text-white"}`}>
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </>
      )}

      {isMember && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 mt-4 px-2">Self Service</div>
          {memberNav.map(item => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-zinc-800 text-white" : "hover:bg-zinc-800/50 hover:text-white"}`}>
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-zinc-900 text-zinc-300 flex items-center justify-between p-4 flex-shrink-0">
        <Link href={isStaff ? "/dashboard" : "/portal"}>
          <WakaWordmark className="text-2xl text-white" />
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1">
          {mobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
        </button>
      </div>

      {/* Mobile Overlay Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-zinc-900 text-zinc-300 pt-16 flex flex-col h-[100dvh]">
          <div className="p-6 border-b border-zinc-800">
            <div className="text-xs font-mono text-zinc-500">{session.user.name} ({role})</div>
            {session.demo_mode && (
              <div className="mt-1 inline-block px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold uppercase tracking-widest border border-yellow-500/20">
                Demo Mode
              </div>
            )}
          </div>
          <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
            <NavLinks />
          </nav>
          <div className="p-4 mt-auto border-t border-zinc-800">
            <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800 border-none" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-zinc-900 text-zinc-300 flex-col flex-shrink-0">
        <div className="p-6">
          <Link href={isStaff ? "/dashboard" : "/portal"}>
            <WakaWordmark className="text-3xl text-white" />
          </Link>
          <div className="mt-2 text-xs font-mono text-zinc-500">{session.user.name} ({role})</div>
          {session.demo_mode && (
            <div className="mt-1 inline-block px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold uppercase tracking-widest border border-yellow-500/20">
              Demo Mode
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="p-4 mt-auto">
          <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800 border-none" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
