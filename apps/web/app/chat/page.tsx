"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { AssistResponse, NeighborhoodCard, InfoCard, ConvMessage, QueryContext } from "@chatsouq/core";
import {
  NeighborhoodBestCard, NeighborhoodAltCard,
  GeneralInfoCard, NewsInfoCard, CompanyInfoCard,
  NewspaperFront, SkeletonCard,
} from "../../components/cards";
import { ResponseContainer } from "../../components/response/ResponseContainer";
import { adaptResponse } from "../../types/vendor";
import { assembleContext, assembleContextSync } from "../../lib/signals/contextAssembler";
import LocationBanner from "../../components/ui/LocationBanner";
import ContextIndicator from "../../components/ui/ContextIndicator";

const SESSION_KEY = "chatsouq_session_id";
const HISTORY_KEY = "chatsouq_local_history";

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

interface LocalHistoryItem {
  id: number;
  query: string;
  timestamp: number;
}

function getLocalHistory(): LocalHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveToLocalHistory(query: string, id: number) {
  const prev = getLocalHistory().filter((h) => h.query !== query);
  const updated = [{ id, query, timestamp: Date.now() }, ...prev].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

function deleteFromLocalHistory(id: number) {
  const updated = getLocalHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

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

// ── Inner page that uses search params ────────────────────────────────────────

function ChatPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [input, setInput]                 = useState("");
  const [turns, setTurns]                 = useState<Turn[]>([]);
  const [busy, setBusy]                   = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [memoryActive, setMemoryActive]   = useState(false);
  const [localHistory, setLocalHistory]   = useState<LocalHistoryItem[]>([]);
  const [activeContext, setActiveContext] = useState<QueryContext | null>(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const sessionIdRef      = useRef<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const bottomRef         = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLTextAreaElement>(null);
  const didInitRef        = useRef(false);

  /* Assemble Tier 1 context signals ---------------------------------------- */
  useEffect(() => {
    // Sync context (temporal + history) immediately — no async needed
    const syncCtx = assembleContextSync();
    setActiveContext(syncCtx as QueryContext);
    // Full context (with IP geolocation) in background — updates quietly
    assembleContext(false).then(setActiveContext).catch(() => {});
  }, []);

  /* Restore session --------------------------------------------------------- */
  useEffect(() => {
    const sid = getOrCreateSessionId();
    sessionIdRef.current = sid;
    setLocalHistory(getLocalHistory());
    fetch(`/api/history?sessionId=${encodeURIComponent(sid)}`)
      .then((r) => r.json())
      .then((data: { conversationId: string | null; messages: ConvMessage[]; prefs: Record<string, unknown>; turnCount: number }) => {
        conversationIdRef.current = data.conversationId;
        if (data.prefs && Object.keys(data.prefs).length > 0) setMemoryActive(true);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []);

  /* Fire initial query from URL ?q= ---------------------------------------- */
  useEffect(() => {
    if (!historyLoaded) return;
    if (didInitRef.current) return;
    if (initialQ) {
      didInitRef.current = true;
      ask(initialQ);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoaded, initialQ]);

  // Scroll only when a new turn is added (user submits a query).
  // Do NOT scroll when status changes loading→done — that causes the jarring
  // double-scroll: once when query is sent, again when results expand in.
  const turnCount = turns.length;
  useEffect(() => {
    if (turnCount > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turnCount]);

  /* Follow-up events from ResponseContainer --------------------------------- */
  useEffect(() => {
    function handleFollowUp(e: Event) {
      const detail = (e as CustomEvent<{ prompt: string }>).detail;
      if (detail?.prompt) ask(detail.prompt);
    }
    window.addEventListener("chatsouq:followup", handleFollowUp);
    return () => window.removeEventListener("chatsouq:followup", handleFollowUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  /* Feedback ---------------------------------------------------------------- */
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
    saveToLocalHistory(q, id);
    setLocalHistory(getLocalHistory());
    setTurns((t) => [...t, { id, query: q, status: "loading" }]);
    // Clear URL param after first ask
    if (initialQ && turns.length === 0) {
      router.replace("/chat", { scroll: false });
    }
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, sessionId: sessionIdRef.current, context: activeContext }),
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
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function newConversation() {
    const fresh = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, fresh);
    sessionIdRef.current = fresh;
    conversationIdRef.current = null;
    setTurns([]);
    setMemoryActive(false);
    router.replace("/chat", { scroll: false });
  }

  const empty = turns.length === 0 && historyLoaded;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">

      {/* ── SIDEBAR (desktop) ───────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-[280px] flex-shrink-0 border-r overflow-y-auto"
        style={{ borderColor: "#E8E4DC", borderRightWidth: "0.5px", background: "#F9F8F6" }}
      >
        <div className="p-4 space-y-3">
          {/* New search button */}
          <button
            onClick={newConversation}
            className="w-full text-[14px] font-medium py-2 px-4 rounded-lg transition-colors"
            style={{ border: "0.5px solid #C9A84C", color: "#C9A84C" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#FBF4E3"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
          >
            + New search
          </button>

          <div style={{ borderTop: "0.5px solid #E8E4DC", margin: "4px 0" }} />

          {/* Chat history */}
          {localHistory.length > 0 ? (
            <>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em] px-1"
                style={{ color: "#9ca3af" }}
              >
                Recent
              </p>
              <div className="space-y-0.5">
                {localHistory.slice(0, 20).map((h) => (
                  <div
                    key={h.id}
                    className="group flex items-center gap-1 rounded-lg transition-colors"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F3F1EE"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                  >
                    <button
                      onClick={() => ask(h.query)}
                      className="flex-1 text-left px-2 py-2 min-w-0"
                    >
                      <p className="text-[13px] text-[#1A1A1A] truncate">{h.query}</p>
                      <p className="text-[11px] text-[#9ca3af] mt-0.5">
                        {new Date(h.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </button>
                    {/* Per-item delete — visible on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFromLocalHistory(h.id);
                        setLocalHistory(getLocalHistory());
                      }}
                      className="flex-shrink-0 mr-1 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af"; }}
                      style={{ color: "#9ca3af" }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-[#9ca3af] px-1 py-2">No history yet</p>
          )}
        </div>

        {/* Bottom: clear history */}
        {localHistory.length > 0 && (
          <div className="mt-auto p-4 border-t" style={{ borderTopWidth: "0.5px", borderColor: "#E8E4DC" }}>
            <button
              className="text-[12px] text-[#9ca3af] hover:text-[#1A1A1A] transition-colors"
              onClick={() => {
                localStorage.removeItem(HISTORY_KEY);
                setLocalHistory([]);
              }}
            >
              Clear history
            </button>
          </div>
        )}
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Location permission banner — slim 40px, shown once per session */}
        <LocationBanner
          onLocationResolved={(nb) => {
            setActiveContext((prev) => prev
              ? { ...prev, location: { source: "gps", neighborhood: nb, governorate: "Amman", lat: null, lng: null, accuracyM: null } }
              : null
            );
          }}
        />
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {empty ? (
              <EmptyState onAsk={ask} memoryActive={memoryActive} />
            ) : (
              <div className="space-y-10 pb-32">
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
          </div>
        </div>

        {/* ── BOTTOM INPUT BAR ──────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 border-t px-4 py-3"
          style={{ borderTopWidth: "0.5px", borderColor: "#E8E4DC", background: "#F9F8F6" }}
        >
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={(e) => { e.preventDefault(); ask(input); }}
              className="flex items-end gap-2 bg-white rounded-xl px-4 py-3"
              style={{ border: "0.5px solid #E8E4DC" }}
              onFocus={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = "#C9A84C"; }}
              onBlur={(e) => { (e.currentTarget as HTMLFormElement).style.borderColor = "#E8E4DC"; }}
            >
              <textarea
                ref={inputRef}
                dir={/[؀-ۿ]/.test(input) ? "rtl" : "ltr"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
                rows={1}
                placeholder={turns.length > 0 ? "Ask a follow-up or search something new…" : "Ask anything in Amman…"}
                className="flex-1 resize-none bg-transparent outline-none text-[14px] text-[#1A1A1A] placeholder:text-[#9ca3af] leading-relaxed max-h-36"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition disabled:opacity-30 active:scale-95"
                style={{ background: "#C9A84C" }}
                onMouseEnter={(e) => { if (!busy && input.trim()) (e.currentTarget as HTMLButtonElement).style.background = "#b8963e"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C9A84C"; }}
              >
                {busy ? <Spinner /> : <SendIcon />}
              </button>
            </form>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[11px] text-[#9ca3af]">
                ChatSouq knows Amman · Ask anything
              </p>
              <ContextIndicator context={activeContext} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EMPTY STATE ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Romantic dinner in Weibdeh under 60 JOD",
  "أحتاج هدية عيد لأمي تحت ٥٠ دينار",
  "Best gym near Abdoun with a pool",
  "What's new in Amman this week?",
  "Family activities this Friday in Amman",
  "Coffee shop in Jabal Amman for working",
  "Spa day for two under 80 JOD",
  "New restaurants opened this month",
];

function EmptyState({ onAsk, memoryActive }: { onAsk: (q: string) => void; memoryActive: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] py-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#C9A84C" }}>
        ◆ ChatSouq
      </p>
      <h1 className="font-serif text-[1.8rem] font-medium text-[#1A1A1A] mb-2 text-center">
        Ask anything in Amman
      </h1>
      <p className="text-[14px] text-[#6B7280] text-center mb-8 max-w-sm">
        Describe what you&apos;re looking for in plain language.
        {memoryActive && (
          <span className="ml-1 text-[#7A5C10]">I remember your preferences.</span>
        )}
      </p>

      {/* Suggestion chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onAsk(s)}
            className="text-left px-4 py-3 rounded-lg text-[13px] text-[#374151] transition-all"
            style={{ border: "0.5px solid #E8E4DC" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "#FBF4E3";
              el.style.borderColor = "#E8D5A0";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "";
              el.style.borderColor = "#E8E4DC";
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── TURN VIEW ─────────────────────────────────────────────────────────────────

function TurnView({ turn, onFeedback }: { turn: Turn; onFeedback: (rating: 1 | -1, clickedId?: number) => void }) {
  const isRtl = /[؀-ۿ]/.test(turn.query);
  return (
    <div className="space-y-4 animate-fade-up">
      {/* User bubble */}
      <div className="flex justify-end">
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-[14px] leading-relaxed text-white"
          style={{ background: "#1A1A1A" }}
        >
          {turn.query}
        </div>
      </div>

      {/* AI response */}
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: "#C9A84C" }}
        >
          <span className="text-white text-[11px] font-bold select-none">CS</span>
        </div>
        <div className="min-w-0 flex-1">
          {turn.status === "loading" && (
            <div className="rounded-xl px-4 py-4 space-y-4" style={{ background: "#F3F1EE" }}>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: "#C9A84C" }} />
                <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: "#C9A84C" }} />
                <span className="typing-dot h-1.5 w-1.5 rounded-full" style={{ background: "#C9A84C" }} />
              </div>
              <SkeletonCard />
            </div>
          )}
          {turn.status === "error" && (
            <div className="rounded-xl px-4 py-3 text-[13px] text-rose-700 bg-rose-50 border border-rose-100">
              {turn.error ?? "Something went wrong — please try again."}
            </div>
          )}
          {turn.status === "done" && turn.response && (
            <>
              <div className="rounded-xl px-4 py-4" style={{ background: "#F3F1EE" }}>
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

// ── RESPONSE VIEW ─────────────────────────────────────────────────────────────

function ResponseView({ res }: { res: AssistResponse }) {
  const isRtl = /[؀-ۿ]/.test(res.summary);

  if (res.kind === "general") {
    const isToday     = res.intentType === "today";
    const isRental    = res.intentType === "rental" || res.intentType === "lifestyle";
    const isNews      = res.intentType === "news";
    const isCompanies = res.intentType === "companies";
    const nbCards     = res.cards as NeighborhoodCard[];
    const infoCards   = res.cards as InfoCard[];

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
            <SectionPulseLabel>Latest from Jordan</SectionPulseLabel>
            <div className="mt-2">
              {infoCards.map((card, i) => <NewsInfoCard key={i} item={card} index={i} />)}
            </div>
          </div>
        )}
        {isCompanies && infoCards.length > 0 && (
          <div>{infoCards.map((card, i) => <CompanyInfoCard key={i} item={card} index={i} />)}</div>
        )}
        {!isRental && !isNews && !isCompanies && infoCards.length > 0 && (
          <div>{infoCards.map((card, i) => <GeneralInfoCard key={i} item={card} />)}</div>
        )}
        <SourceLine res={res} />
      </div>
    );
  }

  if (res.kind === "places" || res.kind === "products") {
    const tookMs = res.meta?.tookMs ?? 0;
    const chatResponse = adaptResponse(res, tookMs);
    if (!chatResponse) {
      return (
        <div className="space-y-2">
          <ChatText text={res.summary} rtl={isRtl} />
          <SourceLine res={res} />
        </div>
      );
    }
    return (
      <div style={{ margin: "0 -16px" }}>
        <ResponseContainer response={chatResponse} />
        <div style={{ padding: "0 16px" }}>
          <SourceLine res={res} />
        </div>
      </div>
    );
  }

  const anyRes = res as AssistResponse;
  return (
    <div className="space-y-2">
      <ChatText text={anyRes.summary} rtl={isRtl} />
      <SourceLine res={anyRes} />
    </div>
  );
}

// ── FEEDBACK ROW ─────────────────────────────────────────────────────────────

function FeedbackRow({ feedback, onThumbUp, onThumbDown }: {
  feedback?: 1 | -1;
  onThumbUp: () => void;
  onThumbDown: () => void;
}) {
  if (feedback !== undefined) {
    return (
      <p className="mt-2 text-[10px] text-[#9ca3af]">
        {feedback === 1 ? "👍 Thanks — noted!" : "👎 Got it — I'll improve."}
      </p>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[10px] text-[#9ca3af]">Helpful?</span>
      <button
        onClick={onThumbUp}
        className="rounded-md p-1 text-[#9ca3af] hover:bg-[#FBF4E3] hover:text-[#C9A84C] transition-colors"
      >
        <ThumbUpIcon />
      </button>
      <button
        onClick={onThumbDown}
        className="rounded-md p-1 text-[#9ca3af] hover:bg-rose-50 hover:text-rose-500 transition-colors"
      >
        <ThumbDownIcon />
      </button>
    </div>
  );
}

// ── SOURCE LINE ───────────────────────────────────────────────────────────────

function SourceLine({ res }: { res: AssistResponse }) {
  let text: string;
  if (res.kind === "products") {
    text = "🛍 Jordan product catalog · Live";
  } else if (res.kind === "places") {
    const hasPro = res.best && /^(doctor|dentist|physician|lawyer|attorney|accountant|architect|engineer|pharmacist|specialist|professional)/i.test(res.best.place.category);
    text = hasPro ? "👩‍⚕️ Professional directory · Google Maps · Live" : "📍 Google Maps · Talabat · Jordan DB · Live";
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
  return <p className="mt-2 text-[10px] text-[#9ca3af] font-medium">{text}</p>;
}

// ── CHAT TEXT ─────────────────────────────────────────────────────────────────

function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-[#1A1A1A]">{part}</strong>
      : part
  );
}

function ChatText({ text, rtl }: { text: string; rtl?: boolean }) {
  const paragraphs = text.split(/\n{2,}/).flatMap((b) => b.split(/\n/)).map((p) => p.trim()).filter(Boolean);
  return (
    <div dir={rtl ? "rtl" : "ltr"} className="space-y-2">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[15px] leading-[1.75] text-[#374151]">{renderInline(p)}</p>
      ))}
    </div>
  );
}

// ── SECTION PULSE LABEL ───────────────────────────────────────────────────────

function SectionPulseLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
      </span>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9ca3af]">{children}</p>
    </div>
  );
}

// ── ICONS ─────────────────────────────────────────────────────────────────────

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

function ThumbUpIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
      <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
      <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
    </svg>
  );
}

// ── Page export (wrapped in Suspense for useSearchParams) ─────────────────────

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="text-[#9ca3af] text-[14px]">Loading…</div>
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  );
}
