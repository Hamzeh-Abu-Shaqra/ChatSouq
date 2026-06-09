"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "../../../components/ui/SearchBar";

interface VendorData {
  id: number;
  name: string;
  subcategory: string | null;
  category: string | null;
  address: string | null;
  rating: number | null;
  reviews_count: number | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  scraped_at: string | null;
}

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

function LoadingSkeleton() {
  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-20 animate-pulse">
        <div className="h-4 w-48 bg-[#E8E4DC] rounded mb-8" />
        <div className="h-60 w-full bg-[#F3F1EE] rounded-xl mb-6" />
        <div className="h-8 w-64 bg-[#E8E4DC] rounded mb-4" />
        <div className="h-4 w-40 bg-[#E8E4DC] rounded mb-8" />
        <div className="h-20 w-full bg-[#F3F1EE] rounded" />
      </div>
    </div>
  );
}

function NotFoundState({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <div className="bg-[#F9F8F6] min-h-screen flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ Not Found
        </p>
        <h1 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-4">
          Vendor not found
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-8">
          This listing may have moved or been removed.
        </p>
        <button
          onClick={() => router.push("/chat")}
          className="px-6 py-3 rounded-lg text-[14px] font-medium text-white transition-all"
          style={{ background: "#C9A84C" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
        >
          Search ChatSouq →
        </button>
      </div>
    </div>
  );
}

export default function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/vendor/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setVendor(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <LoadingSkeleton />;
  if (notFound || !vendor) return <NotFoundState router={router} />;

  const v = vendor;
  const displayCategory = v.category
    ? v.category.charAt(0).toUpperCase() + v.category.slice(1)
    : "Business";

  return (
    <div className="bg-[#F9F8F6] min-h-screen">
      {/* ── BREADCRUMB ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-0">
        <nav className="flex items-center gap-2 text-[12px] text-[#9ca3af]">
          <button onClick={() => router.push("/")} className="hover:text-[#C9A84C] transition-colors">Home</button>
          <span>›</span>
          <button onClick={() => router.push("/chat")} className="hover:text-[#C9A84C] transition-colors">{displayCategory}</button>
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
              ◆ {displayCategory}{v.area ? ` · ${v.area}` : ""}
            </p>
            <h1 className="font-serif text-[2rem] font-medium text-[#1A1A1A] mb-2 leading-tight">
              {v.name}
            </h1>

            {(v.rating !== null || v.subcategory) && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {v.rating !== null && (
                  <>
                    <StarRating rating={v.rating} />
                    <span className="text-[13px] font-medium text-[#1A1A1A]">{v.rating}</span>
                  </>
                )}
                {v.reviews_count !== null && (
                  <span className="text-[13px] text-[#6B7280]">({v.reviews_count.toLocaleString()} reviews)</span>
                )}
                {v.subcategory && (
                  <span className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: "#F3F1EE", color: "#6B7280" }}>
                    {v.subcategory}
                  </span>
                )}
              </div>
            )}

            {/* Details table */}
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "#C9A84C" }}>
                ◆ Details
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid #E8E4DC" }}>
                {[
                  { label: "Address",       value: v.address },
                  { label: "Hours",         value: v.opening_hours },
                  { label: "Phone",         value: v.phone },
                  { label: "Website",       value: v.website },
                  { label: "Area",          value: v.area },
                ].filter((r) => r.value).map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="flex items-start gap-4 px-4 py-3 bg-white"
                    style={{ borderBottom: i < arr.length - 1 ? "0.5px solid #E8E4DC" : "none" }}
                  >
                    <span className="text-[12px] text-[#9ca3af] w-28 flex-shrink-0 pt-0.5">{row.label}</span>
                    {row.label === "Website" ? (
                      <a
                        href={row.value!.startsWith("http") ? row.value! : `https://${row.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] transition-colors"
                        style={{ color: "#C9A84C" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#7A5C10"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#C9A84C"; }}
                      >
                        {row.value}
                      </a>
                    ) : row.label === "Phone" ? (
                      <a
                        href={`tel:${row.value}`}
                        className="text-[13px] text-[#1A1A1A] hover:text-[#C9A84C] transition-colors"
                      >
                        {row.value}
                      </a>
                    ) : (
                      <span className="text-[13px] text-[#1A1A1A]">{row.value}</span>
                    )}
                  </div>
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
              {v.area && <p className="text-[12px] text-[#6B7280] mb-4">{v.area}</p>}

              <button
                onClick={() => router.push(`/chat?q=${encodeURIComponent(`Tell me about ${v.name} in Amman`)}`)}
                className="w-full py-3 rounded-lg text-[14px] font-medium text-white mb-3 transition-all"
                style={{ background: "#C9A84C" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
              >
                Ask ChatSouq →
              </button>

              {v.phone && (
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

              <div className="pt-4" style={{ borderTop: "0.5px solid #E8E4DC" }}>
                <p className="text-[11px] text-[#9ca3af] mb-2">Ask ChatSouq about</p>
                {[
                  `What's special about ${v.name}?`,
                  `Is ${v.name} good for a group?`,
                  `Similar places near ${v.area ?? "Amman"}`,
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
            </div>
          </div>
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
          placeholder="Describe what you&apos;re looking for…"
          onSubmit={(q) => router.push(`/chat?q=${encodeURIComponent(q)}`)}
          className="max-w-lg mx-auto"
        />
      </div>
    </div>
  );
}
