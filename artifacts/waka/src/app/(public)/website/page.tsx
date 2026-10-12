import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { PublicPlans } from "./public-plans";

const branches = [
  { num: 1, desc: "Demo gated branch with a simulated speedgate (hardware not integrated).", img: "/images/branch1.jpg" },
  { num: 2, desc: "Demo reception branch with staff-assisted check-in.", img: "/images/branch2.jpg" },
  { num: 3, desc: "Demo reception branch with staff-assisted check-in.", img: "/images/branch3.jpg" },
];
const coaches = [
  { name: "Alex", role: "Strength & Conditioning", img: "/images/coach1.jpg" },
  { name: "Sarah", role: "HIIT Specialist", img: "/images/coach2.jpg" },
  { name: "David", role: "Personal Trainer", img: "/images/coach3.jpg" },
  { name: "Grace", role: "Mobility & Core", img: "/images/coach4.jpg" },
];
const mono = "grayscale contrast-[1.08]";

function Kicker({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em] mb-5 ${light ? "text-[hsl(var(--waka-steel))]" : "text-[hsl(var(--waka-steel-deep))]"}`}>
      <span className="h-px w-10 bg-current" />{children}
    </div>
  );
}

export default function WebsitePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[92dvh] flex items-end bg-[hsl(var(--waka-ink))] text-white overflow-hidden">
        <div className="absolute inset-0 waka-zoom">
          <Image src="/images/hero.jpg" alt="Illustrative generated gym scene, not an actual WAKA facility" fill priority sizes="100vw" className={`object-cover object-center opacity-55 ${mono}`} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--waka-ink))] via-[hsl(var(--waka-ink)/0.45)] to-transparent" />
        <div className="absolute bottom-4 right-4 z-10 text-[10px] font-mono uppercase tracking-widest text-white/70 bg-black/60 px-2 py-1">Illustrative generated image — not an actual WAKA facility</div>
        <div className="relative z-10 container mx-auto px-4 pb-20 pt-32">
          <div className="waka-slide"><Kicker light>Kigali / Strength / Conditioning</Kicker></div>
          <h1 className="waka-display text-[19vw] md:text-[13.5vw] 2xl:text-[13rem] mb-8">
            <span className="block waka-rise">Train</span>
            <span className="block waka-rise waka-steel" style={{ animationDelay: "120ms" }}>With Purpose</span>
          </h1>
          <div className="h-1 w-40 bg-[hsl(var(--waka-steel))] mb-8 waka-bar" />
          <div className="grid md:grid-cols-[1fr_auto] gap-8 items-end">
            <p className="text-lg md:text-xl text-white/75 max-w-xl">
              A demonstration fitness concept for three Kigali branches. Strength, conditioning and coaching, presented here as a proof of concept.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/join" className="waka-btn inline-flex h-14 items-center justify-center gap-3 px-8 bg-white text-[hsl(var(--waka-ink))] font-bold uppercase tracking-[0.2em] text-sm hover:bg-[hsl(var(--waka-steel))] transition-colors">
                Join WAKA Today <ArrowRight className="w-4 h-4 waka-arrow" />
              </Link>
              <Link href="#memberships" className="inline-flex h-14 items-center justify-center px-8 border border-white/40 font-bold uppercase tracking-[0.2em] text-sm hover:bg-white hover:text-[hsl(var(--waka-ink))] transition-colors">
                Explore Plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker band (static) */}
      <div className="bg-[hsl(var(--waka-steel))] text-[hsl(var(--waka-ink))] overflow-hidden whitespace-nowrap py-3">
        <div className="waka-display text-2xl md:text-3xl flex gap-10 justify-center">
          <span>Premium Strength</span><span className="opacity-40">/</span><span>Functional Training</span><span className="opacity-40 hidden sm:inline">/</span><span className="hidden sm:inline">Advanced Cardio</span>
        </div>
      </div>

      {/* About */}
      <section id="about" className="py-28">
        <div className="container mx-auto px-4 grid md:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <h2 data-reveal className="waka-display text-6xl md:text-8xl">More than<br /><span className="waka-steel">just a gym.</span></h2>
          <div data-reveal style={{ ["--d" as string]: 1 }}>
            <Kicker>About WAKA</Kicker>
            <p className="text-lg text-[hsl(var(--waka-ink)/0.7)] leading-relaxed">
              WAKA is a meticulously designed environment for those who take their health seriously. This proof-of-concept site describes three Kigali branches; addresses, facilities and amenities shown here are placeholders pending confirmation by WAKA.
            </p>
          </div>
        </div>
      </section>

      {/* Branches */}
      <section id="branches" className="py-28 bg-white/60 border-y border-[hsl(var(--waka-ink)/0.08)]">
        <div className="container mx-auto px-4">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-4 mb-14">
            <div><Kicker>Three branches</Kicker><h2 className="waka-display text-6xl md:text-7xl">Our Locations</h2></div>
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-[hsl(var(--waka-ink)/0.5)]">Locations not yet verified</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {branches.map((b, i) => (
              <article key={b.num} data-reveal style={{ ["--d" as string]: i }} className="waka-card group bg-[hsl(var(--waka-ink))] text-white">
                <div className="relative h-64 overflow-hidden">
                  <Image src={b.img} alt={`Illustrative generated image for Branch ${b.num}`} fill sizes="(min-width: 768px) 33vw, 100vw" className={`waka-img object-cover opacity-80 ${mono}`} />
                  <span className="absolute top-3 left-4 waka-display text-7xl waka-outline">0{b.num}</span>
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-mono uppercase tracking-widest px-2 py-1">Illustrative image — not the actual branch</div>
                </div>
                <div className="p-6 border-t-4 border-[hsl(var(--waka-steel))]">
                  <h3 className="waka-display text-4xl mb-2">Branch {b.num}</h3>
                  <p className="text-[10px] text-[hsl(var(--waka-steel))] uppercase tracking-[0.2em] font-bold mb-3">Location not yet verified</p>
                  <p className="text-sm text-white/65">{b.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PublicPlans />

      {/* Coaches */}
      <section id="coaches" className="py-28">
        <div className="container mx-auto px-4">
          <div data-reveal className="mb-14">
            <Kicker>Coaching</Kicker>
            <h2 className="waka-display text-6xl md:text-7xl mb-4">Example Coaching Roles</h2>
            <p className="text-sm text-[hsl(var(--waka-ink)/0.6)] max-w-xl">Fictional example coaches. Photos are illustrative generated images, not actual WAKA staff.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {coaches.map((c, i) => (
              <div key={c.name} data-reveal style={{ ["--d" as string]: i }} className="waka-card group">
                <div className="aspect-[3/4] mb-4 overflow-hidden relative bg-[hsl(var(--waka-charcoal))]">
                  <Image src={c.img} alt={`Illustrative generated portrait for fictional coach ${c.name}`} fill sizes="(min-width: 768px) 25vw, (min-width: 640px) 50vw, 100vw" className={`waka-img object-cover ${mono}`} />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-mono uppercase tracking-widest px-2 py-1">Illustrative — not a real WAKA coach</div>
                </div>
                <h4 className="waka-display text-3xl">Coach {c.name} <span className="text-base not-italic font-bold text-[hsl(var(--waka-ink)/0.45)]">(Example)</span></h4>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold mt-2 text-[hsl(var(--waka-steel-deep))]">{c.role}</p>
                <div className="text-[10px] text-[hsl(var(--waka-ink)/0.5)] italic mt-1 font-mono">Fictional example person</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section id="stories" className="py-28 bg-[hsl(var(--waka-charcoal))] text-white">
        <div data-reveal className="container mx-auto px-4 max-w-5xl">
          <Kicker light>Example Member Story</Kicker>
          <blockquote className="waka-display text-4xl md:text-6xl leading-[0.95] mb-10">
            &ldquo;Joining WAKA completely changed my approach to fitness. <span className="waka-steel">I lost 15kg in 6 months and have never felt stronger.</span>&rdquo;
          </blockquote>
          <p className="text-white/60 max-w-2xl mb-8">The equipment is top-tier, but it&apos;s the community and the atmosphere that keeps me coming back every single day.</p>
          <div className="font-bold uppercase tracking-[0.2em] text-sm">Fictional Member Story</div>
          <div className="mt-2 inline-block border border-amber-400/60 text-amber-300 text-[10px] font-bold uppercase tracking-widest px-2 py-1">
            Illustrative example — not a real testimonial
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-24 bg-[hsl(var(--waka-ink))] text-white">
        <div data-reveal className="container mx-auto px-4 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <h2 className="waka-display text-6xl md:text-8xl">Show up.<br /><span className="waka-steel">Stay strong.</span></h2>
          <Link href="/join" className="waka-btn inline-flex h-14 items-center justify-center gap-3 px-8 bg-[hsl(var(--waka-steel))] text-[hsl(var(--waka-ink))] font-bold uppercase tracking-[0.2em] text-sm hover:bg-white transition-colors">
            Join WAKA <ArrowRight className="w-4 h-4 waka-arrow" />
          </Link>
        </div>
      </section>
    </div>
  );
}
