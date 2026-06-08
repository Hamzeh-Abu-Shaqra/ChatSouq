"use client";

import { useEffect, useRef, useState } from "react";
import type { AssistResponse, NeighborhoodCard, InfoCard, ConvMessage } from "@chatsouq/core";
import {
  AltCard, BestCard,
  PlaceAltCard, PlaceBestCard,
  NeighborhoodBestCard, NeighborhoodAltCard,
  GeneralInfoCard,
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
  { label: "Which areas in Amman are best to rent for 1,500 JOD/month?", tag: "Real Estate" },
  { label: "Best coffee shop in Amman", tag: "Places" },
  { label: "Wireless headphones under 60 JOD", tag: "Shopping" },
  { label: "Best things to do in Petra", tag: "Tourism" },
  { label: "A pharmacy near Abdoun", tag: "Places" },
  { label: "Family-friendly neighborhoods in Amman", tag: "Real Estate" },
  { label: "Luxury perfume as a wedding gift, around 80 JOD", tag: "Shopping" },
  { label: "What is the weather like in Jordan?", tag: "Info" },
];

export default function Page() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionId = useRef<string>(Math.random().toString(36).slice(2));
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  /**
   * Serialize a response into a rich assistant message for history.
   * Includes what was actually recommended, prices, locations, and reasoning
   * so follow-up queries have full context (e.g. budget changes, area refinements).
   */
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
        const alts = res.alternatives.map((a) => a.place.name).join(", ");
        lines.push(`Also shown: ${alts}`);
      }
    } else if (res.kind === "general" && res.cards.length > 0) {
      if (res.intentType === "rental" || res.intentType === "lifestyle") {
        const nbCards = res.cards as NeighborhoodCard[];
        const areas = nbCards
          .map((nb) => {
            const rent =
              nb.avgRentMin && nb.avgRentMax
                ? ` (${nb.avgRentMin}–${nb.avgRentMax} JOD/month)`
                : "";
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

  /** Build conversation history from all completed turns for context-aware follow-ups. */
  function buildHistory(currentTurns: Turn[]): ConvMessage[] {
    return currentTurns
      .filter((t) => t.status === "done" && t.response)
      .flatMap((t) => [
        { role: "user" as const, content: t.query },
        { role: "assistant" as const, content: buildAssistantContext(t.response!) },
      ])
      .slice(-10); // last 5 exchanges
  }

  async function ask(query: string) {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    const id = Date.now();
    // Capture history before adding the new loading turn
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
        t.map((x) =>
          x.id === id ? { ...x, status: "error", error: (e as Error).message } : x
        )
      );
    } finally {
      setBusy(false);
    }
  }

  const empty = turns.length === 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
      <Header />

      <main className="flex-1 pb-44">
        {empty ? (
          <Hero onPick={ask} />
        ) : (
          <div className="space-y-10 py-6">
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

function Header() {
  return (
    <header className="flex items-center justify-between py-5">
      <div className="flex items-center gap-3">
        <ChatSouqLogo />
        <div className="leading-tight">
          <p className="text-base font-bold tracking-tight text-souq-900">
            Chat<span className="text-souq-600">Souq</span>
          </p>
          <p className="text-[11px] text-souq-800/55">Jordan's AI for anything</p>
        </div>
      </div>
      <span className="rounded-full bg-souq-50 px-3 py-1 text-[11px] font-medium text-souq-700 ring-1 ring-souq-500/20">
        Beta
      </span>
    </header>
  );
}

function ChatSouqLogo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-souq-500 to-souq-700 text-white shadow-best">
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
        <path d="M6 10C6 8.9 6.9 8 8 8h16c1.1 0 2 .9 2 2v2H6v-2z" fill="white" fillOpacity="0.9"/>
        <path d="M6 12h20l-2 12a2 2 0 01-2 2H10a2 2 0 01-2-2L6 12z" fill="white" fillOpacity="0.75"/>
        <circle cx="12" cy="19" r="1.5" fill="white" fillOpacity="0.5"/>
        <circle cx="20" cy="19" r="1.5" fill="white" fillOpacity="0.5"/>
        <path d="M12 24h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6"/>
      </svg>
    </div>
  );
}

function Hero({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-8 text-center sm:pt-14">
      <div className="mb-5 flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-medium text-souq-700 shadow-card ring-1 ring-souq-500/15">
        <span className="h-1.5 w-1.5 rounded-full bg-souq-500" />
        Jordan · Real data · No made-up answers
      </div>

      <h1 className="max-w-xl text-3xl font-bold leading-tight text-souq-900 sm:text-5xl">
        Ask anything about
        <br />
        <span className="text-souq-600">Jordan</span>
      </h1>
      <p className="mt-4 max-w-lg text-base text-souq-800/65 sm:text-lg">
        Neighborhoods to rent in, restaurants to visit, products to buy, tourist
        spots, government services — ChatSouq reasons over real Jordan data and gives
        you a direct, accurate answer.
      </p>

      <div className="mt-8 w-full max-w-2xl">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              onClick={() => onPick(ex.label)}
              className="group flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-souq-500/30"
            >
              <span className="mt-0.5 rounded-full bg-souq-50 px-2 py-0.5 text-[10px] font-semibold text-souq-600 shrink-0">
                {ex.tag}
              </span>
              <span className="text-sm text-souq-800 group-hover:text-souq-700">{ex.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const isRtl = /[؀-ۿ]/.test(turn.query);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div
          dir={isRtl ? "rtl" : "ltr"}
          className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-souq-600 to-souq-700 px-4 py-2.5 text-sm text-white shadow-card"
        >
          {turn.query}
        </div>
      </div>

      {turn.status === "loading" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-souq-800/60">
            <Spinner /> Thinking…
          </div>
          <SkeletonCard />
        </div>
      )}

      {turn.status === "error" && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {turn.error ?? "Something went wrong."}
        </div>
      )}

      {turn.status === "done" && turn.response && <ResponseView res={turn.response} />}
    </div>
  );
}

function ResponseView({ res }: { res: AssistResponse }) {
  // General Q&A (rental, neighborhoods, info, tourism, etc.)
  if (res.kind === "general") {
    const isRental = res.intentType === "rental" || res.intentType === "lifestyle";
    const nbCards = res.cards as NeighborhoodCard[];
    const infoCards = res.cards as InfoCard[];

    return (
      <div className="space-y-4">
        <div
          dir={/[؀-ۿ]/.test(res.summary) ? "rtl" : "ltr"}
          className="rounded-2xl bg-white px-4 py-3 text-sm text-souq-800 shadow-card ring-1 ring-black/5 leading-relaxed"
        >
          {res.summary}
        </div>

        {isRental && nbCards.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-souq-800/50">
              {nbCards.length} area{nbCards.length > 1 ? "s" : ""} that fit your budget
            </p>
            <NeighborhoodBestCard item={nbCards[0]!} />
            {nbCards.length > 1 && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-souq-800/50">
                  Other areas to consider
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {nbCards.slice(1).map((nb, i) => (
                    <NeighborhoodAltCard key={nb.name} item={nb} rank={i + 2} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!isRental && infoCards.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {infoCards.map((card, i) => (
              <GeneralInfoCard key={i} item={card} />
            ))}
          </div>
        )}

        <p className="pt-1 text-[11px] text-souq-800/35">
          Answered by ChatSouq · {res.meta.tookMs} ms · {res.meta.provider}
        </p>
      </div>
    );
  }

  // No results at all
  if (!res.best) {
    return (
      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-souq-800 shadow-card ring-1 ring-black/5">
        {res.summary}
      </div>
    );
  }

  const meta = (
    <p className="pt-1 text-[11px] text-souq-800/35">
      {res.meta.candidateCount} candidates · {res.meta.tookMs} ms · {res.meta.provider}/{res.meta.embedder}
    </p>
  );

  // Places response
  if (res.kind === "places") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-souq-800/80">{res.summary}</p>
        <PlaceBestCard item={res.best} />
        {res.alternatives.length > 0 && (
          <>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-souq-800/50">
              Other places worth considering
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {res.alternatives.map((a, i) => (
                <PlaceAltCard key={a.place.id} item={a} rank={i + 2} />
              ))}
            </div>
          </>
        )}
        {meta}
      </div>
    );
  }

  // Products response
  return (
    <div className="space-y-4">
      <p className="text-sm text-souq-800/80">{res.summary}</p>
      <BestCard item={res.best} />
      {res.alternatives.length > 0 && (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-souq-800/50">
            Other options worth considering
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {res.alternatives.map((a, i) => (
              <AltCard key={a.listing.id} item={a} rank={i + 2} />
            ))}
          </div>
        </>
      )}
      {meta}
    </div>
  );
}

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
    <div className="fixed inset-x-0 bottom-0 z-10">
      <div className="pointer-events-none h-16 bg-gradient-to-t from-[#faf9f6] to-transparent" />
      <div className="bg-[#faf9f6] pb-6">
        <div className="mx-auto max-w-3xl px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex items-end gap-2 rounded-2xl bg-white p-2 shadow-card ring-1 ring-souq-500/20 focus-within:ring-2 focus-within:ring-souq-500/40 transition-shadow"
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
              className="max-h-36 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-souq-900 outline-none placeholder:text-souq-800/35"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-souq-600 text-white transition enabled:hover:bg-souq-700 disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Spinner light /> : <SendIcon />}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-souq-800/35">
            ChatSouq uses real Jordan data — it never makes up facts or numbers.
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner({ light }: { light?: boolean }) {
  return (
    <svg
      className={`animate-spin ${light ? "text-white" : "text-souq-600"}`}
      width="16" height="16" viewBox="0 0 24 24" fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 12l16-8-6 16-3-7-7-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
