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
            <p className="text-xs">Premium fitness in Kigali. Redefining what it means to train.</p>
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
              <li>Memberships</li>
              <li>Coaches</li>
              <li>Member Stories</li>
            </ul>
          </div>
          <div>
            <div className="font-bold uppercase tracking-widest text-white mb-4 text-xs">Connect</div>
            <ul className="space-y-2 text-xs">
              <li>Instagram</li>
              <li>WhatsApp</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
