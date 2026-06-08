import type { AIProvider, Embedder } from "@chatsouq/ai";
import { recommend } from "./engine";
import { recommendPlaces, placeSignal, getPlaceCategories } from "./places";
import { generalAnswer, isGeneralQuery } from "./general";
import { getCategories } from "./retrieve";
import { parseConstraints } from "./intent";
import type { AssistResponse, RecommendInput } from "./types";

interface Deps {
  provider?: AIProvider;
  embedder?: Embedder;
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
  const [productCategories, placeCategories] = await Promise.all([
    getCategories(),
    getPlaceCategories(),
  ]);

  const prodSig = productSignal(input.query, productCategories);
  const pSig    = placeSignal(input.query, placeCategories);

  // Strong product signal → go product, BUT only when product signal is strictly
  // stronger than place signal. This prevents "best coffee in Jabal Amman" (which
  // scores prodSig=3 via food category but pSig=4+ via PLACE_HINTS + governorate)
  // from being misrouted to the product catalogue.
  if (prodSig >= 3 && prodSig > pSig) return recommend(input, deps);

  // Strong place signal → go places
  if (pSig >= 3 && pSig > prodSig) return recommendPlaces(input, deps);

  // General query (rental, tourism, news, Jordan info, etc.)
  if (isGeneralQuery(input.query)) {
    return generalAnswer(input, { provider: deps.provider });
  }

  // Weak product signal or keyword-only
  if (prodSig > 0) return recommend(input, deps);

  // Moderate place signal
  if (pSig > 0) return recommendPlaces(input, deps);

  // Default: try product search
  return recommend(input, deps);
}
