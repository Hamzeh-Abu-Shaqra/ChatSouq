/**
 * tavilyEnrichment.ts
 *
 * Per-place Tavily web-validation for the ChatSouq Places engine.
 *
 * For each ranked place we run a targeted Tavily search (name + location + category)
 * and parse:
 *   validated:       did Tavily return results that name this place?
 *   warningFlags:    "Permanently closed", "Temporarily closed", "Has moved", …
 *   sentimentScore:  −1 to +1 from review-signal word density
 *   mentionCount:    how many web results mention the place
 *   sourceSummary:   first 200 chars from the best result
 *
 * Results are cached in-memory (6 h TTL) so warm Lambda invocations never
 * re-call Tavily for a recently-validated place.
 *
 * Falls back gracefully to empty signals when TAVILY_API_KEY is not set.
 */

import { webSearch } from "./web-search";
import type { TavilySignal } from "./types";

// ── In-memory cache ───────────────────────────────────────────────────────────

const TTL_MS     = 6 * 60 * 60 * 1_000; // 6 hours
const CACHE_MAX  = 500;

interface CacheEntry { signal: TavilySignal; expiresAt: number }

const signalCache = new Map<number, CacheEntry>();

function getCached(placeId: number): TavilySignal | null {
  const entry = signalCache.get(placeId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { signalCache.delete(placeId); return null; }
  return entry.signal;
}

function setCached(signal: TavilySignal): void {
  if (signalCache.size >= CACHE_MAX) {
    const first = signalCache.keys().next().value;
    if (first !== undefined) signalCache.delete(first);
  }
  signalCache.set(signal.placeId, { signal, expiresAt: Date.now() + TTL_MS });
}

// ── Warning pattern detection ─────────────────────────────────────────────────

const WARNING_PATTERNS: { pattern: RegExp; flag: string }[] = [
  {
    pattern: /permanently\s+closed|closed\s+down|shut\s+down|shut\s+permanently|out\s+of\s+business|no\s+longer\s+(open|operating)/i,
    flag: "Permanently closed",
  },
  {
    pattern: /temporarily\s+closed|closed\s+for\s+(renovation|repairs?|refurbishment)|under\s+renovation|temporarily\s+unavailable/i,
    flag: "Temporarily closed",
  },
  {
    pattern: /has\s+moved|new\s+location|relocated|new\s+address/i,
    flag: "Has moved — verify location",
  },
  {
    pattern: /\b(scam|fraud|fake(?:\s+place)?|major\s+issues?|strongly\s+avoid)\b/i,
    flag: "Caution — reported issues",
  },
];

// Single-word positive / negative review signals (global flag → matchAll count)
const POSITIVE_WORDS = [
  "recommend", "excellent", "loved", "favourite", "favorite", "outstanding",
  "must-visit", "hidden gem", "authentic", "quality", "clean", "friendly",
  "professional", "cozy", "cosy", "tasty", "delicious", "spotless",
];
const NEGATIVE_WORDS = [
  "disappoint", "awful", "terrible", "worst", "avoid", "rude",
  "overpriced", "dirty", "not worth", "horrible", "never again",
  "poor service", "disgusting",
];

function countMatches(text: string, words: string[]): number {
  return words.reduce((n, w) => n + (text.toLowerCase().includes(w) ? 1 : 0), 0);
}

// ── Input type ────────────────────────────────────────────────────────────────

export interface EnrichInput {
  id:       number;
  name:     string;
  category: string;
  city:     string | null;
}

// ── Core per-place enrichment ─────────────────────────────────────────────────

async function enrichPlace(place: EnrichInput): Promise<TavilySignal> {
  const cached = getCached(place.id);
  if (cached) return cached;

  const location = place.city ? `${place.city}, Amman` : "Amman, Jordan";
  const searchQuery = `"${place.name}" ${location} ${place.category}`;

  const results = await webSearch(searchQuery, { maxResults: 3, searchDepth: "basic" });

  if (results.length === 0) {
    const signal = emptySignal(place.id);
    setCached(signal);
    return signal;
  }

  const allContent = results.map((r) => `${r.title} ${r.content}`).join(" ");

  // Validate: at least half the meaningful name tokens must appear in results
  const nameTokens = place.name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3);
  const allLower = allContent.toLowerCase();
  const hitCount = nameTokens.filter((t) => allLower.includes(t)).length;
  const validated = nameTokens.length > 0 && hitCount >= Math.ceil(nameTokens.length * 0.5);

  // Warning flags
  const warningFlags: string[] = [];
  for (const { pattern, flag } of WARNING_PATTERNS) {
    if (pattern.test(allContent)) warningFlags.push(flag);
  }

  // Sentiment score
  const pos = countMatches(allContent, POSITIVE_WORDS);
  const neg = countMatches(allContent, NEGATIVE_WORDS);
  const total = pos + neg;
  const sentimentScore = total > 0 ? Math.max(-1, Math.min(1, (pos - neg) / total)) : 0;

  const signal: TavilySignal = {
    placeId:      place.id,
    validated,
    warningFlags,
    sentimentScore,
    mentionCount: results.length,
    sourceSummary: (results[0]?.content ?? "").slice(0, 200),
    lastChecked:  Date.now(),
  };
  setCached(signal);
  return signal;
}

function emptySignal(placeId: number): TavilySignal {
  return {
    placeId,
    validated:     false,
    warningFlags:  [],
    sentimentScore: 0,
    mentionCount:  0,
    sourceSummary: "",
    lastChecked:   Date.now(),
  };
}

// ── Batch enrichment ──────────────────────────────────────────────────────────

/**
 * Enrich up to `maxPlaces` places in parallel.
 * Returns an empty Map when TAVILY_API_KEY is not set.
 */
export async function enrichPlacesBatch(
  places:    EnrichInput[],
  maxPlaces = 5,
): Promise<Map<number, TavilySignal>> {
  if (!process.env.TAVILY_API_KEY) return new Map();

  const toEnrich = places.slice(0, maxPlaces);
  const settled  = await Promise.allSettled(toEnrich.map((p) => enrichPlace(p)));

  const map = new Map<number, TavilySignal>();
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") map.set(toEnrich[i]!.id, r.value);
  });
  return map;
}

// ── Score adjustment (0–100 place-score scale) ────────────────────────────────

/**
 * Return a delta to add to the place's 0-100 ranking score.
 * Negative values penalise, positive values boost.
 */
export function tavilyScoreAdjust(signal: TavilySignal): number {
  if (signal.warningFlags.includes("Permanently closed"))         return -30;
  if (signal.warningFlags.some((f) => f.startsWith("Caution")))  return -10;
  if (signal.warningFlags.some((f) => f.startsWith("Temporarily") || f.startsWith("Has moved"))) return -6;

  if (!signal.validated) return 0;

  if (signal.sentimentScore >  0.3) return 8;
  if (signal.sentimentScore >  0.0) return 4;
  if (signal.sentimentScore < -0.3) return -5;

  return 2; // validated, sentiment neutral → small boost
}

// ── LLM context string ────────────────────────────────────────────────────────

/**
 * Build a ≤ 110-char context string for injection into the LLM prompt per place.
 * Returns empty string when no useful signal exists.
 */
export function formatTavilyContext(signal: TavilySignal): string {
  if (signal.mentionCount === 0) return "";
  const parts: string[] = [];

  if (signal.warningFlags.length > 0) {
    parts.push(`⚠️ ${signal.warningFlags[0]}`);
  } else if (signal.validated) {
    const label =
      signal.sentimentScore >  0.2 ? "positive reviews online" :
      signal.sentimentScore < -0.2 ? "mixed reviews online"    : "confirmed online";
    parts.push(label);
  }

  if (signal.sourceSummary && parts.length < 2) {
    parts.push(signal.sourceSummary.slice(0, 70));
  }

  return parts.join(" — ").slice(0, 110);
}

// ── Nightly batch job ─────────────────────────────────────────────────────────

/**
 * Run the nightly batch validation against the DB.
 * Selects top places from jordan_places and jordan_restaurants, enriches them,
 * and populates the in-memory cache so the first requests of the day hit cache.
 *
 * Called by /api/cron/tavily-validation — all DB logic lives here so the
 * apps/web package doesn't need a direct drizzle-orm dependency.
 */
export async function runNightlyTavilyBatch(timeBudgetMs = 45_000): Promise<{
  validated: number;
  errors: number;
  tookMs: number;
}> {
  if (!process.env.TAVILY_API_KEY) return { validated: 0, errors: 0, tookMs: 0 };

  // Lazy-import to avoid pulling in drizzle at module load time
  const { db } = await import("@chatsouq/db");
  const { sql } = await import("drizzle-orm");

  const started = Date.now();
  let validated = 0;
  let errors    = 0;

  // Fetch top places (by rating) from each source table
  const [placesResult, restResult] = await Promise.allSettled([
    db.execute(sql`
      SELECT id, name, category, city
      FROM   jordan_places
      ORDER  BY rating DESC NULLS LAST, id ASC
      LIMIT  60
    `),
    db.execute(sql`
      SELECT id + 3000000 AS id, name, 'restaurant' AS category, area AS city
      FROM   jordan_restaurants
      ORDER  BY rating DESC NULLS LAST, id ASC
      LIMIT  40
    `),
  ]);

  type PlaceRow = { id: number; name: string; category: string; city: string | null };

  const allPlaces: PlaceRow[] = [
    ...(placesResult.status === "fulfilled" ? (placesResult.value as { rows?: PlaceRow[] }).rows ?? [] : []),
    ...(restResult.status   === "fulfilled" ? (restResult.value   as { rows?: PlaceRow[] }).rows ?? [] : []),
  ];

  const BATCH = 5;
  for (let i = 0; i < allPlaces.length; i += BATCH) {
    if (Date.now() - started > timeBudgetMs) break;
    const batch  = allPlaces.slice(i, i + BATCH);
    const result = await enrichPlacesBatch(batch, BATCH).catch(() => new Map());
    validated += result.size;
    errors    += batch.length - result.size;
  }

  return { validated, errors, tookMs: Date.now() - started };
}

// ── Cache introspection (for tests / cron) ────────────────────────────────────

export function getTavilyCacheSize(): number {
  return signalCache.size;
}

export function purgeTavilyCache(): void {
  signalCache.clear();
}
