import type { AIProvider, Embedder } from "@chatsouq/ai";
import { recommend } from "./engine";
import { recommendPlaces, placeSignal, getPlaceCategories } from "./places";
import { generalAnswer, isGeneralQuery } from "./general";
import { getCategories } from "./retrieve";
import { parseConstraints } from "./intent";
import type { AssistResponse, ConvMessage, RecommendInput } from "./types";

interface Deps {
  provider?: AIProvider;
  embedder?: Embedder;
}

/**
 * If the current query is a bare location refinement — "in X", "near X",
 * "around X" — with no standalone intent, prepend the previous user turn so
 * context carries over.
 *
 * Example:  "Best restaurants in Amman" → "in deir ghbar"
 *   becomes: "Best restaurants in Amman in deir ghbar"
 *
 * This prevents follow-up queries from being re-routed as product searches
 * because they happen to contain two generic keywords.
 */
function resolveFollowUp(query: string, history?: ConvMessage[]): string {
  if (!history?.length) return query;
  const trimmed = query.trim();
  // A pure location refinement: starts with a preposition and is short (≤ 6 words)
  if (!/^(in|near|around|at|close to|by)\s+\S/i.test(trimmed)) return query;
  if (trimmed.split(/\s+/).length > 6) return query; // too long — has own intent
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (!lastUser) return query;
  return `${lastUser.content} ${trimmed}`;
}

/** 0..N "this is a product-shopping query" signal. */
function productSignal(query: string, productCategories: string[]): number {
  const c = parseConstraints(query, productCategories);
  let s = c.categories.length * 2;
  // Budget alone doesn't make it a product query — need product category too
  if ((c.budgetMax !== null || c.budgetMin !== null) && c.categories.length > 0) s += 2;
  if (/\b(buy|gift|present|cheap|price|recommend|best\s+\w+\s+under|i\s+want|show\s+me|find\s+me|looking\s+for)\b/i.test(query)) s += 1;
  if (c.brands.length) s += 1;
  if (c.keywords.length >= 2) s += 1; // multi-keyword product search
  return s;
}

/**
 * Top-level router. Priority order:
 * 1. Strong product signal overrides general — "best headphones" is NOT general
 * 2. General knowledge queries (rental, neighborhoods, tourism info, Jordan facts)
 * 3. Places / services (restaurants, gyms, hospitals, etc.)
 * 4. Product catalogue (e-commerce listings)
 */
export async function assist(input: RecommendInput, deps: Deps = {}): Promise<AssistResponse> {
  // Resolve bare follow-ups like "in deir ghbar" → "best restaurants in Amman in deir ghbar"
  const resolvedQuery = resolveFollowUp(input.query, input.history);
  const effectiveInput: RecommendInput = resolvedQuery !== input.query
    ? { ...input, query: resolvedQuery }
    : input;

  const [productCategories, placeCategories] = await Promise.all([
    getCategories(),
    getPlaceCategories(),
  ]);

  const prodSig = productSignal(effectiveInput.query, productCategories);
  const pSig    = placeSignal(effectiveInput.query, placeCategories);

  // Events / "what's on today" queries: route directly to generalAnswer regardless
  // of prodSig noise. Arabic queries like "إيش في عمان اليوم؟ فعاليات" have 2+
  // keywords → prodSig=1, which would normally block the general route. These are
  // never product searches, so we check first before any product routing.
  const isEventOrTodayQuery =
    /اليوم|فعاليات|ماذا يحدث|ايش في|ايش صاير|وجهة|أين أذهب/i.test(effectiveInput.query) ||
    /\b(today|tonight|this\s+week|events?|activities|what.?s\s+(in|happening|going\s+on)|things\s+to\s+do)\b/i.test(effectiveInput.query);
  if (isEventOrTodayQuery && isGeneralQuery(effectiveInput.query)) {
    return generalAnswer(effectiveInput, { provider: deps.provider });
  }

  // Strong product signal → go product, BUT only when product signal is strictly
  // stronger than place signal. This prevents "best coffee in Jabal Amman" (which
  // scores prodSig=3 via food category but pSig=4+ via PLACE_HINTS + governorate)
  // from being misrouted to the product catalogue.
  if (prodSig >= 3 && prodSig > pSig) return recommend(effectiveInput, deps);

  // Strong place signal → go places (threshold lowered to 2 when clearly stronger than product)
  if (pSig >= 2 && pSig > prodSig) return recommendPlaces(effectiveInput, deps);

  // General queries (today digest, news, rental, tourism, etc.) win over weak product signals.
  // Only a genuinely product-specific signal (prodSig ≥ 3, e.g. "buy NEUHAUS chocolate") overrides.
  if (isGeneralQuery(effectiveInput.query) && prodSig < 3) {
    return generalAnswer(effectiveInput, { provider: deps.provider });
  }

  // Weak product signal or keyword-only
  if (prodSig > 0) return recommend(effectiveInput, deps);

  // Moderate place signal
  if (pSig > 0) return recommendPlaces(effectiveInput, deps);

  // Default: try product search
  return recommend(effectiveInput, deps);
}
