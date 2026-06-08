"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AssistResponse, NeighborhoodCard, InfoCard, ConvMessage } from "@chatsouq/core";
import {
  AltCard, BestCard,
  PlaceAltCard, PlaceBestCard,
  NeighborhoodBestCard, NeighborhoodAltCard,
  GeneralInfoCard,
  NewsInfoCard,
  CompanyInfoCard,
  NewspaperFront,
  SkeletonCard,
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

// ── Example queries covering all 10 data categories ──────────────────────────

interface Example {
  label: string;
  tag: string;
  icon: string;
}

const EXAMPLES: Example[] = [
  { label: "What's happening in Amman today?",                  tag: "Today",    icon: "📰" },
  { label: "Best coffee in Jabal Amman",                        tag: "Food",     icon: "🍽" },
  { label: "Find a cardiologist in Amman",                      tag: "Health",   icon: "🏥" },
  { label: "Hotels near 4th Circle under 60 JOD",              tag: "Hotels",   icon: "🏨" },
  { label: "Rent an apartment in Sweifieh",                     tag: "Rentals",  icon: "🏡" },
  { label: "Best gym in Abdoun",                                tag: "Fitness",  icon: "💪" },
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Today:     { bg: "#fff1f2", text: "#be123c" },
  News:      { bg: "#fff1f2", text: "#be123c" },
  Food:      { bg: "#fffbeb", text: "#92400e" },
  Health:    { bg: "#ecfdf5", text: "#065f46" },
  Shopping:  { bg: "#fff7ed", text: "#9a3412" },
  Hotels:    { bg: "#f0fdfa", text: "#134e4a" },
  Education: { bg: "#eef2ff", text: "#3730a3" },
  Services:  { bg: "#f5f3ff", text: "#5b21b6" },
  Rentals:   { bg: "#eff6ff", text: "#1d4ed8" },
  Fitness:   { bg: "#ecfdf5", text: "#065f46" },
  Tourism:   { bg: "#faf5ff", text: "#6b21a8" },
  Companies: { bg: "#eef2ff", text: "#3730a3" },
  Places:    { bg: "#fffbeb", text: "#92400e" },
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
    if (res.alternatives.length > 0) {
      lines.push(`Also shown: ${res.alternatives.map((a) => `${a.listing.name}${a.listing.price != null ? ` (${a.listing.price} JOD)` : ""}`).join(", ")}`);
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
      const areas = nbCards.map((nb) => {
        const rent = nb.avgRentMin && nb.avgRentMax ? ` (${nb.avgRentMin}–${nb.avgRentMax} JOD/month)` : "";
        return `${nb.name}${rent}`;
      }).join("; ");
      lines.push(`Areas: ${areas}`);
    } else if (res.intentType === "today") {
      const cards = res.cards as InfoCard[];
      const newsCards = cards.filter((c) => c.section === "news").slice(0, 3);
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
      { role: "user" as const, content: t.query },
      { role: "assistant" as const, content: buildAssistantContext(t.response!) },
    ])
    .slice(-10);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [input, setInput]         = useState("");
  const [turns, setTurns]         = useState<Turn[]>([]);
  const [busy, setBusy]           = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [memoryActive, setMemoryActive]   = useState(false);
  const sessionIdRef     = useRef<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const bottomRef        = useRef<HTMLDivElement>(null);

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
                  kind: "general",
                  query: uMsg.content,
                  intentType: "general",
                  summary: aMsg.content,
                  cards: [],
                  meta: { provider: "restored", tookMs: 0 },
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
      if ((data as { conversationId?: string }).conversationId) {
        conversationIdRef.current = (data as { conversationId?: string }).conversationId ?? null;
      }
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

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ memoryActive, onNewConversation }: { memoryActive: boolean; onNewConversation: () => void }) {
  return (
    <header className="flex items-center justify-between py-4 border-b border-black/[0.06]">
      <div className="flex items-center gap-2.5">
        <ChatSouqLogo />
        <span className="text-[15px] font-bold tracking-tight text-ink-900">
          Chat<span className="text-souq-600">Souq</span>
        </span>
        <span className="hidden sm:inline text-[11px] text-ink-400 font-medium">Jordan&apos;s AI</span>
      </div>
      <div className="flex items-center gap-3">
        {memoryActive && (
          <div className="hidden sm:flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 ring-1 ring-violet-200/60">
            <span className="text-[10px]">🧠</span>
            <span className="text-[10px] font-semibold text-violet-600 tracking-wide">Personalised</span>
          </div>
        )}
        <button
          onClick={onNewConversation}
          title="New conversation"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-ink-500 ring-1 ring-black/[0.08] transition hover:bg-sand-50 hover:text-ink-800"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          New
        </button>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-souq-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-souq-500" />
          </span>
          <span className="text-[11px] font-medium text-ink-400">Live</span>
        </div>
      </div>
    </header>
  );
}

function ChatSouqLogo({ size = 30 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm">
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

// ── Hero ──────────────────────────────────────────────────────────────────────

const DATA_STATS = [
  { emoji: "📍", label: "1,142 places" },
  { emoji: "👩‍⚕️", label: "88 professionals" },
  { emoji: "🍽", label: "Talabat restaurants" },
  { emoji: "📰", label: "Live news" },
  { emoji: "🛍", label: "30k+ products" },
];

function Hero({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-10 sm:pt-16 text-center">
      {/* Live data stats strip */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        {DATA_STATS.map((s, i) => (
          <span key={s.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-200 text-xs select-none">·</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 ring-1 ring-black/[0.07] shadow-sm">
              <span>{s.emoji}</span>{s.label}
            </span>
          </span>
        ))}
      </div>

      {/* Main headline */}
      <h1 className="text-[52px] sm:text-[72px] font-black tracking-[-0.035em] leading-[0.9] text-ink-900">
        Ask anything
        <br />
        <span className="text-souq-600">about Amman.</span>
      </h1>

      <p className="mt-4 text-[15px] font-medium text-ink-400 tracking-wide" dir="rtl" lang="ar">
        استفسر عن أي شيء في عمّان
      </p>

      {/* TODAY button — prominently featured */}
      <button
        onClick={() => onPick("What's happening in Amman today?")}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-ink-900 px-5 py-3 text-[13px] font-bold text-white shadow-float transition-all hover:bg-ink-800 hover:-translate-y-0.5 active:scale-95"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
        Today in Amman
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">LIVE</span>
      </button>

      {/* Quick action pills */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {[
          { label: "🍽 Food", q: "Best restaurants in Amman" },
          { label: "🏥 Doctors", q: "Find a doctor in Amman" },
          { label: "🏨 Hotels", q: "Hotels in Amman" },
          { label: "🏡 Rent", q: "Rent an apartment in Amman" },
          { label: "📰 News", q: "Latest news from Jordan" },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => onPick(p.q)}
            className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-ink-600 ring-1 ring-black/[0.08] shadow-sm transition hover:bg-souq-50 hover:ring-souq-300 hover:text-souq-700"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Example queries grid */}
      <div className="mt-8 w-full max-w-2xl grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EXAMPLES.map((ex) => {
          const colors = TAG_COLORS[ex.tag] ?? { bg: "#f3ede2", text: "#374151" };
          return (
            <button
              key={ex.label}
              onClick={() => onPick(ex.label)}
              className="group flex items-start gap-3 rounded-xl bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-black/[0.07] transition-all duration-150 hover:-translate-y-px hover:shadow-card hover:ring-black/[0.12]"
            >
              <span
                className="mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider leading-none"
                style={{ background: colors.bg, color: colors.text }}
              >
                {ex.icon}
              </span>
              <span className="text-[13px] text-ink-700 group-hover:text-ink-900 transition-colors leading-snug">
                {ex.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-8 text-[11px] text-ink-300 font-medium tracking-wide">
        Real Amman data · No hallucinations · Updates daily
      </p>
    </div>
  );
}

// ── Turn (one Q&A) ────────────────────────────────────────────────────────────

function TurnView({ turn, onFeedback }: { turn: Turn; onFeedback: (rating: 1 | -1, clickedId?: number) => void }) {
  const isRtl = /[؀-ۿ]/.test(turn.query);

  return (
    <div className="space-y-5">
      {/* User bubble */}
      <div className="flex justify-end">
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="max-w-[80%] rounded-2xl rounded-br-sm bg-ink-900 px-4 py-3 text-[14px] leading-relaxed text-white shadow-sm"
        >
          {turn.query}
        </div>
      </div>

      {/* AI response */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-souq-600 shadow-sm">
          <MiniLogo />
        </div>
        <div className="min-w-0 flex-1">
          {turn.status === "loading" && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 pt-1.5">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-souq-500" />
              </div>
              <SkeletonCard />
            </div>
          )}

          {turn.status === "error" && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700 ring-1 ring-red-100">
              {turn.error ?? "Something went wrong — please try again."}
            </div>
          )}

          {turn.status === "done" && turn.response && (
            <>
              <ResponseView res={turn.response} />
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

// ── Feedback row ──────────────────────────────────────────────────────────────

function FeedbackRow({ feedback, onThumbUp, onThumbDown }: { feedback?: 1 | -1; onThumbUp: () => void; onThumbDown: () => void }) {
  if (feedback !== undefined) {
    return (
      <p className="mt-2 text-[10px] text-ink-300">
        {feedback === 1 ? "👍 Thanks — noted!" : "👎 Got it — I'll improve."}
      </p>
    );
  }
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <span className="text-[10px] text-ink-300">Helpful?</span>
      <button onClick={onThumbUp} title="Good answer"
        className="rounded-md p-1 text-ink-300 transition hover:bg-souq-50 hover:text-souq-600">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
          <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
        </svg>
      </button>
      <button onClick={onThumbDown} title="Not helpful"
        className="rounded-md p-1 text-ink-300 transition hover:bg-red-50 hover:text-red-500">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
          <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
        </svg>
      </button>
    </div>
  );
}

// ── Source line ───────────────────────────────────────────────────────────────

function SourceLine({ res }: { res: AssistResponse }) {
  let text: string;
  if (res.kind === "products") {
    text = "🛍 Jordan product catalog · Live";
  } else if (res.kind === "places") {
    // Detect if professionals are in the results
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
  return <p className="mt-2 text-[10px] text-ink-300">{text}</p>;
}

// ── Response dispatcher ───────────────────────────────────────────────────────

function ResponseView({ res }: { res: AssistResponse }) {
  const isRtl = /[؀-ۿ]/.test(res.summary);
  const summaryEl = (
    <p dir={isRtl ? "rtl" : "ltr"} className="text-[14px] leading-relaxed text-ink-700">
      {res.summary}
    </p>
  );

  // ── General ──
  if (res.kind === "general") {
    const isToday     = res.intentType === "today";
    const isRental    = res.intentType === "rental" || res.intentType === "lifestyle";
    const isNews      = res.intentType === "news";
    const isCompanies = res.intentType === "companies";
    const nbCards     = res.cards as NeighborhoodCard[];
    const infoCards   = res.cards as InfoCard[];

    // Newspaper front page layout for today digest
    if (isToday) {
      return (
        <div className="space-y-4">
          {summaryEl}
          <NewspaperFront cards={infoCards} />
          <SourceLine res={res} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {summaryEl}

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

  // ── Places (context-aware cards) ──
  if (res.kind === "places") {
    const bestLabel = /^(doctor|dentist|physician|lawyer|attorney|accountant|architect|engineer|pharmacist|specialist)/i.test(res.best.place.category)
      ? "Top professional"
      : /^(hotel|hostel|guest.house)/i.test(res.best.place.category)
      ? "Top hotel"
      : /^(restaurant|cafe|coffee|food)/i.test(res.best.place.category)
      ? "Top pick"
      : "Best match";

    return (
      <div className="space-y-4">
        {summaryEl}
        <SectionLabel>{bestLabel}</SectionLabel>
        <PlaceBestCard item={res.best} />
        {res.alternatives.length > 0 && (
          <>
            <SectionLabel className="mt-6">Other options</SectionLabel>
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
      <SectionLabel>Best match</SectionLabel>
      <BestCard item={res.best} />
      {res.alternatives.length > 0 && (
        <>
          <SectionLabel className="mt-6">Also worth considering</SectionLabel>
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

// ── Section labels ────────────────────────────────────────────────────────────

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-widest text-ink-400 ${className}`}>
      {children}
    </p>
  );
}

function SectionLabelWithPulse({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: "#f43f5e" }} />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#e11d48" }} />
      </span>
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{children}</p>
    </div>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────

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
          <p className="mt-2 text-center text-[10px] text-ink-300">
            ChatSouq uses real Jordan data — it never makes up facts.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Micro icons ───────────────────────────────────────────────────────────────

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
