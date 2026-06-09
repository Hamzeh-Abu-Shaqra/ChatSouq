"use client";

import { useRouter } from "next/navigation";
import { SearchBar } from "../../../components/ui/SearchBar";

// ── Mock vendor data (in production: fetched from DB by slug) ─────────────────
const MOCK_VENDOR = {
  name: "Sekrab Amman",
  category: "Restaurant",
  subcategory: "Mediterranean · Jordanian",
  rating: 4.7,
  reviewCount: 312,
  area: "Downtown Amman",
  address: "King Faisal Street, Downtown Amman",
  phone: "+962 6 461 2345",
  hours: "Sun–Thu 12:00–11:00 PM · Fri–Sat 12:00–12:00 AM",
  website: "sekrab.jo",
  priceRange: "20–45 JOD per person",
  description:
    "Sekrab Amman is one of the city's most iconic dining destinations — occupying a restored Ottoman-era building in the heart of Downtown. The menu leans heavily into Levantine classics elevated with modern technique: think slow-cooked lamb mansaf, charcoal chicken tawook, and mezze platters designed for sharing. The rooftop terrace has a sweeping view of the Roman Amphitheatre.",
  highlights: ["Rooftop terrace", "Private dining rooms", "Shisha available", "Accepts reservations", "Halal"],
  tags: ["Romantic", "Group dining", "Business lunch", "Special occasions"],
  images: [] as string[],
  lastVerified: "May 2026",
};

const SIMILAR = [
  { name: "Sufra Restaurant",    area: "Rainbow Street",  cat: "Jordanian cuisine",   rating: 4.6 },
  { name: "Fakhr El-Din",        area: "Umm Uthaina",     cat: "Lebanese · Levantine", rating: 4.8 },
  { name: "Wild Jordan Café",    area: "Jabal Amman",     cat: "Café · Organic",       rating: 4.5 },
  { name: "Joz Hind",           area: "Weibdeh",          cat: "Modern Jordanian",     rating: 4.7 },
];

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < full ? "#C9A84C" : i === full && half ? "#E8D5A0" : "#E8E4DC"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

export default function VendorPage() {
  const router = useRouter();
  const v = MOCK_VENDOR;

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      {/* ── BREADCRUMB ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-0">
        <nav className="flex items-center gap-2 text-[12px] text-[#9ca3af]">
          <button onClick={() => router.push("/")} className="hover:text-[#C9A84C] transition-colors">Home</button>
          <span>›</span>
          <button onClick={() => router.push("/restaurants")} className="hover:text-[#C9A84C] transition-colors">Restaurants</button>
          <span>›</span>
          <span className="text-[#1A1A1A]">{v.name}</span>
        </nav>
      </div>

      {/* ── HERO STRIP ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 pb-8">
        {/* Image placeholder */}
        <div
          className="w-full rounded-xl mb-6 flex items-center justify-center"
          style={{ height: "240px", background: "#F3F1EE", border: "0.5px solid #E8E4DC" }}
        >
          <p className="text-[13px] text-[#9ca3af]">Photos coming soon</p>
        </div>

        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* ── LEFT: Main info ───────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "#C9A84C" }}>
              ◆ {v.category} · {v.area}
            </p>
            <h1 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-2 leading-tight">
              {v.name}
            </h1>
            <div className="flex items-center gap-3 mb-4">
              <StarRating rating={v.rating} />
              <span className="text-[13px] font-medium text-[#1A1A1A]">{v.rating}</span>
              <span className="text-[13px] text-[#6B7280]">({v.reviewCount.toLocaleString()} reviews)</span>
              <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: "#F3F1EE", color: "#6B7280" }}>
                {v.subcategory}
              </span>
            </div>

            {/* Highlights */}
            <div className="flex flex-wrap gap-2 mb-6">
              {v.highlights.map((h) => (
                <span
                  key={h}
                  className="text-[12px] px-3 py-1 rounded-full"
                  style={{ background: "#FBF4E3", border: "0.5px solid #E8D5A0", color: "#7A5C10" }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Description */}
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
                ◆ About
              </p>
              <p className="text-[14px] text-[#374151] leading-relaxed">
                {v.description}
              </p>
            </div>

            {/* Details table */}
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
                ◆ Details
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid #E8E4DC" }}>
                {[
                  { label: "Address",      value: v.address },
                  { label: "Hours",        value: v.hours },
                  { label: "Phone",        value: v.phone },
                  { label: "Price range",  value: v.priceRange },
                  { label: "Website",      value: v.website },
                  { label: "Last verified", value: v.lastVerified },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="flex items-start gap-4 px-4 py-3 bg-white"
                    style={{ borderBottom: i < arr.length - 1 ? "0.5px solid #E8E4DC" : "none" }}
                  >
                    <span className="text-[12px] text-[#9ca3af] w-28 flex-shrink-0 pt-0.5">{row.label}</span>
                    <span className="text-[13px] text-[#1A1A1A]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
                ◆ Best for
              </p>
              <div className="flex flex-wrap gap-2">
                {v.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => router.push(`/chat?q=${encodeURIComponent(`Best places for ${tag} in Amman`)}`)}
                    className="text-[12px] px-3 py-1.5 rounded-full transition-colors"
                    style={{ background: "transparent", border: "0.5px solid #E8E4DC", color: "#6B7280" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#C9A84C";
                      (e.currentTarget as HTMLButtonElement).style.color = "#7A5C10";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#E8E4DC";
                      (e.currentTarget as HTMLButtonElement).style.color = "#6B7280";
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Sticky CTA sidebar ─────────────────────────────────── */}
          <div className="md:w-72 flex-shrink-0">
            <div
              className="sticky top-20 rounded-xl p-5 bg-white"
              style={{ border: "0.5px solid #E8E4DC" }}
            >
              <p className="font-serif text-[1.1rem] font-medium text-[#1A1A1A] mb-1">{v.name}</p>
              <p className="text-[12px] text-[#6B7280] mb-4">{v.area} · {v.priceRange}</p>

              <button
                onClick={() => router.push(`/chat?q=${encodeURIComponent(`Book a table at ${v.name} in Amman`)}`)}
                className="w-full py-3 rounded-lg text-[14px] font-medium text-white mb-3 transition-all"
                style={{ background: "#C9A84C" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
              >
                Ask ChatSouq to book →
              </button>

              <a
                href={`tel:${v.phone}`}
                className="block w-full py-3 text-center rounded-lg text-[13px] font-medium text-[#1A1A1A] transition-all mb-4"
                style={{ border: "0.5px solid #E8E4DC" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#C9A84C"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E8E4DC"; }}
              >
                📞 Call now
              </a>

              <div className="pt-4" style={{ borderTop: "0.5px solid #E8E4DC" }}>
                <p className="text-[11px] text-[#9ca3af] mb-2">Ask ChatSouq about</p>
                {[
                  `What's on the menu at ${v.name}?`,
                  `Is ${v.name} good for a date night?`,
                  `Similar restaurants near ${v.area}`,
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => router.push(`/chat?q=${encodeURIComponent(q)}`)}
                    className="block w-full text-left text-[12px] py-1.5 px-0 transition-colors"
                    style={{ color: "#6B7280" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B7280"; }}
                  >
                    → {q}
                  </button>
                ))}
              </div>

              <div className="pt-4 mt-4" style={{ borderTop: "0.5px solid #E8E4DC" }}>
                <button className="text-[11px] text-[#9ca3af] hover:text-[#C9A84C] transition-colors">
                  ♡ Save to favourites
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SIMILAR PLACES ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12" style={{ borderTop: "0.5px solid #E8E4DC" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "#C9A84C" }}>
          ◆ Similar places in Amman
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SIMILAR.map((place) => (
            <button
              key={place.name}
              onClick={() => router.push(`/chat?q=${encodeURIComponent(`Tell me about ${place.name} in Amman`)}`)}
              className="text-left bg-white rounded-xl p-4 transition-all"
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
              <p className="text-[13px] font-medium text-[#1A1A1A] mb-1">{place.name}</p>
              <p className="text-[11px] text-[#9ca3af] mb-2">{place.cat} · {place.area}</p>
              <div className="flex items-center gap-1.5">
                <StarRating rating={place.rating} />
                <span className="text-[12px] text-[#6B7280]">{place.rating}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── SEARCH CTA ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 text-center" style={{ borderTop: "0.5px solid #E8E4DC" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
          ◆ Find something else
        </p>
        <h2 className="font-serif text-[1.4rem] font-medium text-[#1A1A1A] mb-6">
          Not quite right? Ask ChatSouq.
        </h2>
        <SearchBar
          size="sm"
          placeholder="Describe what you're looking for…"
          onSubmit={(q) => router.push(`/chat?q=${encodeURIComponent(q)}`)}
          className="max-w-lg mx-auto"
        />
      </div>
    </div>
  );
}
