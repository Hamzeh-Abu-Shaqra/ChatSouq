"use client";

import { useRouter } from "next/navigation";

const CATEGORIES = [
  { icon: "🍽", name: "Restaurants",    desc: "Dine anywhere in Amman",   count: "1,200+", href: "/restaurants", color: "#FEF3C7" },
  { icon: "☕", name: "Cafés",          desc: "Coffee, pastries & more",  count: "300+",   href: "/chat?q=best cafes in Amman", color: "#F0FDF4" },
  { icon: "🎁", name: "Gifts",          desc: "For every occasion",       count: "30k+",   href: "/gifts",       color: "#FDF4FF" },
  { icon: "💪", name: "Gyms & Fitness", desc: "Train your way",           count: "140+",   href: "/gyms",        color: "#EFF6FF" },
  { icon: "✂️", name: "Salons & Beauty",desc: "Look and feel great",      count: "200+",   href: "/salons",      color: "#FFF1F2" },
  { icon: "🎭", name: "Experiences",    desc: "Events & activities",      count: "80+",    href: "/experiences", color: "#F0F9FF" },
  { icon: "🛍", name: "Shopping",       desc: "Local shops & boutiques",  count: "500+",   href: "/shopping",    color: "#FAFAF5" },
  { icon: "🏥", name: "Clinics",        desc: "Healthcare in Amman",      count: "400+",   href: "/chat?q=best clinics and doctors in Amman", color: "#F0FFF4" },
  { icon: "🏨", name: "Hotels",         desc: "Where to stay in Amman",   count: "180+",   href: "/chat?q=best hotels in Amman", color: "#FFFBEB" },
  { icon: "🕌", name: "Cultural",       desc: "Heritage & landmarks",     count: "50+",    href: "/chat?q=cultural sites and heritage in Amman", color: "#FFF7ED" },
  { icon: "🎓", name: "Education",      desc: "Schools & training",       count: "200+",   href: "/chat?q=schools and educational centres in Amman", color: "#F5F3FF" },
  { icon: "🔧", name: "Services",       desc: "Local professionals",      count: "600+",   href: "/chat?q=local services and professionals in Amman", color: "#F9FAFB" },
];

const NEIGHBORHOODS = [
  { name: "Abdoun",         desc: "Upscale restaurants, embassies, premium gyms" },
  { name: "Sweifieh",       desc: "Shopping malls, salons, busy café scene" },
  { name: "Weibdeh",        desc: "Art galleries, independent cafés, boutiques" },
  { name: "Rainbow Street", desc: "Food, nightlife, weekend markets, culture" },
  { name: "Abdali",         desc: "Modern mall, cinemas, new Amman hub" },
  { name: "Shmeisani",      desc: "Business district, classic restaurants" },
  { name: "Downtown",       desc: "Souks, street food, Roman landmarks" },
  { name: "Jabal Amman",    desc: "Quieter cafés, heritage architecture" },
];

export default function BrowsePage() {
  const router = useRouter();

  function go(href: string) {
    router.push(href);
  }

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 pb-20">
        {/* Header */}
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "#C9A84C" }}>
          ◆ Browse
        </p>
        <h1 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-2">
          Explore Amman
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-10">
          Browse by category or neighbourhood — or ask ChatSouq anything.
        </p>

        {/* Categories grid */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ By category
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-14">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => go(cat.href)}
              className="text-left rounded-xl p-4 transition-all duration-150 bg-white"
              style={{ border: "0.5px solid #E8E4DC" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#C9A84C";
                el.style.background = "#FBF4E3";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#E8E4DC";
                el.style.background = "#fff";
              }}
            >
              <div className="text-[24px] mb-2">{cat.icon}</div>
              <p className="text-[13px] font-medium text-[#1A1A1A] mb-0.5">{cat.name}</p>
              <p className="text-[11px] text-[#9ca3af]">{cat.count} in Amman</p>
            </button>
          ))}
        </div>

        {/* Neighbourhoods */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ By neighbourhood
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {NEIGHBORHOODS.map((n) => (
            <button
              key={n.name}
              onClick={() => router.push(`/chat?q=${encodeURIComponent(`Best places in ${n.name}, Amman`)}`)}
              className="text-left bg-white rounded-xl px-4 py-3 transition-all"
              style={{ border: "0.5px solid #E8E4DC" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#C9A84C";
                el.style.background = "#FBF4E3";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#E8E4DC";
                el.style.background = "#fff";
              }}
            >
              <p className="text-[13px] font-medium text-[#1A1A1A] mb-0.5">{n.name}</p>
              <p className="text-[11px] text-[#9ca3af] leading-relaxed">{n.desc}</p>
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-14 text-center pt-10" style={{ borderTop: "0.5px solid #E8E4DC" }}>
          <p className="text-[14px] text-[#6B7280] mb-4">
            Can&apos;t find what you&apos;re looking for?
          </p>
          <button
            onClick={() => router.push("/chat")}
            className="px-6 py-3 rounded-lg text-[14px] font-medium text-white transition-all"
            style={{ background: "#C9A84C" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
          >
            Ask ChatSouq →
          </button>
        </div>
      </div>
    </div>
  );
}
