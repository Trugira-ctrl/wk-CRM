import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, Dumbbell } from "lucide-react";
import Image from "next/image";

export default function WebsitePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center bg-zinc-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40">
           <Image src="/images/hero.jpg" alt="Hero" fill className="object-cover" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-display font-bold uppercase tracking-tighter mb-6">
            Train with Purpose
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto mb-10 font-light">
            Kigali's premier fitness destination. State-of-the-art equipment, expert coaching, and a community built on progress.
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
            More than just a gym. WAKA is a meticulously designed environment for those who take their health seriously. With three locations across Kigali, we offer unparalleled access to world-class facilities.
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
              { num: 1, desc: "Our flagship location featuring advanced access control and premium strength zones.", img: "/images/branch1.jpg" },
              { num: 2, desc: "Full-service facility with dedicated cardio and functional training areas.", img: "/images/branch2.jpg" },
              { num: 3, desc: "Modern cardio zone with state-of-the-art equipment and mixed fitness.", img: "/images/branch3.jpg" }
            ].map((branch) => (
              <div key={branch.num} className="bg-white border border-zinc-200 p-6 text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-display font-bold uppercase tracking-widest mb-2">Branch {branch.num}</h3>
                <p className="text-sm text-zinc-500 mb-6">
                  {branch.desc}
                </p>
                <div className="w-full h-40 relative overflow-hidden bg-zinc-100">
                  <Image src={branch.img} alt={`Branch ${branch.num}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Memberships Section */}
      <section id="memberships" className="py-24 bg-zinc-950 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-center mb-4">Membership Plans</h2>
          <p className="text-zinc-400 text-center mb-16 max-w-xl mx-auto">Access to all branches. No hidden fees.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: "Monthly", price: "XX,XXX", desc: "Flexible rolling access" },
              { name: "Quarterly", price: "XX,XXX", desc: "Commit to your goals", popular: true },
              { name: "Annual", price: "XXX,XXX", desc: "Maximum value for regulars" }
            ].map((plan) => (
              <div key={plan.name} className={`border ${plan.popular ? 'border-white bg-zinc-900' : 'border-zinc-800 bg-zinc-950'} p-8 relative flex flex-col`}>
                {plan.popular && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1">Most Popular</div>}
                <div className="text-sm text-zinc-400 uppercase tracking-widest font-bold mb-4">{plan.name}</div>
                <div className="text-3xl font-display font-bold mb-2">{plan.price} <span className="text-sm font-sans text-zinc-500 font-normal">RWF</span></div>
                <p className="text-sm text-zinc-400 mb-8">{plan.desc}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-center text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 mr-3 text-white" /> Full gym access</li>
                  <li className="flex items-center text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 mr-3 text-white" /> Free classes</li>
                  <li className="flex items-center text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 mr-3 text-white" /> Digital Check-in</li>
                </ul>
                <Link href="/join">
                  <Button className={`w-full rounded-none font-bold uppercase tracking-widest h-12 ${plan.popular ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}>
                    Select Plan
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coaches Section */}
      <section id="coaches" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-center mb-16">Expert Coaching</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Alex', role: 'Strength & Conditioning', img: "/images/coach1.jpg" },
              { name: 'Sarah', role: 'HIIT Specialist', img: "/images/coach2.jpg" },
              { name: 'David', role: 'Personal Trainer', img: "/images/coach3.jpg" },
              { name: 'Grace', role: 'Mobility & Core', img: "/images/coach4.jpg" }
            ].map((coach, i) => (
              <div key={i} className="group cursor-pointer">
                <div className="aspect-[3/4] bg-zinc-100 mb-4 overflow-hidden relative border border-zinc-200">
                  <Image src={coach.img} alt={coach.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <h4 className="font-display font-bold uppercase tracking-widest text-lg">Coach {coach.name}</h4>
                <p className="text-sm text-zinc-500 uppercase tracking-widest text-[10px] font-bold mt-1">
                  {coach.role}
                </p>
                <div className="text-[10px] text-zinc-300 italic mt-1 font-mono">Fictional Example</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories Section */}
      <section id="stories" className="py-24 bg-zinc-50 border-t border-zinc-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold uppercase tracking-tight mb-16">Member Stories / Transformations</h2>
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
