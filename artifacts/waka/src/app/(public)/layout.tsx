import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/website" className="text-2xl font-display font-bold tracking-tighter uppercase">WAKA</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium uppercase tracking-widest text-zinc-600">
            <Link href="/website#memberships" className="hover:text-zinc-900">Memberships</Link>
            <Link href="/website#coaches" className="hover:text-zinc-900">Coaches</Link>
            <Link href="/website#branches" className="hover:text-zinc-900">Branches</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" className="rounded-none font-bold uppercase tracking-widest text-xs hidden sm:flex">Member Login</Button>
            </Link>
            <Link href="/join">
              <Button className="rounded-none font-bold uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800 text-xs">Join WAKA</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="bg-zinc-950 text-zinc-400 py-12 text-sm">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="text-2xl font-display font-bold tracking-tighter uppercase text-white mb-4">WAKA</div>
            <p className="text-xs">Demonstration fitness concept for three Kigali branches. All prices, payments and people shown are illustrative.</p>
          </div>
          <div>
            <div className="font-bold uppercase tracking-widest text-white mb-4 text-xs">Locations</div>
            <ul className="space-y-2 text-xs">
              <li>Branch 1 (Gated)</li>
              <li>Branch 2</li>
              <li>Branch 3</li>
            </ul>
          </div>
          <div>
            <div className="font-bold uppercase tracking-widest text-white mb-4 text-xs">Links</div>
            <ul className="space-y-2 text-xs">
              <li><Link href="/website#memberships" className="hover:text-white">Memberships</Link></li>
              <li><Link href="/website#coaches" className="hover:text-white">Coaches</Link></li>
              <li><Link href="/website#stories" className="hover:text-white">Member Stories</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-bold uppercase tracking-widest text-white mb-4 text-xs">Connect</div>
            <ul className="space-y-2 text-xs">
              <li aria-disabled="true" className="cursor-default">Instagram <span className="text-zinc-600">— placeholder, destination unconfirmed</span></li>
              <li aria-disabled="true" className="cursor-default">WhatsApp <span className="text-zinc-600">— placeholder, destination unconfirmed</span></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-10 pt-6 border-t border-zinc-800 text-[10px] uppercase tracking-widest text-zinc-500">
          Phase 1 proof of concept. Prices are illustrative demo amounts; payments are simulated and no real charge is made.
        </div>
      </footer>
    </div>
  );
}
