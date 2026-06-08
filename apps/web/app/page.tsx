"use client";

import { useEffect, useRef, useState } from "react";
import type { AssistResponse, NeighborhoodCard, InfoCard, ConvMessage } from "@chatsouq/core";
import {
  AltCard, BestCard,
  PlaceAltCard, PlaceBestCard,
  NeighborhoodBestCard, NeighborhoodAltCard,
  GeneralInfoCard,
  NewsInfoCard,
  CompanyInfoCard,
  SkeletonCard,
} from "../components/cards";

interface Turn {
  id: number;
  query: string;
  status: "loading" | "done" | "error";
  response?: AssistResponse;
  error?: string;
}

const EXAMPLES = [
  { label: "Best areas to rent in Amman for 1,500 JOD/month", tag: "Rentals"   },
  { label: "Best coffee shop in Jabal Amman",                  tag: "Places"    },
  { label: "What's happening in Jordan today?",                tag: "News"      },
  { label: "Wireless headphones under 60 JOD",                 tag: "Shopping"  },
  { label: "Top tech companies in Amman",                      tag: "Companies" },
  { label: "Best things to do in Petra",                       tag: "Tourism"   },
  { label: "A pharmacy near Abdoun",                           tag: "Places"    },
  { label: "Luxury perfume as a wedding gift, around 80 JOD",  tag: "Shopping"  },
];

// Tags whose colors live in Tailwind config
const TAG_STYLES_CLASS: Record<string, string> = {
  Rentals:  "bg-blue-50 text-blue-700",
  Places:   "bg-amber-50 text-amber-700",
  Shopping: "bg-souq-50 text-souq-700",
  Tourism:  "bg-purple-50 text-purple-700",
  Info:     "bg-sand-100 text-ink-600",
};

// Tags needing inline styles (colors not in config)
const TAG_STYLES_INLINE: Record<string, React.CSSProperties> = {
  News:      { backgroundColor: "#fff1f2", color: "#be123c" },
  Companies: { backgroundColor: "#eef2ff", color: "#3730a3" },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildAssistantContext(res: AssistResponse): string {
  const lines: string[] = [res.summary];
  if (res.kind === "products" && res.best) {
    const b = res.best;
    const price = b.listing.price != null ? ` at ${b.listing.price} JOD` : "";
    const brand = b.listing.brand ? `${b.listing.brand} ` : "";
    lines.push(`Top pick: ${brand}${b.listing.name}${price} from ${b.listing.vendor.name}.`);
    if (b.why) lines.push(`Why: ${b.why}`);
    if (b.pros.length) lines.push(`Strengths: ${b.pros.join("; ")}`);
    if (res.alternatives.length > 0) {
      const alts = res.alternatives
        .map((a) => `${a.listing.name}${a.listing.price != null ? ` (${a.listing.price} JOD)` : ""}`)
        .join(", ");
      lines.push(`Also shown: ${alts}`);
    }
  } else if (res.kind === "places" && res.best) {
    const b = res.best;
    const loc = b.place.city || b.place.governorate || "Jordan";
    lines.push(`Top place: ${b.place.name} in ${loc} (${b.place.category}).`);
    if (b.why) lines.push(`Why: ${b.why}`);
    if (res.alternatives.length > 0) {
      lines.push(`Also shown: ${res.alternatives.map((a) => a.place.name).join(", ")}`);
    }
  } else if (res.kind === "general" && res.cards.length > 0) {
    if (res.intentType === "rental" || res.intentType === "lifestyle") {
      const nbCards = res.cards as NeighborhoodCard[];
      const areas = nbCards
        .map((nb) => {
          const rent = nb.avgRentMin && nb.avgRentMax
            ? ` (${nb.avgRentMin}–${nb.avgRentMax} JOD/month)` : "";
          const traits = nb.characteristics?.slice(0, 2).join(", ") ?? "";
          return `${nb.name}${rent}${traits ? `: ${traits}` : ""}`;
        })
        .join("; ");
      lines.push(`Areas recommended: ${areas}`);
    } else {
      const infoCards = res.cards as InfoCard[];
      lines.push(`Topics covered: ${infoCards.map((c) => c.title).join(", ")}`);
    }
  }
  return lines.join("\n");
}

function buildHistory(currentTurns: Turn[]): ConvMessage[] {
  return currentTurns
    .filter((t) => t.status === "done" && t.response)
    .flatMap((t) => [
      { role: "user" as const, content: t.query },
      { role: "assistant" as const, content: buildAssistantContext(t.response!) },
    ])
    .slice(-10);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [input, setInput]   = useState("");
  const [turns, setTurns]   = useState<Turn[]>([]);
  const [busy, setBusy]     = useState(false);
  const sessionId           = useRef<string>(Math.random().toString(36).slice(2));
  const bottomRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function ask(query: string) {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    const id = Date.now();
    const history = buildHistory(turns);
    setTurns((t) => [...t, { id, query: q, status: "loading" }]);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, sessionId: sessionId.current, history }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Request failed");
      const data = (await res.json()) as AssistResponse;
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, status: "done", response: data } : x)));
    } catch (e) {
      setTurns((t) =>
        t.map((x) => x.id === id ? { ...x, status: "error", error: (e as Error).message } : x)
      );
    } finally {
      setBusy(false);
    }
  }

  const empty = turns.length === 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <Header />

      <main className="flex-1 pb-48">
        {empty ? (
          <Hero onPick={ask} />
        ) : (
          <div className="space-y-8 py-6">
            {turns.map((t) => (
              <TurnView key={t.id} turn={t} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <Composer
        input={input}
        setInput={setInput}
        onSubmit={() => ask(input)}
        busy={busy}
        compact={!empty}
      />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="flex items-center justify-between py-4 border-b border-black/[0.06]">
      <div className="flex items-center gap-2.5">
        <ChatSouqLogo />
        <span className="text-[15px] font-bold tracking-tight text-ink-900">
          Chat<span className="text-souq-600">Souq</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-souq-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-souq-500" />
        </span>
        <span className="text-xs font-medium text-ink-400">Jordan · Live data</span>
      </div>
    </header>
  );
}

function ChatSouqLogo({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 20 20" fill="none">
        <path d="M3 6.5C3 5.67 3.67 5 4.5 5h11c.83 0 1.5.67 1.5 1.5v1H3v-1z" fill="white" fillOpacity="0.9"/>
        <path d="M3 7.5h14l-1.3 7.6a1.5 1.5 0 01-1.48 1.24H5.78A1.5 1.5 0 014.3 15.1L3 7.5z" fill="white" fillOpacity="0.7"/>
        <circle cx="7.5" cy="11.5" r="1" fill="white" fillOpacity="0.5"/>
        <circle cx="12.5" cy="11.5" r="1" fill="white" fillOpacity="0.5"/>
      </svg>
    </div>
  );
}

function MiniLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <path d="M3 6.5C3 5.67 3.67 5 4.5 5h11c.83 0 1.5.67 1.5 1.5v1H3v-1z" fill="white" fillOpacity="0.9"/>
      <path d="M3 7.5h14l-1.3 7.6a1.5 1.5 0 01-1.48 1.24H5.78A1.5 1.5 0 014.3 15.1L3 7.5z" fill="white" fillOpacity="0.7"/>
      <circle cx="7.5" cy="11.5" r="1" fill="white" fillOpacity="0.5"/>
      <circle cx="12.5" cy="11.5" r="1" fill="white" fillOpacity="0.5"/>
    </svg>
  );
}

// ── Hero (empty state) ────────────────────────────────────────────────────────

const DATA_SOURCE_PILLS = [
  { emoji: "📍", label: "Google Maps" },
  { emoji: "🍽", label: "Talabat" },
  { emoji: "🏠", label: "OpenSooq" },
  { emoji: "📰", label: "Roya News" },
  { emoji: "🌐", label: "Live Web" },
  { emoji: "🛍", label: "Products" },
];

function Hero({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-12 sm:pt-20 text-center">
      <h1 className="text-[48px] sm:text-[68px] font-black tracking-[-0.03em] leading-[0.92] text-ink-900">
        Ask anything
        <br />
        <span className="text-souq-600">about Jordan.</span>
      </h1>

      <p
        className="mt-3 text-base font-medium text-ink-400 tracking-wide"
        dir="rtl"
        lang="ar"
      >
        استفسر عن أي شيء في الأردن
      </p>

      <p className="mt-5 max-w-sm text-[15px] text-ink-500 leading-relaxed">
        Rentals · Restaurants · Products · Tourism · Services
        <br />
        Real Jordan data. Direct, accurate answers.
      </p>

      {/* Data source pills */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {DATA_SOURCE_PILLS.map((pill, i) => (
          <span key={pill.label} className="flex items-center gap-1">
            {i > 0 && <span className="text-ink-200 text-[10px]">·</span>}
            <span className="text-[11px] text-ink-400 font-medium">
              <span className="mr-0.5">{pill.emoji}</span>{pill.label}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-10 w-full max-w-2xl grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EXAMPLES.map((ex) => {
          const inlineStyle = TAG_STYLES_INLINE[ex.tag];
          const classStyle  = TAG_STYLES_CLASS[ex.tag];
          return (
            <button
              key={ex.label}
              onClick={() => onPick(ex.label)}
              className="group flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-black/[0.07] transition-all duration-150 hover:-translate-y-px hover:shadow-card hover:ring-souq-500/25"
            >
              <span
                className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${classStyle ?? "bg-sand-100 text-ink-600"}`}
                style={inlineStyle}
              >
                {ex.tag}
              </span>
              <span className="text-sm text-ink-700 group-hover:text-ink-900 transition-colors leading-snug">
                {ex.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Turn (one Q&A pair) ───────────────────────────────────────────────────────

function TurnView({ turn }: { turn: Turn }) {
  const isRtl = /[؀-ۿ]/.test(turn.query);

  return (
    <div className="space-y-4">
      {/* User bubble */}
      <div className="flex justify-end">
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="max-w-[82%] rounded-2xl rounded-br-sm bg-ink-900 px-4 py-3 text-sm leading-relaxed text-white shadow-sm"
        >
          {turn.query}
        </div>
      </div>

      {/* AI response */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-souq-600">
          <MiniLogo />
        </div>

        <div className="min-w-0 flex-1">
          {turn.status === "loading" && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 pt-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
              </div>
              <SkeletonCard />
            </div>
          )}

          {turn.status === "error" && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {turn.error ?? "Something went wrong — please try again."}
            </div>
          )}

          {turn.status === "done" && turn.response && (
            <ResponseView res={turn.response} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Source line ───────────────────────────────────────────────────────────────

function SourceLine({ res }: { res: AssistResponse }) {
  let text: string;
  if (res.kind === "products") {
    text = "🛍 Live · Jordan product catalog";
  } else if (res.kind === "places") {
    text = "📍 Live · Maps · Talabat";
  } else {
    // general
    switch (res.intentType) {
      case "news":      text = "📡 Live · Roya News · Web search"; break;
      case "rental":    text = "🏠 Live · OpenSooq · Jordan DB"; break;
      case "lifestyle": text = "🏠 Live · OpenSooq · Jordan DB"; break;
      case "companies": text = "🏢 Live · Company DB · Web search"; break;
      case "tourism":   text = "✈️ Live · Web search · Jordan DB"; break;
      default:          text = "🌐 Live · Web search · Jordan knowledge"; break;
    }
  }
  return (
    <p className="text-[10px] text-ink-300 mt-1">{text}</p>
  );
}

// ── Response view (dispatches by kind) ───────────────────────────────────────

function ResponseView({ res }: { res: AssistResponse }) {
  const isRtl = /[؀-ۿ]/.test(res.summary);

  const summaryEl = (
    <p
      dir={isRtl ? "rtl" : "ltr"}
      className="text-[15px] leading-relaxed text-ink-700"
    >
      {res.summary}
    </p>
  );

  // ── General ──
  if (res.kind === "general") {
    const isRental    = res.intentType === "rental" || res.intentType === "lifestyle";
    const isNews      = res.intentType === "news";
    const isCompanies = res.intentType === "companies";
    const nbCards     = res.cards as NeighborhoodCard[];
    const infoCards   = res.cards as InfoCard[];

    return (
      <div className="space-y-4">
        {summaryEl}

        {/* Rental / lifestyle — neighborhood cards */}
        {isRental && nbCards.length > 0 && (
          <div className="space-y-3">
            <SectionLabel>{nbCards.length} area{nbCards.length > 1 ? "s" : ""} that fit your budget</SectionLabel>
            <NeighborhoodBestCard item={nbCards[0]!} />
            {nbCards.length > 1 && (
              <>
                <SectionLabel className="mt-6">Other areas to consider</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2">
                  {nbCards.slice(1).map((nb, i) => (
                    <NeighborhoodAltCard key={nb.name} item={nb} rank={i + 2} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* News — styled as news cards */}
        {isNews && infoCards.length > 0 && (
          <div className="space-y-2">
            <SectionLabelWithPulse>Latest from Jordan</SectionLabelWithPulse>
            <div className="space-y-2">
              {infoCards.map((card, i) => (
                <NewsInfoCard key={i} item={card} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Companies — styled as company cards */}
        {isCompanies && infoCards.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Jordan businesses</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {infoCards.map((card, i) => (
                <CompanyInfoCard key={i} item={card} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Other general — generic info cards */}
        {!isRental && !isNews && !isCompanies && infoCards.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {infoCards.map((card, i) => (
              <GeneralInfoCard key={i} item={card} />
            ))}
          </div>
        )}

        <SourceLine res={res} />
      </div>
    );
  }

  // ── No results ──
  if (!res.best) {
    return (
      <div className="space-y-1">
        {summaryEl}
        <SourceLine res={res} />
      </div>
    );
  }

  // ── Places ──
  if (res.kind === "places") {
    return (
      <div className="space-y-4">
        {summaryEl}
        <PlaceBestCard item={res.best} />
        {res.alternatives.length > 0 && (
          <>
            <SectionLabel className="mt-6">Other places worth considering</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {res.alternatives.map((a, i) => (
                <PlaceAltCard key={a.place.id} item={a} rank={i + 2} />
              ))}
            </div>
          </>
        )}
        <SourceLine res={res} />
      </div>
    );
  }

  // ── Products ──
  return (
    <div className="space-y-4">
      {summaryEl}
      <BestCard item={res.best} />
      {res.alternatives.length > 0 && (
        <>
          <SectionLabel className="mt-6">Other options worth considering</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            {res.alternatives.map((a, i) => (
              <AltCard key={a.listing.id} item={a} rank={i + 2} />
            ))}
          </div>
        </>
      )}
      <SourceLine res={res} />
    </div>
  );
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-widest text-ink-400 ${className}`}>
      {children}
    </p>
  );
}

function SectionLabelWithPulse({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: "#fb7185" }} />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#f43f5e" }} />
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">{children}</p>
    </div>
  );
}

// ── Composer (fixed bottom input) ─────────────────────────────────────────────

function Composer({
  input,
  setInput,
  onSubmit,
  busy,
  compact,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  compact: boolean;
}) {
  const isRtl = /[؀-ۿ]/.test(input);

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 pointer-events-none">
      <div className="h-16 bg-gradient-to-t from-paper to-transparent" />
      <div className="bg-paper pb-5 sm:pb-6 pointer-events-auto">
        <div className="mx-auto max-w-2xl px-4">
          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            className="flex items-end gap-2 rounded-2xl bg-white px-4 py-3 shadow-float ring-1 ring-black/[0.07] transition-shadow focus-within:ring-2 focus-within:ring-souq-500/30"
          >
            <textarea
              dir={isRtl ? "rtl" : "ltr"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              rows={1}
              placeholder={
                compact
                  ? "Ask anything about Jordan…"
                  : "e.g. best area to rent in Amman for 800 JOD, or a gift under 50 JOD"
              }
              className="max-h-36 flex-1 resize-none bg-transparent py-1 text-[15px] text-ink-900 outline-none placeholder:text-ink-300 leading-relaxed"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white transition enabled:hover:bg-ink-800 disabled:opacity-30"
            >
              {busy ? <Spinner /> : <SendIcon />}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-ink-300">
            ChatSouq uses real Jordan data — it never makes up facts or numbers.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Micro icons ───────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin text-white" width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4.5 12l15-7.5-5.5 15-3-7-6.5-0.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
