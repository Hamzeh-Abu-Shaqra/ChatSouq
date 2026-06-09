"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchBar } from "../components/ui/SearchBar";
import { CategoryChips } from "../components/ui/CategoryChips";

// ── Rotating placeholder queries ──────────────────────────────────────────────
const ROTATING = [
  "Romantic dinner in Weibdeh for two under 60 JOD",
  "أحتاج هدية عيد لأمي تحت ٥٠ دينار",
  "Best gym near Abdoun with a pool",
  "What new restaurants opened in Amman this month?",
  "ايش في عمان هاليوم؟ فعاليات وأماكن جديدة",
  "Family activities in Amman this Friday",
  "Birthday gift for my brother who likes gaming under 40 JOD",
  "Coffee shop in Jabal Amman good for working",
];

// ── Top categories ─────────────────────────────────────────────────────────────
const TOP_CATEGORIES = [
  { icon: "🍽", name: "Restaurants",     desc: "Dine anywhere in Amman",   count: "1,200+ places",  href: "/restaurants" },
  { icon: "🎁", name: "Gifts",           desc: "For every occasion",       count: "30k+ products",  href: "/gifts"       },
  { icon: "💪", name: "Gyms & Fitness",  desc: "Train your way",           count: "140+ gyms",      href: "/gyms"        },
  { icon: "✂️", name: "Salons & Beauty", desc: "Look and feel great",      count: "200+ salons",    href: "/salons"      },
  { icon: "🎭", name: "Experiences",     desc: "Events & activities",      count: "80+ picks",      href: "/experiences" },
  { icon: "🛍", name: "Shopping",        desc: "Local shops & boutiques",  count: "500+ stores",    href: "/shopping"    },
];

// ── How it works ──────────────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  { step: "01", icon: "💬", title: "Describe what you need", body: "In plain language, in English or Arabic. No keywords — just talk." },
  { step: "02", icon: "🔍", title: "ChatSouq searches Jordan", body: "Real-time search across 82,000+ verified Amman listings." },
  { step: "03", icon: "⭐", title: "Get the best match, explained", body: "Ranked by relevance, with a clear reason why each fits you." },
];

export default function HomePage() {
  const router = useRouter();

  function go(q: string) {
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="bg-[#F9F8F6]">
      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <Hero onSearch={go} />

      {/* ── TODAY IN AMMAN ─────────────────────────────────────────────────── */}
      <TodaySection onSearch={go} />

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <HowItWorksSection />

      {/* ── TOP CATEGORIES ─────────────────────────────────────────────────── */}
      <TopCategoriesSection />

      {/* ── TRUST STRIP ─────────────────────────────────────────────────────── */}
      <TrustStrip />
    </div>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────

function Hero({ onSearch }: { onSearch: (q: string) => void }) {
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setPlaceholderIdx((i) => (i + 1) % ROTATING.length);
        setVisible(true);
      }, 300);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const currentPlaceholder = ROTATING[placeholderIdx] ?? ROTATING[0]!;

  return (
    <section className="min-h-[100svh] md:min-h-screen flex items-center justify-center px-4 pb-16" style={{ minHeight: "85svh" }}>
      <div className="w-full max-w-[680px] mx-auto text-center">
        {/* Eyebrow */}
        <p
          className="text-[11px] font-bold uppercase tracking-[0.16em] mb-6"
          style={{ color: "#C9A84C" }}
        >
          ◆ ChatSouq · Amman, Jordan
        </p>

        {/* Headline */}
        <h1
          className="font-serif leading-[1.15] mb-4"
          style={{ fontSize: "clamp(2.4rem, 6vw, 3.5rem)", fontWeight: 500 }}
        >
          <span style={{ color: "#1A1A1A" }}>Ask anything.</span>
          <br />
          <span style={{ color: "#1A1A1A" }}>Find the best</span>
          <br />
          <span style={{ color: "#C9A84C" }}>in Jordan.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mx-auto mb-8 leading-[1.7]"
          style={{ color: "#6B7280", fontSize: "16px", maxWidth: "480px" }}
        >
          Jordan&apos;s AI recommendation engine. Restaurants, gifts, services,
          experiences — described in plain language, ranked by relevance.
        </p>

        {/* SearchBar */}
        <div className="mb-5">
          <SearchBar
            size="lg"
            placeholder={currentPlaceholder}
            onSubmit={onSearch}
            className={`transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
          />
        </div>

        {/* Category chips */}
        <CategoryChips
          className="justify-center"
          onSelect={(chip) => chip.query && onSearch(chip.query)}
        />

        {/* Scroll indicator */}
        <div className="mt-16 flex justify-center">
          <ChevronDown />
        </div>
      </div>
    </section>
  );
}

// ── TODAY IN AMMAN ────────────────────────────────────────────────────────────

function TodaySection({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
      <div className="mb-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#C9A84C" }}>
          ◆ Today in Amman
        </p>
        <h2 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-2">
          What to know, where to go
        </h2>
        <p className="text-[14px] text-[#6B7280]">
          Updated daily based on Amman&apos;s latest openings, events, and offers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* New openings */}
        <TodayCard
          label="NEW THIS WEEK"
          labelColor="#059669"
        >
          <ul className="space-y-3">
            {[
              { name: "Leila Amman",       cat: "Lebanese restaurant",  area: "Rainbow Street" },
              { name: "Blend & Grind",     cat: "Specialty coffee",     area: "Abdoun"         },
              { name: "The Loft Studio",   cat: "Pilates & yoga",       area: "Sweifieh"       },
              { name: "Baklawa District",  cat: "Sweets & pastries",    area: "Jabal Amman"    },
            ].map((item) => (
              <li key={item.name} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-3 flex-shrink-0 rounded-full" style={{ background: "#E8D5A0" }} />
                <div>
                  <p className="text-[13px] font-medium text-[#1A1A1A]">{item.name}</p>
                  <p className="text-[11px] text-[#9ca3af]">{item.cat} · {item.area}</p>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => onSearch("New restaurant and cafe openings in Amman this week")}
            className="mt-4 text-[12px] font-medium"
            style={{ color: "#C9A84C" }}
          >
            See all new openings →
          </button>
        </TodayCard>

        {/* Featured offer */}
        <TodayCard label="FEATURED OFFER" labelColor="#C9A84C">
          <div className="space-y-2">
            <p className="font-serif text-[17px] font-medium text-[#1A1A1A]">Sekrab Amman</p>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">
              20% off the full menu every Sunday — dine in only. Valid through end of month.
            </p>
            <p className="text-[11px] text-[#9ca3af]">Downtown Amman · Valid until June 30</p>
          </div>
          <button
            onClick={() => onSearch("Best restaurant deals and offers in Amman this week")}
            className="mt-5 px-4 py-2 text-[13px] font-medium text-[#1A1A1A] rounded-lg transition-all"
            style={{ border: "0.5px solid #E8E4DC" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E8E4DC"; }}
          >
            View offer
          </button>
        </TodayCard>

        {/* This weekend */}
        <TodayCard label="THIS WEEKEND" labelColor="#7c3aed">
          <ul className="space-y-3">
            {[
              { name: "Amman Design Week",   date: "Fri–Sun",  loc: "Rainbow Street"   },
              { name: "Souk Jara",           date: "Friday",   loc: "3rd Circle"       },
              { name: "Comedy Night — Zara", date: "Saturday", loc: "Abdali Boulevard" },
              { name: "Art Trail Weibdeh",   date: "Sunday",   loc: "Weibdeh"          },
            ].map((item) => (
              <li key={item.name} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-3 flex-shrink-0 rounded-full" style={{ background: "#ede9fe" }} />
                <div>
                  <p className="text-[13px] font-medium text-[#1A1A1A]">{item.name}</p>
                  <p className="text-[11px] text-[#9ca3af]">{item.date} · {item.loc}</p>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => onSearch("Things to do in Amman this weekend — activities and events")}
            className="mt-4 text-[12px] font-medium"
            style={{ color: "#C9A84C" }}
          >
            Explore activities →
          </button>
        </TodayCard>
      </div>
    </section>
  );
}

function TodayCard({
  label,
  labelColor,
  children,
}: {
  label: string;
  labelColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col"
      style={{ border: "0.5px solid #E8E4DC" }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.16em] mb-4"
        style={{ color: labelColor }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

// ── HOW IT WORKS ──────────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-10 text-center" style={{ color: "#C9A84C" }}>
        ◆ How it works
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
        {HOW_IT_WORKS.map((step) => (
          <div key={step.step} className="relative text-center md:text-left">
            {/* Large step number */}
            <p
              className="font-serif absolute -top-2 -left-2 select-none pointer-events-none hidden md:block"
              style={{ fontSize: "5rem", color: "#F3F1EE", lineHeight: 1, fontWeight: 500 }}
            >
              {step.step}
            </p>
            <div className="relative z-10">
              <div className="text-[28px] mb-3">{step.icon}</div>
              <h3 className="font-serif text-[1.05rem] font-medium text-[#1A1A1A] mb-2">
                {step.title}
              </h3>
              <p className="text-[13px] text-[#6B7280] leading-relaxed">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── TOP CATEGORIES ────────────────────────────────────────────────────────────

function TopCategoriesSection() {
  const router = useRouter();
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-10" style={{ color: "#C9A84C" }}>
        ◆ Explore by category
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TOP_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => router.push(cat.href)}
            className="group text-left bg-white rounded-xl p-5 transition-all duration-150"
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
            <div className="text-[28px] mb-3">{cat.icon}</div>
            <h3 className="font-serif text-[1rem] font-medium text-[#1A1A1A] mb-1">
              {cat.name}
            </h3>
            <p className="text-[12px] text-[#6B7280] mb-2 truncate">{cat.desc}</p>
            <p className="text-[12px] font-medium" style={{ color: "#C9A84C" }}>{cat.count}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── TRUST STRIP ───────────────────────────────────────────────────────────────

function TrustStrip() {
  return (
    <div className="py-4 text-center" style={{ background: "#F3F1EE" }}>
      <p className="text-[12px] text-[#9ca3af]">
        82,000+ verified listings
        <Dot />Arabic & English
        <Dot />Amman, Jordan
        <Dot />Updated weekly
      </p>
    </div>
  );
}

function Dot() {
  return <span className="mx-3 text-[#D1CBC0]">·</span>;
}

// ── Scroll indicator ──────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-bounce text-[#9ca3af]"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
