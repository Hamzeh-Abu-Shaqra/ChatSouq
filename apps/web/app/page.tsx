"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AssistResponse, NeighborhoodCard, InfoCard, ConvMessage } from "@chatsouq/core";
import {
  AltCard, BestCard,
  PlaceAltCard, PlaceBestCard,
  NeighborhoodBestCard, NeighborhoodAltCard,
  GeneralInfoCard, NewsInfoCard, CompanyInfoCard,
  NewspaperFront, SkeletonCard,
} from "../components/cards";

const SESSION_KEY = "chatsouq_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const fresh = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, fresh);
  return fresh;
}

interface Turn {
  id: number;
  query: string;
  status: "loading" | "done" | "error";
  response?: AssistResponse & { sessionId?: string };
  error?: string;
  conversationId?: string;
  feedback?: 1 | -1;
}

// ── Category grid data ────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "Today",    icon: "📰", q: "What's happening in Amman today?" },
  { label: "Food",     icon: "🍽", q: "Best restaurants in Amman"        },
  { label: "Doctors",  icon: "🏥", q: "Find a doctor in Amman"           },
  { label: "Hotels",   icon: "🏨", q: "Hotels in Amman"                  },
  { label: "Rent",     icon: "🏡", q: "Rent an apartment in Amman"       },
  { label: "Gym",      icon: "💪", q: "Best gym in Amman"                },
  { label: "News",     icon: "📡", q: "Latest news from Jordan"          },
  { label: "Shopping", icon: "🛍", q: "Shopping malls in Amman"         },
] as const;

// ── Example queries ───────────────────────────────────────────────────────────

interface Example { label: string; tag: string; icon: string }

const EXAMPLES: Example[] = [
  {
    label: "What's happening in Amman today? Full rundown — news, new openings, events, and the best thing to do tonight.",
    tag: "Today", icon: "📰",
  },
  {
    label: "New restaurants and cafes that opened in Amman this month — anything worth trying?",
    tag: "New", icon: "✨",
  },
  {
    label: "إيش في عمّان اليوم؟ فعاليات، أماكن جديدة، وأحسن وجهة للمساء",
    tag: "الليلة", icon: "🌙",
  },
  {
    label: "Best deals and offers running in Amman right now — food, shops, and services.",
    tag: "Deals", icon: "🏷",
  },
  {
    label: "What's trending in Weibdeh and Rainbow Street this week? New cafes, pop-ups, and shops to check out.",
    tag: "Trending", icon: "🔥",
  },
  {
    label: "Plan my Friday in Amman — best family activities, indoor and outdoor, for this weekend.",
    tag: "Friday", icon: "🎉",
  },
  {
    label: "New boutiques and concept stores just opened in Amman — fashion, home decor, and gifts.",
    tag: "New Shops", icon: "🛍",
  },
  {
    label: "I have guests visiting Amman this weekend — best spots for food, culture, and shopping.",
    tag: "Guide", icon: "🗺",
  },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Today:      { bg: "#fff1f2", text: "#be123c" },
  New:        { bg: "#ecfdf5", text: "#047857" },
  "الليلة":  { bg: "#eef2ff", text: "#4338ca" },
  Deals:      { bg: "#fffbeb", text: "#92400e" },
  Trending:   { bg: "#fff7ed", text: "#c2410c" },
  Friday:     { bg: "#fdf4ff", text: "#86198f" },
  "New Shops":{ bg: "#fff7ed", text: "#9a3412" },
  Guide:      { bg: "#f5f3ff", text: "#6d28d9" },
};

const DATA_STATS = [
  { emoji: "📍", label: "1,142 places" },
  { emoji: "👩‍⚕️", label: "88 professionals" },
  { emoji: "🍽",  label: "Restaurants"      },
  { emoji: "📰",  label: "Live news"        },
  { emoji: "🛍",  label: "30k+ products"   },
];

// ── Context helpers ───────────────────────────────────────────────────────────

function buildAssistantContext(res: AssistResponse): string {
  const lines: string[] = [res.summary];
  if (res.kind === "products" && res.best) {
    const b = res.best;
    const price = b.listing.price != null ? ` at ${b.listing.price} JOD` : "";
    const brand = b.listing.brand ? `${b.listing.brand} ` : "";
    lines.push(`Top pick: ${brand}${b.listing.name}${price} from ${b.listing.vendor.name}.`);
    if (b.why) lines.push(`Why: ${b.why}`);
    if (res.alternatives.length > 0)
      lines.push(`Also shown: ${res.alternatives.map((a) => `${a.listing.name}${a.listing.price != null ? ` (${a.listing.price} JOD)` : ""}`).join(", ")}`);
  } else if (res.kind === "places" && res.best) {
    const b = res.best;
    const loc = b.place.city || b.place.governorate || "Jordan";
    lines.push(`Top place: ${b.place.name} in ${loc} (${b.place.category}).`);
    if (b.why) lines.push(`Why: ${b.why}`);
    if (res.alternatives.length > 0)
      lines.push(`Also shown: ${res.alternatives.map((a) => a.place.name).join(", ")}`);
  } else if (res.kind === "general" && res.cards.length > 0) {
    if (res.intentType === "rental" || res.intentType === "lifestyle") {
      const areas = (res.cards as NeighborhoodCard[]).map((nb) => {
        const rent = nb.avgRentMin && nb.avgRentMax ? ` (${nb.avgRentMin}–${nb.avgRentMax} JOD/month)` : "";
        return `${nb.name}${rent}`;
      }).join("; ");
      lines.push(`Areas: ${areas}`);
    } else if (res.intentType === "today") {
      const newsCards = (res.cards as InfoCard[]).filter((c) => c.section === "news").slice(0, 3);
      if (newsCards.length > 0) lines.push(`Headlines: ${newsCards.map((c) => c.title).join("; ")}`);
    } else {
      lines.push(`Topics: ${(res.cards as InfoCard[]).map((c) => c.title).join(", ")}`);
    }
  }
  return lines.join("\n");
}

function buildHistory(currentTurns: Turn[]): ConvMessage[] {
  return currentTurns
    .filter((t) => t.status === "done" && t.response)
    .flatMap((t) => [
      { role: "user" as const,      content: t.query },
      { role: "assistant" as const, content: buildAssistantContext(t.response!) },
    ])
    .slice(-10);
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function Page() {
  const [input, setInput]                 = useState("");
  const [turns, setTurns]                 = useState<Turn[]>([]);
  const [busy, setBusy]                   = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [memoryActive, setMemoryActive]   = useState(false);
  const sessionIdRef      = useRef<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const bottomRef         = useRef<HTMLDivElement>(null);

  /* Restore session --------------------------------------------------------- */
  useEffect(() => {
    const sid = getOrCreateSessionId();
    sessionIdRef.current = sid;
    fetch(`/api/history?sessionId=${encodeURIComponent(sid)}`)
      .then((r) => r.json())
      .then((data: { conversationId: string | null; messages: ConvMessage[]; prefs: Record<string, unknown>; turnCount: number }) => {
        conversationIdRef.current = data.conversationId;
        if (data.messages && data.messages.length >= 2) {
          const restored: Turn[] = [];
          for (let i = 0; i < data.messages.length - 1; i += 2) {
            const uMsg = data.messages[i];
            const aMsg = data.messages[i + 1];
            if (uMsg?.role === "user" && aMsg?.role === "assistant") {
              restored.push({
                id: i,
                query: uMsg.content,
                status: "done",
                response: {
                  kind: "general", query: uMsg.content,
                  intentType: "general", summary: aMsg.content,
                  cards: [], meta: { provider: "restored", tookMs: 0 },
                } as AssistResponse,
              });
            }
          }
          if (restored.length > 0) setTurns(restored);
        }
        if (data.prefs && Object.keys(data.prefs).length > 0) setMemoryActive(true);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  /* Feedback --------------------------------------------------------------- */
  const sendFeedback = useCallback((query: string, res: AssistResponse, rating: 1 | -1, clickedId?: number) => {
    const shownIds =
      res.kind === "products"
        ? [res.best?.listing.id, ...res.alternatives.map((a) => a.listing.id)].filter(Boolean) as number[]
        : res.kind === "places"
        ? [res.best?.place.id, ...res.alternatives.map((a) => a.place.id)].filter(Boolean) as number[]
        : [];
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionIdRef.current, conversationId: conversationIdRef.current, query, resultKind: res.kind, shownIds, clickedId, rating }),
    }).catch(() => {});
  }, []);

  /* Ask -------------------------------------------------------------------- */
  async function ask(query: string) {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    const id = Date.now();
    setTurns((t) => [...t, { id, query: q, status: "loading" }]);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, sessionId: sessionIdRef.current }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Request failed");
      const data = (await res.json()) as AssistResponse & { sessionId?: string };
      if ((data as { conversationId?: string }).conversationId)
        conversationIdRef.current = (data as { conversationId?: string }).conversationId ?? null;
      setMemoryActive(true);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, status: "done", response: data } : x)));
    } catch (e) {
      setTurns((t) => t.map((x) => x.id === id ? { ...x, status: "error", error: (e as Error).message } : x));
    } finally {
      setBusy(false);
    }
  }

  function newConversation() {
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, fresh);
    sessionIdRef.current = fresh;
    conversationIdRef.current = null;
    setTurns([]);
    setMemoryActive(false);
  }

  const empty = turns.length === 0 && historyLoaded;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <Header memoryActive={memoryActive} onNewConversation={newConversation} />
      <main className="flex-1 pb-52">
        {empty ? (
          <Hero onPick={ask} />
        ) : (
          <div className="space-y-10 py-6">
            {turns.map((t) => (
              <TurnView
                key={t.id}
                turn={t}
                onFeedback={(rating, clickedId) => {
                  if (t.response) {
                    sendFeedback(t.query, t.response, rating, clickedId);
                    setTurns((prev) => prev.map((x) => x.id === t.id ? { ...x, feedback: rating } : x));
                  }
                }}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>
      <Composer input={input} setInput={setInput} onSubmit={() => ask(input)} busy={busy} compact={!empty} />
    </div>
  );
}

// ── Header — newspaper masthead ───────────────────────────────────────────────

function Header({ memoryActive, onNewConversation }: { memoryActive: boolean; onNewConversation: () => void }) {
  return (
    <header>
      {/* Thick top rule — newspaper edition bar */}
      <div className="h-[3px] bg-ink-900" />

      <div className="flex items-center justify-between py-3.5">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <div className="leading-tight">
            <p className="text-[16px] font-black tracking-tight text-ink-900 leading-none">
              Chat<span className="text-souq-600">Souq</span>
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-400 mt-0.5 leading-none">
              Amman&apos;s AI
            </p>
          </div>
        </div>

        {/* Center edition label */}
        <p className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.22em] text-ink-400">
          Amman · Jordan
        </p>

        {/* Right status + actions */}
        <div className="flex items-center gap-3">
          {memoryActive && (
            <div className="hidden sm:flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 ring-1 ring-violet-200/50">
              <span className="text-[9px]">🧠</span>
              <span className="text-[9px] font-black uppercase tracking-wider text-violet-600">Memory on</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-souq-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-souq-500" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-ink-400">Live</span>
          </div>
          <button
            onClick={onNewConversation}
            title="Start a new conversation"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-ink-500 ring-1 ring-black/[0.08] transition hover:bg-sand-50 hover:text-ink-900 active:scale-95"
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New
          </button>
        </div>
      </div>

      {/* Thin bottom rule */}
      <div className="masthead-rule-thin" />
    </header>
  );
}

function LogoMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-900 shadow-sm">
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
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

// ── Hero — newspaper front page ───────────────────────────────────────────────

function Hero({ onPick }: { onPick: (q: string) => void }) {
  const now    = new Date();
  const dateEn = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  const dateAr = now.toLocaleDateString("ar-JO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="pt-8 sm:pt-12">

      {/* Edition / date strip */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">{dateEn}</p>
        <p className="text-[11px] text-ink-400" dir="rtl" lang="ar">{dateAr}</p>
      </div>

      {/* Thick masthead rule */}
      <hr className="masthead-rule mb-5" />

      {/* HEADLINE — giant serif */}
      <h1 className="font-serif text-[62px] sm:text-[88px] font-black leading-[0.88] tracking-[-0.02em] text-ink-900">
        Know<br />Amman.
      </h1>

      {/* Thin rule */}
      <hr className="masthead-rule-thin mt-5 mb-4" />

      {/* Tagline row */}
      <div className="flex items-center justify-between mb-7">
        <p className="text-[13px] font-medium text-ink-500 tracking-wide">
          Your city&apos;s AI — real places, real answers, updated daily.
        </p>
        <p className="shrink-0 text-[13px] text-ink-400 ml-4" dir="rtl" lang="ar">اعرف عمّان</p>
      </div>

      {/* TODAY — featured CTA */}
      <button
        onClick={() => onPick("What's happening in Amman today?")}
        className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-ink-900 px-5 py-4 text-[13px] font-black uppercase tracking-wider text-white shadow-float transition-all hover:bg-ink-800 hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        Today in Amman
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black tracking-widest">LIVE</span>
      </button>

      {/* Category grid — 4 × 2 */}
      <div className="grid grid-cols-4 gap-2 mb-7">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => onPick(cat.q)}
            className="group flex flex-col items-center gap-1.5 rounded-xl bg-white py-3.5 px-1 ring-1 ring-black/[0.07] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card hover:ring-black/[0.12] active:scale-95"
          >
            <span className="text-[20px] leading-none">{cat.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-wide text-ink-600 group-hover:text-ink-900 transition-colors">
              {cat.label}
            </span>
          </button>
        ))}
      </div>

      {/* "Try an example" divider */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 masthead-rule-thin" />
        <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.25em] text-ink-300">Try an example</span>
        <div className="flex-1 masthead-rule-thin" />
      </div>

      {/* Example query cards — 2-col grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-8">
        {EXAMPLES.map((ex) => {
          const colors = TAG_COLORS[ex.tag] ?? { bg: "#f3ede2", text: "#374151" };
          return (
            <button
              key={ex.label}
              onClick={() => onPick(ex.label)}
              className="group flex items-start gap-3 rounded-xl bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-black/[0.07] transition-all hover:-translate-y-px hover:shadow-card hover:ring-black/[0.12] active:scale-[0.99]"
            >
              <span
                className="mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider leading-none whitespace-nowrap"
                style={{ background: colors.bg, color: colors.text }}
              >
                {ex.icon} {ex.tag}
              </span>
              <span className="text-[13px] text-ink-600 group-hover:text-ink-900 transition-colors leading-snug">
                {ex.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Data-coverage stats */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {DATA_STATS.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-200 select-none text-xs">·</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-500 ring-1 ring-black/[0.06] shadow-sm">
              {s.emoji} {s.label}
            </span>
          </span>
        ))}
      </div>

      <p className="mt-4 text-center text-[10px] text-ink-300 font-medium tracking-wide">
        Real Amman data · No hallucinations · Updated daily
      </p>
    </section>
  );
}

// ── TurnView — one Q&A exchange ───────────────────────────────────────────────

function TurnView({ turn, onFeedback }: { turn: Turn; onFeedback: (rating: 1 | -1, clickedId?: number) => void }) {
  const isRtl = /[؀-ۿ]/.test(turn.query);
  return (
    <div className="space-y-5 animate-fade-up">
      {/* User bubble */}
      <div className="flex justify-end">
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="max-w-[78%] rounded-2xl rounded-br-sm bg-ink-900 px-4 py-3 text-[14px] leading-relaxed text-white shadow-sm"
        >
          {turn.query}
        </div>
      </div>

      {/* AI response */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-souq-600 shadow-sm">
          <MiniLogo />
        </div>
        <div className="min-w-0 flex-1">
          {turn.status === "loading" && (
            <div className="rounded-xl bg-[#faf8f4] px-4 py-4 space-y-4">
              <div className="flex items-center gap-1.5 pt-1.5">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
              </div>
              <SkeletonCard />
            </div>
          )}
          {turn.status === "error" && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700 ring-1 ring-rose-100">
              {turn.error ?? "Something went wrong — please try again."}
            </div>
          )}
          {turn.status === "done" && turn.response && (
            <>
              <div className="rounded-xl bg-[#faf8f4] px-4 py-4">
                <ResponseView res={turn.response} />
              </div>
              <FeedbackRow
                feedback={turn.feedback}
                onThumbUp={() => onFeedback(1)}
                onThumbDown={() => onFeedback(-1)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FeedbackRow ───────────────────────────────────────────────────────────────

function FeedbackRow({ feedback, onThumbUp, onThumbDown }: {
  feedback?: 1 | -1;
  onThumbUp: () => void;
  onThumbDown: () => void;
}) {
  if (feedback !== undefined) {
    return (
      <p className="mt-2 text-[10px] text-ink-300">
        {feedback === 1 ? "👍 Thanks — noted!" : "👎 Got it — I'll improve."}
      </p>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[10px] text-ink-300">Helpful?</span>
      <button onClick={onThumbUp} title="Good answer"
        className="rounded-md p-1 text-ink-300 transition hover:bg-souq-50 hover:text-souq-600">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
          <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
        </svg>
      </button>
      <button onClick={onThumbDown} title="Not helpful"
        className="rounded-md p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-500">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
          <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
        </svg>
      </button>
    </div>
  );
}

// ── SourceLine ────────────────────────────────────────────────────────────────

function SourceLine({ res }: { res: AssistResponse }) {
  let text: string;
  if (res.kind === "products") {
    text = "🛍 Jordan product catalog · Live";
  } else if (res.kind === "places") {
    const hasPro = res.best && /^(doctor|dentist|physician|lawyer|attorney|accountant|architect|engineer|pharmacist|specialist|professional)/i.test(res.best.place.category);
    text = hasPro
      ? "👩‍⚕️ Professional directory · Google Maps · Live"
      : "📍 Google Maps · Talabat · Jordan DB · Live";
  } else {
    switch (res.intentType) {
      case "today":     text = "📰 Roya News · Google Maps · Talabat · Live"; break;
      case "news":      text = "📰 Roya News · Live web search"; break;
      case "rental":    text = "🏡 Jordan neighborhoods · OpenSooq · Live"; break;
      case "lifestyle": text = "🏡 Jordan neighborhoods · Live"; break;
      case "companies": text = "🏢 Company DB · Web search · Live"; break;
      case "tourism":   text = "✈️ Web search · Jordan DB · Live"; break;
      default:          text = "🌐 Web search · Jordan knowledge · Live"; break;
    }
  }
  return <p className="mt-2 text-[10px] text-ink-300 font-medium">{text}</p>;
}

// ── ChatText — renders **bold** markdown, multi-paragraph ────────────────────

function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-ink-900">{part}</strong>
      : part
  );
}

function ChatText({ text, rtl }: { text: string; rtl?: boolean }) {
  // Split on double-newlines first (markdown paragraphs), then single newlines
  // within a paragraph become line breaks. Filter empty lines.
  const paragraphs = text
    .split(/\n{2,}/)
    .flatMap((block) => block.split(/\n/))
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div dir={rtl ? "rtl" : "ltr"} className="space-y-2">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[15px] leading-[1.75] text-ink-800">
          {renderInline(p)}
        </p>
      ))}
    </div>
  );
}

// ── ResponseView — dispatch by response kind ──────────────────────────────────

function ResponseView({ res }: { res: AssistResponse }) {
  const isRtl = /[؀-ۿ]/.test(res.summary);

  /* General answers */
  if (res.kind === "general") {
    const isToday     = res.intentType === "today";
    const isRental    = res.intentType === "rental" || res.intentType === "lifestyle";
    const isNews      = res.intentType === "news";
    const isCompanies = res.intentType === "companies";
    const nbCards     = res.cards as NeighborhoodCard[];
    const infoCards   = res.cards as InfoCard[];

    /* Newspaper front — today digest */
    if (isToday) {
      return (
        <div className="space-y-4">
          <ChatText text={res.summary} rtl={isRtl} />
          <NewspaperFront cards={infoCards} />
          <SourceLine res={res} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ChatText text={res.summary} rtl={isRtl} />

        {isRental && nbCards.length > 0 && (
          <div className="space-y-3">
            <NeighborhoodBestCard item={nbCards[0]!} />
            {nbCards.length > 1 && (
              <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#e8e3da]">
                {nbCards.slice(1).map((nb, i) => (
                  <NeighborhoodAltCard key={nb.name} item={nb} rank={i + 2} />
                ))}
              </div>
            )}
          </div>
        )}

        {isNews && infoCards.length > 0 && (
          <div>
            <SectionLabelWithPulse>Latest from Jordan</SectionLabelWithPulse>
            <div className="mt-2">
              {infoCards.map((card, i) => (
                <NewsInfoCard key={i} item={card} index={i} />
              ))}
            </div>
          </div>
        )}

        {isCompanies && infoCards.length > 0 && (
          <div>
            {infoCards.map((card, i) => (
              <CompanyInfoCard key={i} item={card} index={i} />
            ))}
          </div>
        )}

        {!isRental && !isNews && !isCompanies && infoCards.length > 0 && (
          <div>
            {infoCards.map((card, i) => (
              <GeneralInfoCard key={i} item={card} />
            ))}
          </div>
        )}

        <SourceLine res={res} />
      </div>
    );
  }

  /* No result */
  if (!res.best) {
    return (
      <div className="space-y-2">
        <ChatText text={res.summary} rtl={isRtl} />
        <SourceLine res={res} />
      </div>
    );
  }

  /* Places — chat text → best card → alternatives */
  if (res.kind === "places") {
    return (
      <div className="space-y-4">
        <ChatText text={res.summary} rtl={isRtl} />
        <PlaceBestCard item={res.best} />
        {res.alternatives.length > 0 && (
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#e8e3da]">
            {res.alternatives.map((a, i) => (
              <PlaceAltCard key={a.place.id} item={a} rank={i + 2} />
            ))}
          </div>
        )}
        <SourceLine res={res} />
      </div>
    );
  }

  /* Products — chat text → best card → alternatives */
  return (
    <div className="space-y-4">
      <ChatText text={res.summary} rtl={isRtl} />
      <BestCard item={res.best} />
      {res.alternatives.length > 0 && (
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#e8e3da]">
          {res.alternatives.map((a, i) => (
            <AltCard key={a.listing.id} item={a} rank={i + 2} />
          ))}
        </div>
      )}
      <SourceLine res={res} />
    </div>
  );
}

// ── Section labels ────────────────────────────────────────────────────────────

function SectionLabelWithPulse({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
      </span>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-ink-400">{children}</p>
    </div>
  );
}

// ── Composer — fixed bottom bar ───────────────────────────────────────────────

function Composer({ input, setInput, onSubmit, busy, compact }: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  compact: boolean;
}) {
  const isRtl = /[؀-ۿ]/.test(input);
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 pointer-events-none">
      <div className="h-20 bg-gradient-to-t from-paper to-transparent" />
      <div className="bg-paper pb-5 sm:pb-6 pointer-events-auto">
        <div className="mx-auto max-w-2xl px-4">
          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            className="flex items-end gap-2 rounded-2xl bg-white px-4 py-3 shadow-float ring-1 ring-black/[0.07] transition-shadow focus-within:ring-2 focus-within:ring-souq-500/25"
          >
            <textarea
              dir={isRtl ? "rtl" : "ltr"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
              rows={1}
              placeholder={
                compact
                  ? "Ask anything about Amman…"
                  : "Try: what's happening today, best coffee in Jabal Amman, find a cardiologist…"
              }
              className="max-h-36 flex-1 resize-none bg-transparent py-1 text-[14px] text-ink-900 outline-none placeholder:text-ink-300 leading-relaxed"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white transition enabled:hover:bg-ink-800 disabled:opacity-30 active:scale-95"
            >
              {busy ? <Spinner /> : <SendIcon />}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-ink-300 font-medium">
            ChatSouq uses real Jordan data — it never makes up facts.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// suppress unused warning
void buildHistory;
