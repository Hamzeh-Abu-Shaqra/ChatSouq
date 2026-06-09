"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "../../components/ui/SearchBar";

const FILTER_CHIPS = ["All", "Restaurants", "Gifts", "Gyms", "Salons", "Experiences"];

export default function SavedPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("All");

  // In production this would load from localStorage / user account
  const savedItems: never[] = [];

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        {/* Header */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#C9A84C" }}>
          ◆ Your saved places
        </p>
        <h1 className="font-serif text-[1.5rem] font-medium text-[#1A1A1A] mb-1">
          Saved Places
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-6">
          {savedItems.length} saved places in Amman
        </p>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-8">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className="flex-shrink-0 text-[13px] px-4 py-1.5 rounded-full transition-all whitespace-nowrap"
              style={
                activeFilter === chip
                  ? { background: "#FBF4E3", border: "0.5px solid #E8D5A0", color: "#7A5C10", fontWeight: 500 }
                  : { background: "transparent", border: "0.5px solid #E8E4DC", color: "#6B7280" }
              }
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {savedItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-[32px] mb-4 text-[#9ca3af]">♡</div>
            <h2 className="font-serif text-[1.2rem] font-medium text-[#1A1A1A] mb-2">
              You haven&apos;t saved anything yet.
            </h2>
            <p className="text-[14px] text-[#6B7280] mb-6">
              Start by searching for something in Amman.
            </p>
            <SearchBar
              size="sm"
              placeholder="Search for places, restaurants, gifts…"
              className="max-w-sm w-full"
              onSubmit={(q: string) => router.push(`/chat?q=${encodeURIComponent(q)}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
