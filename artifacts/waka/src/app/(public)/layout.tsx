import Link from "next/link";
import { WakaWordmark } from "@/components/brand/wordmark";
import { RevealObserver } from "@/components/brand/reveal-observer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--waka-bone))] text-[hsl(var(--waka-ink))] flex flex-col">
      <RevealObserver />
      <header className="sticky top-0 z-50 bg-[hsl(var(--waka-ink))] text-white border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/website" className="text-3xl hover:text-[hsl(var(--waka-steel))] transition-colors"><WakaWordmark /></Link>
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            <Link href="/website#memberships" className="hover:text-white transition-colors">Memberships</Link>
            <Link href="/website#coaches" className="hover:text-white transition-colors">Coaches</Link>
            <Link href="/website#branches" className="hover:text-white transition-colors">Branches</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden sm:inline-flex h-10 items-center px-4 text-xs font-bold uppercase tracking-[0.2em] text-white/70 hover:text-white">Member Login</Link>
            <Link href="/join" className="inline-flex h-10 items-center px-5 text-xs font-bold uppercase tracking-[0.2em] bg-[hsl(var(--waka-steel))] text-[hsl(var(--waka-ink))] hover:bg-white transition-colors">Join WAKA</Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-[hsl(var(--waka-ink))] text-white/55 pt-16 pb-10 text-sm overflow-hidden">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <WakaWordmark className="text-5xl text-white mb-4" />
            <p className="text-xs leading-relaxed">Demonstration fitness concept for three Kigali branches. All prices, payments and people shown are illustrative.</p>
          </div>
          <div>
            <div className="font-bold uppercase tracking-[0.2em] text-[hsl(var(--waka-steel))] mb-4 text-xs">Locations</div>
            <ul className="space-y-2 text-xs"><li>Branch 1 (Gated)</li><li>Branch 2</li><li>Branch 3</li></ul>
          </div>
          <div>
            <div className="font-bold uppercase tracking-[0.2em] text-[hsl(var(--waka-steel))] mb-4 text-xs">Links</div>
            <ul className="space-y-2 text-xs">
              <li><Link href="/website#memberships" className="hover:text-white">Memberships</Link></li>
              <li><Link href="/website#coaches" className="hover:text-white">Coaches</Link></li>
              <li><Link href="/website#stories" className="hover:text-white">Member Stories</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-bold uppercase tracking-[0.2em] text-[hsl(var(--waka-steel))] mb-4 text-xs">Connect</div>
            <ul className="space-y-2 text-xs">
              <li aria-disabled="true" className="cursor-default">Instagram <span className="text-white/30">— placeholder, destination unconfirmed</span></li>
              <li aria-disabled="true" className="cursor-default">WhatsApp <span className="text-white/30">— placeholder, destination unconfirmed</span></li>
            </ul>
          </div>
        </div>
        <div aria-hidden className="waka-display waka-outline text-[22vw] leading-none mt-10 -mb-[4vw] select-none text-center">WAKA</div>
        <div className="container mx-auto px-4 pt-6 border-t border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/40">
          Phase 1 proof of concept. Prices are illustrative demo amounts; payments are simulated and no real charge is made.
        </div>
      </footer>
    </div>
  );
}
