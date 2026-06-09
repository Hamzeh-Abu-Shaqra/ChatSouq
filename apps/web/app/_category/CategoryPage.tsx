"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "../../components/ui/SearchBar";

interface CategoryPageProps {
  category: string;
  displayName: string;
  heading: string;
  subtext: string;
  aiInsight: string;
  subcategories: string[];
  icon: string;
  count: string;
}

export default function CategoryPage({
  category,
  displayName,
  heading,
  subtext,
  aiInsight,
  subcategories,
  icon,
  count,
}: CategoryPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");

  function search(q: string) {
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      {/* ── CATEGORY HERO ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 pb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#C9A84C" }}>
          ◆ ChatSouq · {displayName}
        </p>
        <h1 className="font-serif text-[2.2rem] font-medium text-[#1A1A1A] mb-3 leading-tight">
          {heading}
        </h1>
        <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6 max-w-[560px]">
          {subtext}
        </p>
        <SearchBar
          size="sm"
          placeholder={`Describe the ${displayName.toLowerCase()} you're looking for…`}
          onSubmit={search}
          className="max-w-[560px]"
        />
      </section>

      {/* ── SUBCATEGORY TABS ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 mb-1">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
          {subcategories.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-shrink-0 text-[13px] px-4 py-1.5 rounded-full transition-all whitespace-nowrap"
              style={
                activeTab === tab
                  ? { background: "#FBF4E3", border: "0.5px solid #E8D5A0", color: "#7A5C10", fontWeight: 500 }
                  : { background: "transparent", border: "0.5px solid #E8E4DC", color: "#6B7280" }
              }
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── AI INSIGHT STRIP ─────────────────────────────────────────────── */}
      <div
        className="mx-auto max-w-3xl px-4 sm:px-6 my-4"
      >
        <div
          className="flex items-start gap-3 rounded-lg px-4 py-3"
          style={{ background: "#FBF4E3", border: "0.5px solid #E8D5A0", borderTop: "0.5px solid #E8D5A0" }}
        >
          <span className="text-[16px] flex-shrink-0 mt-0.5">✦</span>
          <p className="text-[13px] italic leading-relaxed" style={{ color: "#7A5C10" }}>
            {aiInsight}
          </p>
        </div>
      </div>

      {/* ── POPULAR QUERIES ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#C9A84C" }}>
          ◆ Popular searches
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {getPopularQueries(category, activeTab).map((q) => (
            <button
              key={q}
              onClick={() => search(q)}
              className="text-left px-4 py-3 rounded-lg text-[13px] text-[#374151] transition-all bg-white"
              style={{ border: "0.5px solid #E8E4DC" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#C9A84C";
                el.style.background = "#FBF4E3";
                el.style.color = "#7A5C10";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#E8E4DC";
                el.style.background = "#fff";
                el.style.color = "#374151";
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-12 text-center">
        <p className="text-[14px] text-[#6B7280] mb-4">
          {count} verified {displayName.toLowerCase()} across Amman
        </p>
        <button
          onClick={() => search(`Best ${displayName.toLowerCase()} in Amman`)}
          className="px-6 py-3 rounded-lg text-[14px] font-medium text-white transition-all"
          style={{ background: "#C9A84C" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
        >
          Find the best {displayName.toLowerCase()} →
        </button>
      </section>
    </div>
  );
}

// ── Popular queries per category ──────────────────────────────────────────────

function getPopularQueries(category: string, tab: string): string[] {
  const queries: Record<string, string[]> = {
    restaurants: [
      "Best restaurants in Weibdeh for dinner",
      "Romantic restaurant in Abdoun under 60 JOD",
      "Top-rated Jordanian food in Amman",
      "New restaurants that opened in Amman this month",
      "Family-friendly restaurants in Sweifieh",
      "Best buffet in Amman",
    ],
    gifts: [
      "Eid gift for my mother under 50 JOD",
      "Birthday gift for a 25-year-old man who likes tech",
      "Corporate gift ideas in Amman",
      "Best chocolate shops in Amman",
      "Personalized gift ideas for a couple",
      "Flower shops in Amman that deliver",
    ],
    gyms: [
      "Best gym in Abdoun with a pool",
      "Ladies-only gym in Sweifieh",
      "CrossFit gym in Amman",
      "Affordable gym near Shmeisani",
      "Gym with personal trainer in Amman",
      "Yoga studio in Jabal Amman",
    ],
    salons: [
      "Best hair salon in Abdoun for women",
      "Nail salon in Sweifieh",
      "Bridal makeup salon in Amman",
      "Barber shop near 7th Circle",
      "Hair coloring specialist in Amman",
      "Facial and skincare salon in Amman",
    ],
    experiences: [
      "Romantic date night activities in Amman",
      "Family-friendly outdoor activities this weekend",
      "Cultural experiences in Amman for tourists",
      "Food tours in Amman",
      "Outdoor hiking near Amman",
      "Things to do in Amman with kids",
    ],
    shopping: [
      "Best shopping malls in Amman",
      "Local boutique fashion shops in Weibdeh",
      "Electronics shops in Amman",
      "Home decor stores in Amman",
      "Vintage and second-hand shops in Amman",
      "Sports gear shops in Amman",
    ],
  };
  const fallback = queries["restaurants"] ?? [];
  return (queries[category] ?? fallback).slice(0, 6);
}
