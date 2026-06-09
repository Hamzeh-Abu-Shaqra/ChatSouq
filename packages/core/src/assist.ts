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
  // Supports both English and Arabic prepositions: في، قرب، بالقرب من، حول، عند
  if (
    !/^(in|near|around|at|close to|by)\s+\S/i.test(trimmed) &&
    !/^(في|قرب|بالقرب من|حول|عند|بجانب|ب)\s*\S/.test(trimmed)
  ) return query;
  if (trimmed.split(/\s+/).length > 8) return query; // too long — has own intent
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (!lastUser) return query;
  return `${lastUser.content} ${trimmed}`;
}

/** 0..N "this is a product-shopping query" signal. */
function productSignal(query: string, productCategories: string[]): number {
  const c = parseConstraints(query, productCategories);
  let s = c.categories.length * 2;

  // Budget + category together: strong purchase signal
  if ((c.budgetMax !== null || c.budgetMin !== null) && c.categories.length > 0) s += 2;
  // Budget alone (no category yet): mild shopping signal
  if ((c.budgetMax !== null || c.budgetMin !== null) && c.categories.length === 0) s += 1;

  // Gifting intent — strong signal even without an explicit product category.
  // Must score ≥ 3 on its own so gift queries beat a bare governorate pSig.
  if (/\b(gift|gifts|present|presents|gifting|هدية|هدايا|هديه)\b/i.test(query)) s += 3;

  // Occasion-based shopping (birthday, Eid, Valentine, graduation…) — people
  // buying something for an occasion, not looking for a place to celebrate.
  if (
    /\b(birthday|anniversary|valentine|valentines|eid|graduation|wedding|ramadan|christmas|mother.?s\s+day|father.?s\s+day|new\s+year)\b/i.test(query) ||
    /\b(عيد|رمضان|خطوبة|زفاف|تخرج|الفلانتاين)\b/.test(query)
  ) s += 2;

  // Explicit purchase / browse intent: +1
  if (/\b(buy|cheap|price|best\s+\w+\s+under|i\s+want|show\s+me|find\s+me|looking\s+for|shop\s+for|shopping\s+for|purchase)\b/i.test(query)) s += 1;

  if (c.brands.length) s += 1;
  if (c.keywords.length >= 2) s += 1;

  // Service-verb + body-part patterns are place queries, not product purchases.
  // "cut my hair", "trim my beard", "do my nails" → reduce product signal so
  // the router falls through to places instead of the product catalogue.
  if (
    /\b(cut|trim|wash|dry|style|dye|color|do|get|fix|wax)\s+(my\s+|a\s+)?(hair|beard|nails|brows|eyebrows|lashes)\b/i.test(query) ||
    /\b(haircut|hair\s+cut|blowout|blow\s+dry|manicure|pedicure)\b/i.test(query)
  ) s -= 3;

  return Math.max(0, s);
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

  // Strong place signal → go places.
  // On a tie (prodSig === pSig) we favour places — "best cafes in Abdoun" is a
  // place query even though it technically has product-category keywords.
  if (pSig >= 2 && pSig >= prodSig) return recommendPlaces(effectiveInput, deps);

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
