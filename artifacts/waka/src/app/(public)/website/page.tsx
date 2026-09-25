import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MapPin, Dumbbell } from "lucide-react";
import { PublicPlans } from "./public-plans";
import Image from "next/image";

export default function WebsitePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center bg-zinc-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
           <Image src="/images/hero.jpg" alt="Illustrative generated gym scene, not an actual WAKA facility" fill className="object-cover" />
        </div>
        <div className="absolute bottom-4 right-4 z-10 text-[10px] font-mono uppercase tracking-widest text-zinc-300 bg-black/60 px-2 py-1">Illustrative generated image — not an actual WAKA facility</div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-display font-bold uppercase tracking-tighter mb-6">
            Train with Purpose
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto mb-10 font-light">
            A demonstration fitness concept for three Kigali branches. Strength, conditioning and coaching, presented here as a proof of concept.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/join">
              <Button size="lg" className="rounded-none font-bold uppercase tracking-widest bg-white text-black hover:bg-zinc-200 h-14 px-8 text-sm w-full sm:w-auto">
                Join WAKA Today
              </Button>
            </Link>
            <Link href="#memberships">
              <Button size="lg" variant="outline" className="rounded-none font-bold uppercase tracking-widest border-white text-white hover:bg-white hover:text-black h-14 px-8 text-sm w-full sm:w-auto">
                Explore Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-white text-zinc-950">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl font-display font-bold uppercase tracking-tight mb-6">About WAKA</h2>
          <p className="text-lg text-zinc-600 leading-relaxed mb-8">
            More than just a gym. WAKA is a meticulously designed environment for those who take their health seriously. This proof-of-concept site describes three Kigali branches; addresses, facilities and amenities shown here are placeholders pending confirmation by WAKA.
          </p>
          <p className="text-sm text-zinc-500 uppercase tracking-widest font-bold">Premium Strength • Functional Training • Advanced Cardio</p>
        </div>
      </section>

      {/* Branches Section */}
      <section id="branches" className="py-24 bg-zinc-50 border-y border-zinc-100">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-center mb-16">Our Locations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: 1, desc: "Demo gated branch with a simulated speedgate (hardware not integrated).", img: "/images/branch1.jpg" },
              { num: 2, desc: "Demo reception branch with staff-assisted check-in.", img: "/images/branch2.jpg" },
              { num: 3, desc: "Demo reception branch with staff-assisted check-in.", img: "/images/branch3.jpg" }
            ].map((branch) => (
              <div key={branch.num} className="bg-white border border-zinc-200 p-6 text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-display font-bold uppercase tracking-widest mb-2">Branch {branch.num}</h3>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-2">Location not yet verified</p>
                <p className="text-sm text-zinc-500 mb-6">
                  {branch.desc}
                </p>
                <div className="w-full h-40 relative overflow-hidden bg-zinc-100">
                  <Image src={branch.img} alt={`Illustrative generated image for Branch ${branch.num}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-mono uppercase tracking-widest px-2 py-1">Illustrative image — not the actual branch</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicPlans />

      {/* Coaches Section */}
      <section id="coaches" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-center mb-4">Example Coaching Roles</h2>
          <p className="text-center text-sm text-zinc-500 mb-16 max-w-xl mx-auto">Fictional example coaches. Photos are illustrative generated images, not actual WAKA staff.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Alex', role: 'Strength & Conditioning', img: "/images/coach1.jpg" },
              { name: 'Sarah', role: 'HIIT Specialist', img: "/images/coach2.jpg" },
              { name: 'David', role: 'Personal Trainer', img: "/images/coach3.jpg" },
              { name: 'Grace', role: 'Mobility & Core', img: "/images/coach4.jpg" }
            ].map((coach, i) => (
              <div key={i} className="group">
                <div className="aspect-[3/4] bg-zinc-100 mb-4 overflow-hidden relative border border-zinc-200">
                  <Image src={coach.img} alt={`Illustrative generated portrait for fictional coach ${coach.name}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-mono uppercase tracking-widest px-2 py-1">Illustrative — not a real WAKA coach</div>
                </div>
                <h4 className="font-display font-bold uppercase tracking-widest text-lg">Coach {coach.name} (Example)</h4>
                <p className="text-sm text-zinc-500 uppercase tracking-widest text-[10px] font-bold mt-1">
                  {coach.role}
                </p>
                <div className="text-[10px] text-zinc-500 italic mt-1 font-mono">Fictional example person</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories Section */}
      <section id="stories" className="py-24 bg-zinc-50 border-t border-zinc-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold uppercase tracking-tight mb-16">Example Member Story</h2>
          <div className="max-w-4xl mx-auto bg-white border border-zinc-200 p-8 md:p-12 relative shadow-sm">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-zinc-900 flex items-center justify-center rounded-full text-white">
              <Dumbbell className="w-5 h-5" />
            </div>
            <p className="text-lg md:text-xl font-medium leading-relaxed italic mb-8 mt-4">
              "Joining WAKA completely changed my approach to fitness. The equipment is top-tier, but it's the community and the atmosphere that keeps me coming back every single day. I lost 15kg in 6 months and have never felt stronger."
            </p>
            <div className="font-bold uppercase tracking-widest">Fictional Member Story</div>
            <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold text-red-500 bg-red-50 inline-block px-2 py-1 rounded">
              ILLUSTRATIVE EXAMPLE — NOT A REAL TESTIMONIAL
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
