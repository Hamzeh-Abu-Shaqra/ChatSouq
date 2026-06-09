"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "../../../components/ui/SearchBar";

interface VendorData {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  address: string | null;
  area: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  rating: number | null;
  reviews_count: number | null;
  lat: number | null;
  lng: number | null;
  scraped_at: string | null;
}

const SIMILAR_FALLBACK = [
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

function Skeleton({ w, h }: { w?: string; h: string }) {
  return (
    <div
      style={{
        width: w ?? "100%",
        height: h,
        background: "#F3F1EE",
        borderRadius: "6px",
        marginBottom: "8px",
      }}
    />
  );
}

export default function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const { slug } = use(params);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/vendor/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as VendorData;
        setVendor(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Not found ────────────────────────────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <div className="bg-[#F9F8F6] min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <p className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-3">Not found</p>
          <p className="text-[14px] text-[#6B7280] mb-6">We couldn&apos;t find this business in our database.</p>
          <button
            onClick={() => router.push("/chat?q=best places in Amman")}
            className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-white"
            style={{ background: "#C9A84C" }}
          >
            Ask ChatSouq instead →
          </button>
        </div>
      </div>
    );
  }

  const v = vendor;
  const displayName = v?.name ?? slug.replace(/-/g, " ");
  const displayArea = v?.area ?? v?.address?.split(",")[1]?.trim() ?? "Amman";
  const displayCategory = v?.category ?? "Business";
  const displaySubcat = v?.subcategory ?? displayCategory;
  const displayRating = v?.rating ?? null;
  const displayReviews = v?.reviews_count ?? 0;

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      {/* ── BREADCRUMB ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-0">
        <nav className="flex items-center gap-2 text-[12px] text-[#9ca3af]">
          <button onClick={() => router.push("/")} className="hover:text-[#C9A84C] transition-colors">Home</button>
          <span>›</span>
          <button onClick={() => router.push("/browse")} className="hover:text-[#C9A84C] transition-colors">Browse</button>
          <span>›</span>
          <span className="text-[#1A1A1A]">{loading ? "…" : displayName}</span>
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
            {loading ? (
              <div>
                <Skeleton w="30%" h="12px" />
                <Skeleton w="60%" h="36px" />
                <Skeleton w="40%" h="16px" />
                <div style={{ height: "16px" }} />
                <Skeleton h="14px" />
                <Skeleton w="80%" h="14px" />
                <Skeleton w="65%" h="14px" />
              </div>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "#C9A84C" }}>
                  ◆ {displayCategory} · {displayArea}
                </p>
                <h1 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-2 leading-tight">
                  {displayName}
                </h1>
                <div className="flex items-center gap-3 mb-4">
                  {displayRating != null && (
                    <>
                      <StarRating rating={displayRating} />
                      <span className="text-[13px] font-medium text-[#1A1A1A]">{displayRating.toFixed(1)}</span>
                      {displayReviews > 0 && (
                        <span className="text-[13px] text-[#6B7280]">({displayReviews.toLocaleString()} reviews)</span>
                      )}
                    </>
                  )}
                  {displaySubcat && (
                    <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: "#F3F1EE", color: "#6B7280" }}>
                      {displaySubcat}
                    </span>
                  )}
                </div>

                {/* Details table */}
                <div className="mb-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
                    ◆ Details
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid #E8E4DC" }}>
                    {[
                      { label: "Address",       value: v?.address },
                      { label: "Hours",         value: v?.opening_hours },
                      { label: "Phone",         value: v?.phone },
                      { label: "Website",       value: v?.website },
                    ]
                      .filter(row => row.value)
                      .map((row, i, arr) => (
                        <div
                          key={row.label}
                          className="flex items-start gap-4 px-4 py-3 bg-white"
                          style={{ borderBottom: i < arr.length - 1 ? "0.5px solid #E8E4DC" : "none" }}
                        >
                          <span className="text-[12px] text-[#9ca3af] w-28 flex-shrink-0 pt-0.5">{row.label}</span>
                          <span className="text-[13px] text-[#1A1A1A] break-all">{row.value}</span>
                        </div>
                      ))
                    }
                    {!v?.address && !v?.phone && !v?.website && (
                      <div className="px-4 py-3 bg-white">
                        <span className="text-[13px] text-[#9ca3af]">Details coming soon — ask ChatSouq for more information.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Best for tags */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
                    ◆ Ask about
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      `What's special about ${displayName}?`,
                      `Is ${displayName} good for a date?`,
                      `Similar places near ${displayArea}`,
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => router.push(`/chat?q=${encodeURIComponent(q)}`)}
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
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT: Sticky CTA sidebar ─────────────────────────────────── */}
          <div className="md:w-72 flex-shrink-0">
            <div
              className="sticky top-20 rounded-xl p-5 bg-white"
              style={{ border: "0.5px solid #E8E4DC" }}
            >
              {loading ? (
                <>
                  <Skeleton w="70%" h="18px" />
                  <Skeleton w="50%" h="14px" />
                </>
              ) : (
                <>
                  <p className="font-serif text-[1.1rem] font-medium text-[#1A1A1A] mb-1">{displayName}</p>
                  <p className="text-[12px] text-[#6B7280] mb-4">{displayArea}</p>

                  <button
                    onClick={() => router.push(`/chat?q=${encodeURIComponent(`Tell me about ${displayName} in Amman`)}`)}
                    className="w-full py-3 rounded-lg text-[14px] font-medium text-white mb-3 transition-all"
                    style={{ background: "#C9A84C" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
                  >
                    Ask ChatSouq →
                  </button>

                  {v?.phone && (
                    <a
                      href={`tel:${v.phone}`}
                      className="block w-full py-3 text-center rounded-lg text-[13px] font-medium text-[#1A1A1A] transition-all mb-4"
                      style={{ border: "0.5px solid #E8E4DC" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#C9A84C"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E8E4DC"; }}
                    >
                      📞 Call now
                    </a>
                  )}

                  {v?.lat && v?.lng && (
                    <a
                      href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full py-3 text-center rounded-lg text-[13px] font-medium text-[#1A1A1A] transition-all mb-4"
                      style={{ border: "0.5px solid #E8E4DC" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#C9A84C"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#E8E4DC"; }}
                    >
                      📍 View on map
                    </a>
                  )}

                  <div className="pt-4" style={{ borderTop: "0.5px solid #E8E4DC" }}>
                    <p className="text-[11px] text-[#9ca3af] mb-2">Ask ChatSouq about</p>
                    {[
                      `What's on the menu at ${displayName}?`,
                      `Is ${displayName} good for a date night?`,
                      `Similar places near ${displayArea}`,
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
                </>
              )}
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
          {SIMILAR_FALLBACK.map((place) => (
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
