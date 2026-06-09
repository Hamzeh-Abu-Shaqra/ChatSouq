"use client";

import { useRouter } from "next/navigation";
import { SearchBar } from "../components/ui/SearchBar";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="bg-[#F9F8F6] min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        {/* Big 404 */}
        <p
          className="font-serif select-none mb-0 leading-none"
          style={{ fontSize: "7rem", color: "#C9A84C", fontWeight: 500, opacity: 0.8 }}
        >
          404
        </p>

        {/* Eyebrow */}
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: "#C9A84C" }}>
          ◆ Page not found
        </p>

        {/* Heading */}
        <h1 className="font-serif text-[1.8rem] font-medium text-[#1A1A1A] mb-3 leading-tight">
          We couldn&apos;t find that page.
        </h1>

        {/* Subtext */}
        <p className="text-[14px] text-[#6B7280] mb-8 leading-relaxed">
          But we can find you the best restaurants, gyms, gifts, and experiences in Amman.
          Just ask.
        </p>

        {/* Search */}
        <SearchBar
          size="lg"
          placeholder="What are you looking for in Amman?"
          onSubmit={(q: string) => router.push(`/chat?q=${encodeURIComponent(q)}`)}
          className="mb-6"
        />

        {/* Quick links */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {[
            { label: "← Home",         href: "/"           },
            { label: "Restaurants",    href: "/restaurants" },
            { label: "Gyms",           href: "/gyms"        },
            { label: "Gifts",          href: "/gifts"       },
            { label: "Experiences",    href: "/experiences" },
          ].map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="text-[13px] transition-colors"
              style={{ color: "#6B7280" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B7280"; }}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
